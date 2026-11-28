import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db, lessonsRef, roomsRef, teachersRef, subjectsRef, logsRef } from "./firebase.js";
import {
  state,
  DEFAULT_ROOMS,
  DAYS,
  DAY_LABELS,
  TODAY_NAME,
  formatHour,
  initHourOptions,
  syncRoomDropdowns,
  syncTeacherDropdowns,
  syncSubjectDropdowns,
  renderTimetable,
  renderManageLists,
  updateHistoryBadge,
  renderHistoryList,
  syncInternetClock,
  getVietnamNowInfo,
  isLessonStatusExpired,
  getEffectiveStatus,
  isOffSlotClaimed
} from "./ui.js";

// ==========================================
// 1. THÔNG BÁO NỔI (TOAST) & KIỂM TRA TRÙNG PHÒNG
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const colors = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-slate-900 text-white"
  };

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-200 opacity-0 translate-y-2 ${colors[type] || colors.info}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

// Kiểm tra xung đột phòng (bỏ qua lịch Báo nghỉ đang có hiệu lực và lịch Tạm thời đã hết hạn)
export function findRoomConflict(candidate, allLessons, ignoreId = null) {
  const candidateStatus = getEffectiveStatus(candidate);
  if (candidateStatus === "off" || candidateStatus === "expired_makeup") {
    return null;
  }

  const candStart = Number(candidate.startHour);
  const candEnd = candStart + Number(candidate.duration || 1.5);

  return allLessons.find((l) => {
    if (ignoreId && l.id === ignoreId) return false;
    if (l.room !== candidate.room || l.day !== candidate.day) return false;

    const existingStatus = getEffectiveStatus(l);
    if (existingStatus === "off" || existingStatus === "expired_makeup") return false;

    const lStart = Number(l.startHour);
    const lEnd = lStart + Number(l.duration || 1.5);
    return candStart < lEnd && candEnd > lStart;
  }) || null;
}

initHourOptions();

// ==========================================
// 2. CACHE OFFLINE & TRẠNG THÁI MẠNG
// ==========================================
const OFFLINE_CACHE_KEY = "tkb_offline_snapshot_v1";

function saveOfflineSnapshot() {
  if (!navigator.onLine || state.lessons.length === 0) return;
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({
      lessons: state.lessons,
      roomsList: state.roomsList,
      teachersList: state.teachersList,
      subjectsList: state.subjectsList,
      logsList: state.logsList
    }));
  } catch (_) {}
}

function loadOfflineSnapshot() {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (Array.isArray(cached.roomsList) && cached.roomsList.length > 0) state.roomsList = cached.roomsList;
    if (Array.isArray(cached.teachersList)) state.teachersList = cached.teachersList;
    if (Array.isArray(cached.subjectsList)) state.subjectsList = cached.subjectsList;
    if (Array.isArray(cached.lessons)) state.lessons = cached.lessons;
    if (Array.isArray(cached.logsList)) state.logsList = cached.logsList;

    syncRoomDropdowns();
    syncTeacherDropdowns();
    syncSubjectDropdowns();
    renderManageLists();
    renderTimetable();
    updateHistoryBadge();
    renderHistoryList();
  } catch (_) {}
}

let hasShownInitialSyncToast = false;
let suppressNextSyncToast = false;

function setNetworkDot(isSynced) {
  const dot = document.getElementById("networkStatusDot");
  if (!dot) return;
  if (isSynced) {
    dot.title = "Đã cập nhật thời khóa biểu mới nhất";
    dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0";
  } else {
    dot.title = "Ngoại tuyến (Đang xem bản lưu)";
    dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 shrink-0";
  }
}

function syncOfflineStatus() {
  if (!navigator.onLine) {
    setNetworkDot(false);
  }
}

window.addEventListener("offline", syncOfflineStatus);
window.addEventListener("online", () => {
  setNetworkDot(true);
  syncInternetClock().then(() => renderTimetable());
});

loadOfflineSnapshot();
syncOfflineStatus();

// ==========================================
// 3. TỰ ĐỘNG DỌN LỊCH TẠM THỜI / BÁO NGHỈ SAU 23:00
// ==========================================
function getTargetDateForDay(lessonDay) {
  const { dayName, dateStr } = getVietnamNowInfo();
  const todayIdx = DAYS.indexOf(dayName);
  const targetIdx = DAYS.indexOf(lessonDay);
  if (todayIdx === -1 || targetIdx === -1) return dateStr;

  const diffDays = (targetIdx - todayIdx + 7) % 7;
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + diffDays);
  return base.toISOString().slice(0, 10);
}

let isCleaningExpired = false;

async function cleanupExpiredLessons() {
  if (isCleaningExpired || !state.currentUser || !navigator.onLine || state.lessons.length === 0) return;

  const expired = state.lessons.filter((lesson) => isLessonStatusExpired(lesson));
  if (expired.length === 0) return;

  isCleaningExpired = true;
  try {
    await Promise.all(
      expired.map((lesson) => {
        const status = lesson.status || (lesson.isMakeup ? "makeup" : "normal");
        if (status === "makeup") {
          return deleteDoc(doc(db, "lessons", lesson.id));
        }
        return updateDoc(doc(db, "lessons", lesson.id), {
          status: "normal",
          isMakeup: false,
          targetDate: "",
          note: ""
        });
      })
    );
  } catch (_) {
  } finally {
    isCleaningExpired = false;
  }
}

// ==========================================
// 4. ĐỒNG BỘ GIAO DIỆN ĐĂNG NHẬP (DESKTOP + DRAWER + FAB)
// ==========================================
function syncAuthUI(user) {
  const isLoggedIn = Boolean(user);
  const email = user?.email || "";

  // Desktop Header
  ["historyBtn", "addLessonBtnDesktop", "manageListsBtnDesktop"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !isLoggedIn);
    el.classList.toggle("inline-flex", isLoggedIn);
  });
  const emailDesktop = document.getElementById("userEmailDesktop");
  if (emailDesktop) {
    emailDesktop.textContent = email;
    emailDesktop.classList.toggle("hidden", !isLoggedIn);
  }
  const authBtnDesktop = document.getElementById("authBtnDesktop");
  if (authBtnDesktop) {
    authBtnDesktop.textContent = isLoggedIn ? "Đăng xuất" : "Đăng nhập";
  }

  // Mobile FAB (+)
  const fab = document.getElementById("mobileFabAddBtn");
  if (fab) {
    fab.classList.toggle("hidden", !isLoggedIn);
    fab.classList.toggle("flex", isLoggedIn);
  }

  // Right Drawer
  document.getElementById("drawerLoggedOutBox")?.classList.toggle("hidden", isLoggedIn);
  document.getElementById("drawerLoggedInBox")?.classList.toggle("hidden", !isLoggedIn);
  const drawerEmail = document.getElementById("drawerUserEmail");
  if (drawerEmail) drawerEmail.textContent = email;

  const drawerManage = document.getElementById("drawerManageListsBtn");
  if (drawerManage) {
    drawerManage.classList.toggle("hidden", !isLoggedIn);
    drawerManage.classList.toggle("flex", isLoggedIn);
  }
  const drawerHistory = document.getElementById("drawerHistoryBtn");
  if (drawerHistory) {
    drawerHistory.classList.toggle("hidden", !isLoggedIn);
    drawerHistory.classList.toggle("flex", isLoggedIn);
  }
}

onAuthStateChanged(auth, (user) => {
  state.currentUser = user;
  syncAuthUI(user);
  renderTimetable();
  renderHistoryList();
  cleanupExpiredLessons();
});

// ==========================================
// 5. ĐỒNG BỘ DỮ LIỆU FIRESTORE THỜI GIAN THỰC
// ==========================================
onSnapshot(roomsRef, (snap) => {
  const customRooms = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  state.roomsList = customRooms.length > 0 ? customRooms : [...DEFAULT_ROOMS];
  syncRoomDropdowns();
  renderManageLists();
  renderTimetable();
  saveOfflineSnapshot();
});

onSnapshot(teachersRef, (snap) => {
  state.teachersList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  syncTeacherDropdowns();
  renderManageLists();
  saveOfflineSnapshot();
});

onSnapshot(subjectsRef, (snap) => {
  state.subjectsList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  syncSubjectDropdowns();
  renderManageLists();
  saveOfflineSnapshot();
});

onSnapshot(lessonsRef, (snap) => {
  if (snap.empty && state.lessons.length > 0 && (!navigator.onLine || snap.metadata.fromCache)) {
    syncOfflineStatus();
    return;
  }

  state.lessons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  syncRoomDropdowns();
  syncTeacherDropdowns();
  syncSubjectDropdowns();
  renderTimetable();
  saveOfflineSnapshot();
  cleanupExpiredLessons();

  if (navigator.onLine && !snap.metadata.fromCache) {
    setNetworkDot(true);
    if (!hasShownInitialSyncToast) {
      hasShownInitialSyncToast = true;
      showToast("Đã cập nhật thời khóa biểu mới nhất", "success");
    } else if (!suppressNextSyncToast) {
      showToast("Đã cập nhật thời khóa biểu mới nhất", "info");
    }
    suppressNextSyncToast = false;
  } else {
    syncOfflineStatus();
  }
}, () => {
  syncOfflineStatus();
});

const recentLogsQuery = query(logsRef, orderBy("createdAt", "desc"), limit(50));
onSnapshot(recentLogsQuery, (snap) => {
  if (snap.empty && state.logsList.length > 0 && (!navigator.onLine || snap.metadata.fromCache)) {
    return;
  }

  state.logsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateHistoryBadge();
  renderHistoryList();
  saveOfflineSnapshot();
});

// ==========================================
// 6. HỘP THOẠI THÔNG BÁO / XÁC NHẬN CHUNG
// ==========================================
let appDialogResolver = null;

function showAppNotice(message, title = "Thông báo") {
  return new Promise((resolve) => {
    appDialogResolver = resolve;
    document.getElementById("appDialogTitle").textContent = title;
    document.getElementById("appDialogMessage").textContent = message;
    document.getElementById("appDialogCancelBtn").classList.add("hidden");
    const okBtn = document.getElementById("appDialogOkBtn");
    okBtn.textContent = "Đã hiểu";
    okBtn.className = "h-11 px-5 min-w-[112px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl inline-flex items-center justify-center transition";
    const modal = document.getElementById("appDialogModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  });
}

function showAppConfirm(message, title = "Xác nhận", okText = "Đồng ý", danger = false) {
  return new Promise((resolve) => {
    appDialogResolver = resolve;
    document.getElementById("appDialogTitle").textContent = title;
    document.getElementById("appDialogMessage").textContent = message;
    document.getElementById("appDialogCancelBtn").classList.remove("hidden");
    const okBtn = document.getElementById("appDialogOkBtn");
    okBtn.textContent = okText;
    okBtn.className = danger
      ? "h-11 px-5 min-w-[112px] text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl inline-flex items-center justify-center transition"
      : "h-11 px-5 min-w-[112px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl inline-flex items-center justify-center transition";
    const modal = document.getElementById("appDialogModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  });
}

window.closeAppDialog = function (result) {
  const modal = document.getElementById("appDialogModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  if (appDialogResolver) {
    const fn = appDialogResolver;
    appDialogResolver = null;
    fn(result);
  }
};

async function writeActivityLog(action, lessonData, detail = "", lessonId = "") {
  try {
    await addDoc(logsRef, {
      action,
      lessonId,
      lesson: {
        teacherName: lessonData.teacherName || "",
        room: lessonData.room || "",
        subject: lessonData.subject || "",
        day: lessonData.day || "",
        startHour: Number(lessonData.startHour || 0),
        duration: Number(lessonData.duration || 1.5),
        status: lessonData.status || (lessonData.isMakeup ? "makeup" : "normal"),
        note: lessonData.note || ""
      },
      detail,
      by: state.currentUser?.email || "Giáo viên",
      createdAt: Date.now()
    });
  } catch (_) {}
}

// ==========================================
// 7. NGĂN KÉO PHẢI, HƯỚNG DẪN & CHỌN NHANH CA BÁO NGHỈ
// ==========================================
window.openRightDrawer = function () {
  document.getElementById("rightDrawerBackdrop")?.classList.remove("hidden");
  const drawer = document.getElementById("rightDrawer");
  if (drawer) {
    drawer.classList.remove("invisible", "pointer-events-none", "translate-x-full");
    drawer.classList.add("shadow-2xl");
  }
};

window.closeRightDrawer = function () {
  document.getElementById("rightDrawerBackdrop")?.classList.add("hidden");
  const drawer = document.getElementById("rightDrawer");
  if (drawer) {
    drawer.classList.add("translate-x-full", "pointer-events-none");
    drawer.classList.remove("shadow-2xl");
    setTimeout(() => {
      if (drawer.classList.contains("translate-x-full")) {
        drawer.classList.add("invisible");
      }
    }, 200);
  }
};

window.switchHelpTab = function (tab) {
  const isTeacher = tab === "teacher";
  const guestBtn = document.getElementById("helpTabBtn-guest");
  const teacherBtn = document.getElementById("helpTabBtn-teacher");
  const guestPanel = document.getElementById("helpTabPanel-guest");
  const teacherPanel = document.getElementById("helpTabPanel-teacher");

  if (guestPanel) guestPanel.classList.toggle("hidden", isTeacher);
  if (teacherPanel) teacherPanel.classList.toggle("hidden", !isTeacher);

  const activeCls = "py-2 px-3 rounded-lg text-sm font-semibold transition bg-white text-slate-900 shadow-xs";
  const inactiveCls = "py-2 px-3 rounded-lg text-sm font-semibold transition text-slate-500 hover:text-slate-800";

  if (guestBtn) {
    guestBtn.className = isTeacher ? inactiveCls : activeCls;
    guestBtn.setAttribute("aria-selected", String(!isTeacher));
  }
  if (teacherBtn) {
    teacherBtn.className = isTeacher ? activeCls : inactiveCls;
    teacherBtn.setAttribute("aria-selected", String(isTeacher));
  }
};

window.openHelpModal = function () {
  const isLoggedIn = Boolean(state.currentUser);
  const tabBar = document.getElementById("helpTabBar");
  if (tabBar) {
    tabBar.classList.toggle("hidden", !isLoggedIn);
  }
  window.switchHelpTab(isLoggedIn ? "teacher" : "guest");
  const modal = document.getElementById("helpModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeHelpModal = function () {
  const modal = document.getElementById("helpModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

let pendingOffLesson = null;

window.handleLessonCardClick = function (lesson) {
  if (!state.currentUser) return;
  if (!navigator.onLine) {
    showToast("Đang ngoại tuyến — chỉ có thể xem lịch.", "warning");
    return;
  }

  const effStatus = getEffectiveStatus(lesson);
  const claimed = isOffSlotClaimed(lesson, state.lessons);

  // Khi bấm vào thẻ Báo nghỉ còn trống phòng -> luôn hiện hộp thoại chọn nhanh
  if (effStatus === "off" && !claimed) {
    pendingOffLesson = lesson;
    const endHour = Number(lesson.startHour) + Number(lesson.duration || 1.5);
    const desc = document.getElementById("offSlotChoiceDesc");
    if (desc) {
      desc.textContent = `${lesson.room} (${DAY_LABELS[lesson.day]}, ${formatHour(lesson.startHour)}–${formatHour(endHour)}) của ${lesson.teacherName} đang báo nghỉ. Bạn muốn đặt lớp tạm thời vào giờ này hay chỉnh sửa lịch gốc?`;
    }
    const modal = document.getElementById("offSlotChoiceModal");
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
    return;
  }

  window.openLessonModal(lesson);
};

window.closeOffSlotChoiceModal = function () {
  pendingOffLesson = null;
  const modal = document.getElementById("offSlotChoiceModal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
};

window.bookFreedOffSlot = function () {
  const target = pendingOffLesson;
  window.closeOffSlotChoiceModal();
  if (!target) return;
  window.openLessonModal(null, target.day, Number(target.startHour), {
    room: target.room,
    duration: Number(target.duration || 1.5),
    status: "makeup"
  });
};

window.editOriginalOffSlot = function () {
  const target = pendingOffLesson;
  window.closeOffSlotChoiceModal();
  if (target) window.openLessonModal(target);
};

// ==========================================
// 8. CÁC THAO TÁC BỘ LỌC, ĐĂNG NHẬP, LỊCH SỬ
// ==========================================
window.renderTimetable = renderTimetable;

window.jumpToToday = function () {
  state.selectedMobileDay = TODAY_NAME;
  renderTimetable();
};

window.toggleMobileFilter = function () {
  const panel = document.getElementById("filterControlsPanel");
  const chevron = document.getElementById("mobileFilterChevron");
  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !isHidden);
  chevron.classList.toggle("rotate-180", isHidden);
};

window.resetFilters = function () {
  document.getElementById("roomFilter").value = "ALL";
  document.getElementById("teacherFilter").value = "ALL";
  document.getElementById("subjectFilter").value = "ALL";
  renderTimetable();
};

window.handleAuthButtonClick = async function () {
  if (state.currentUser) {
    const ok = await showAppConfirm("Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại?", "Đăng xuất", "Đăng xuất");
    if (!ok) return;
    await window.logoutTeacher();
  } else {
    window.openLoginModal();
  }
};

window.openLoginModal = function () {
  document.getElementById("loginError").classList.add("hidden");
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("loginModal").classList.add("flex");
  setTimeout(() => document.getElementById("loginEmail")?.focus(), 50);
};

window.closeLoginModal = function () {
  document.getElementById("loginModal").classList.add("hidden");
  document.getElementById("loginModal").classList.remove("flex");
};

window.submitLogin = async function (e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const rememberMe = document.getElementById("rememberMeCheckbox")?.checked ?? true;
  const errEl = document.getElementById("loginError");
  errEl.classList.add("hidden");

  try {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("loginPassword").value = "";
    window.closeLoginModal();
    showToast("Đăng nhập thành công!", "success");
  } catch (err) {
    errEl.textContent = "Email hoặc mật khẩu không đúng.";
    errEl.classList.remove("hidden");
  }
};

window.logoutTeacher = async function () {
  await signOut(auth);
  showToast("Đã đăng xuất.", "info");
};

window.openHistoryModal = function () {
  localStorage.setItem("tkb_last_seen_log", String(Date.now()));
  updateHistoryBadge();
  renderHistoryList();
  document.getElementById("historyModal").classList.remove("hidden");
  document.getElementById("historyModal").classList.add("flex");
};

window.closeHistoryModal = function () {
  document.getElementById("historyModal").classList.add("hidden");
  document.getElementById("historyModal").classList.remove("flex");
};

window.restoreFromLog = async function (logId) {
  if (!state.currentUser) return;
  if (!navigator.onLine) {
    showToast("Cần kết nối mạng để khôi phục lịch.", "warning");
    return;
  }
  const log = state.logsList.find(item => item.id === logId);
  if (!log || !log.lesson) return;

  const snap = log.lesson;
  const startHour = Number(snap.startHour);
  const duration = Number(snap.duration || 1.5);
  const existingLesson = log.lessonId ? state.lessons.find(l => l.id === log.lessonId) : null;
  const restoredStatus = snap.status || (snap.isMakeup ? "makeup" : "normal");

  const candidate = {
    room: snap.room,
    day: snap.day,
    startHour,
    duration,
    status: restoredStatus,
    targetDate: (restoredStatus === "makeup" || restoredStatus === "off") ? getTargetDateForDay(snap.day) : ""
  };

  const conflict = findRoomConflict(candidate, state.lessons, existingLesson?.id || null);
  if (conflict) {
    const conflictType = getEffectiveStatus(conflict) === "makeup" ? "lịch Tạm thời" : "lịch Cố định";
    const conflictEnd = Number(conflict.startHour) + Number(conflict.duration || 1.5);
    await showAppNotice(
      `Không thể khôi phục vì ${conflict.room} hiện đã có ${conflictType} của ${conflict.teacherName} (${formatHour(conflict.startHour)}–${formatHour(conflictEnd)}).`,
      "Trùng phòng học"
    );
    return;
  }

  const ok = await showAppConfirm(
    `Khôi phục lịch của ${snap.teacherName} tại ${snap.room} (${DAY_LABELS[snap.day]}, ${formatHour(startHour)}) về trạng thái trước đó?`,
    "Khôi phục lịch học",
    "Khôi phục"
  );
  if (!ok) return;

  const payload = {
    teacherName: snap.teacherName,
    room: snap.room,
    subject: snap.subject || "",
    day: snap.day,
    startHour,
    duration,
    status: restoredStatus,
    isMakeup: restoredStatus === "makeup",
    targetDate: candidate.targetDate,
    note: snap.note || "",
    updatedBy: state.currentUser.email
  };

  suppressNextSyncToast = true;
  if (existingLesson) {
    await updateDoc(doc(db, "lessons", existingLesson.id), payload);
    await writeActivityLog("restore", payload, "Hoàn tác chỉnh sửa", existingLesson.id);
  } else {
    const newRef = await addDoc(lessonsRef, payload);
    await writeActivityLog("restore", payload, "Khôi phục từ lịch sử", newRef.id);
  }
  window.closeHistoryModal();
  showToast("Đã khôi phục lịch học!", "success");
};

// ==========================================
// 9. QUẢN LÝ DANH SÁCH (PHÒNG / GIÁO VIÊN / MÔN)
// ==========================================
window.openManageModal = function () {
  if (!state.currentUser) return;
  if (!navigator.onLine) {
    showToast("Cần kết nối mạng để quản lý danh sách.", "warning");
    return;
  }
  document.getElementById("manageModal").classList.remove("hidden");
  document.getElementById("manageModal").classList.add("flex");
};

window.closeManageModal = function () {
  document.getElementById("manageModal").classList.add("hidden");
  document.getElementById("manageModal").classList.remove("flex");
};

window.switchManageTab = function (tab) {
  ["rooms", "teachers", "subjects"].forEach(t => {
    document.getElementById(`manageTab-${t}`).classList.toggle("hidden", t !== tab);
    const btn = document.getElementById(`tabBtn-${t}`);
    btn.className = t === tab
      ? "px-4 py-2.5 border-b-2 border-slate-900 text-slate-900"
      : "px-4 py-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800";
  });
};

window.addRoomItem = async function (e) {
  e.preventDefault();
  if (!state.currentUser) return;
  const input = document.getElementById("newRoomName");
  const color = document.getElementById("newRoomColor").value;
  const name = input.value.trim();
  if (!name) return;

  const exists = state.roomsList.some(r => r.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    await showAppNotice(`Phòng "${name}" đã tồn tại trong danh sách!`, "Trùng tên phòng");
    return;
  }

  const hadOnlyDefaults = state.roomsList.some(r => r.isDefault);
  await addDoc(roomsRef, { name, color });
  if (hadOnlyDefaults) {
    for (const def of DEFAULT_ROOMS) {
      if (def.name.toLowerCase() !== name.toLowerCase()) {
        await addDoc(roomsRef, { name: def.name, color: def.color });
      }
    }
  }
  input.value = "";
  showToast(`Đã thêm ${name}.`, "success");
};

window.addTeacherItem = async function (e) {
  e.preventDefault();
  if (!state.currentUser) return;
  const input = document.getElementById("newTeacherName");
  const name = input.value.trim();
  if (!name) return;

  const exists = state.teachersList.some(t => t.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    await showAppNotice(`Giáo viên "${name}" đã có trong danh sách!`, "Trùng tên giáo viên");
    return;
  }
  await addDoc(teachersRef, { name });
  input.value = "";
  showToast(`Đã thêm ${name}.`, "success");
};

window.addSubjectItem = async function (e) {
  e.preventDefault();
  if (!state.currentUser) return;
  const input = document.getElementById("newSubjectName");
  const name = input.value.trim();
  if (!name) return;

  const exists = state.subjectsList.some(s => s.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    await showAppNotice(`Môn học "${name}" đã có trong danh sách!`, "Trùng tên môn học");
    return;
  }

  await addDoc(subjectsRef, { name });
  input.value = "";
  showToast(`Đã thêm ${name}.`, "success");
};

let pendingRename = null;

window.closeRenameModal = function () {
  pendingRename = null;
  const modal = document.getElementById("renameModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

window.renameManageItem = function (colName, id) {
  if (!state.currentUser) return;

  const listMap = {
    rooms:    { list: state.roomsList,    field: "room",        label: "tên phòng" },
    teachers: { list: state.teachersList, field: "teacherName", label: "tên giáo viên" },
    subjects: { list: state.subjectsList, field: "subject",     label: "tên môn học" }
  };

  const target = listMap[colName];
  const item = target?.list.find(x => x.id === id);
  if (!item) return;

  pendingRename = { colName, id, target, item };
  document.getElementById("renameModalTitle").textContent = `Đổi ${target.label}`;
  const input = document.getElementById("renameModalInput");
  input.value = item.name;
  document.getElementById("renameModalError").classList.add("hidden");

  const modal = document.getElementById("renameModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => { input.focus(); input.select(); }, 50);
};

window.submitRenameModal = async function (e) {
  e.preventDefault();
  if (!pendingRename || !state.currentUser) return;

  const { colName, id, target, item } = pendingRename;
  const newName = document.getElementById("renameModalInput").value.trim();
  const errEl = document.getElementById("renameModalError");

  if (!newName || newName === item.name) {
    window.closeRenameModal();
    return;
  }

  const duplicate = target.list.some(
    x => x.id !== id && x.name.toLowerCase() === newName.toLowerCase()
  );
  if (duplicate) {
    errEl.textContent = `Tên "${newName}" đã tồn tại trong danh sách.`;
    errEl.classList.remove("hidden");
    return;
  }

  try {
    await updateDoc(doc(db, colName, id), { name: newName });
    const affectedLessons = state.lessons.filter(l => l[target.field] === item.name);
    if (affectedLessons.length > 0) {
      await Promise.all(
        affectedLessons.map(l => updateDoc(doc(db, "lessons", l.id), { [target.field]: newName }))
      );
    }
    window.closeRenameModal();
    showToast("Đã cập nhật tên mới.", "success");
  } catch (err) {
    errEl.textContent = "Lỗi cập nhật tên: " + err.message;
    errEl.classList.remove("hidden");
  }
};

let deleteCountdownTimer = null;

window.closeConfirmDeleteModal = function () {
  if (deleteCountdownTimer) {
    clearInterval(deleteCountdownTimer);
    deleteCountdownTimer = null;
  }
  const modal = document.getElementById("confirmDeleteModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

window.deleteManageItem = function (colName, id) {
  if (!state.currentUser) return;

  const listMap = {
    rooms:    { list: state.roomsList,    label: "phòng học" },
    teachers: { list: state.teachersList, label: "giáo viên" },
    subjects: { list: state.subjectsList, label: "môn học" }
  };
  const target = listMap[colName];
  const item = target?.list.find(x => x.id === id);
  const itemName = item ? `"${item.name}"` : "mục này";

  const modal = document.getElementById("confirmDeleteModal");
  const msgEl = document.getElementById("confirmDeleteMessage");
  const yesBtn = document.getElementById("confirmDeleteYesBtn");

  msgEl.textContent = `Bạn có chắc chắn muốn xóa ${target?.label || "mục"} ${itemName} khỏi danh sách không?`;

  let secondsLeft = 3;
  yesBtn.disabled = true;
  yesBtn.textContent = `Có (${secondsLeft}s)`;
  yesBtn.className = "h-11 px-5 min-w-[112px] text-sm font-semibold rounded-xl bg-slate-200 text-slate-400 cursor-not-allowed inline-flex items-center justify-center transition";
  yesBtn.onclick = null;

  if (deleteCountdownTimer) clearInterval(deleteCountdownTimer);

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  deleteCountdownTimer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      yesBtn.textContent = `Có (${secondsLeft}s)`;
    } else {
      clearInterval(deleteCountdownTimer);
      deleteCountdownTimer = null;
      yesBtn.disabled = false;
      yesBtn.textContent = "Có, xóa";
      yesBtn.className = "h-11 px-5 min-w-[112px] text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer inline-flex items-center justify-center transition";
      yesBtn.onclick = async () => {
        window.closeConfirmDeleteModal();
        await deleteDoc(doc(db, colName, id));
        showToast("Đã xóa khỏi danh sách.", "info");
      };
    }
  }, 1000);
};

// ==========================================
// 10. ĐẶT / SỬA / XÓA PHÒNG HỌC
// ==========================================
const STATUS_HELPER_TEXT = {
  normal: "Lịch cố định sẽ lặp lại hằng tuần.",
  makeup: "Lịch tạm thời chỉ áp dụng cho ngày đã chọn và tự động xóa lúc 23:00.",
  off: "Tạm nhường phòng 1 buổi; sau 23:00 sẽ tự trở về lịch Cố định và xóa ghi chú."
};

window.selectLessonStatus = function (status) {
  const input = document.getElementById("lessonStatus");
  if (input) input.value = status;
  const isNewBooking = !document.getElementById("lessonId")?.value;

  document.querySelectorAll(".status-pill-btn").forEach(btn => {
    const active = btn.dataset.status === status;
    const hideOff = isNewBooking && btn.dataset.status === "off";
    btn.className = `${hideOff ? "hidden " : "inline-flex "}status-pill-btn py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-bold transition items-center justify-center gap-1.5 ${
      active
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
    }`;
  });

  const helperEl = document.getElementById("statusHelperText");
  if (helperEl) {
    helperEl.textContent = STATUS_HELPER_TEXT[status] || STATUS_HELPER_TEXT.normal;
  }
};

window.openLessonModal = function (lesson = null, defaultDay = TODAY_NAME, defaultHour = 9, prefillOptions = null) {
  if (!state.currentUser) return;
  if (!navigator.onLine) {
    showToast("Cần kết nối mạng để đặt hoặc sửa lịch.", "warning");
    return;
  }

  document.getElementById("formError").classList.add("hidden");
  const deleteBtn = document.getElementById("deleteLessonBtn");
  const teacherSelect = document.getElementById("teacherSelectInput");
  const roomSelect = document.getElementById("roomSelectInput");
  const subjectSelect = document.getElementById("subjectSelectInput");

  if (lesson) {
    document.getElementById("lessonModalTitle").textContent = "Chỉnh sửa lịch phòng";
    document.getElementById("lessonId").value = lesson.id;

    if (lesson.teacherName && ![...teacherSelect.options].some(o => o.value === lesson.teacherName)) {
      const opt = document.createElement("option");
      opt.value = lesson.teacherName;
      opt.textContent = lesson.teacherName;
      teacherSelect.appendChild(opt);
    }
    teacherSelect.value = lesson.teacherName || "";

    roomSelect.value = lesson.room || state.roomsList[0]?.name || "";

    if (lesson.subject && ![...subjectSelect.options].some(o => o.value === lesson.subject)) {
      const opt = document.createElement("option");
      opt.value = lesson.subject;
      opt.textContent = lesson.subject;
      subjectSelect.appendChild(opt);
    }
    subjectSelect.value = lesson.subject || "";

    document.getElementById("dayInput").value = lesson.day || TODAY_NAME;
    document.getElementById("startHourInput").value = lesson.startHour ?? 9;
    document.getElementById("durationInput").value = lesson.duration ?? 1.5;
    document.getElementById("noteInput").value = lesson.note || "";
    deleteBtn.classList.remove("hidden");
  } else {
    document.getElementById("lessonModalTitle").textContent = "Đặt phòng học";
    document.getElementById("lessonId").value = "";
    if (teacherSelect.options.length > 0) teacherSelect.selectedIndex = 0;
    roomSelect.value = prefillOptions?.room || state.roomsList[0]?.name || "";
    subjectSelect.value = "";
    document.getElementById("dayInput").value = defaultDay || state.selectedMobileDay || TODAY_NAME;
    document.getElementById("startHourInput").value = defaultHour ?? 9;
    document.getElementById("durationInput").value = prefillOptions?.duration ?? 1.5;
    document.getElementById("noteInput").value = "";
    deleteBtn.classList.add("hidden");
  }

  // Gọi sau khi đã gán lessonId để ẩn/hiện nút Báo nghỉ chính xác
  const initialStatus = lesson
    ? getEffectiveStatus(lesson)
    : (prefillOptions?.status || "normal");
  window.selectLessonStatus(initialStatus === "expired_makeup" ? "normal" : initialStatus);

  const grid = document.getElementById("statusBtnGrid");
  if (grid) {
    grid.classList.toggle("grid-cols-2", !lesson);
    grid.classList.toggle("grid-cols-3", Boolean(lesson));
  }

  document.getElementById("lessonModal").classList.remove("hidden");
  document.getElementById("lessonModal").classList.add("flex");
};

window.closeLessonModal = function () {
  document.getElementById("lessonModal").classList.add("hidden");
  document.getElementById("lessonModal").classList.remove("flex");
};

window.saveLesson = async function (e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const id = document.getElementById("lessonId").value;
  const teacherName = document.getElementById("teacherSelectInput").value.trim();
  const room = document.getElementById("roomSelectInput").value;
  const subject = document.getElementById("subjectSelectInput").value;
  const day = document.getElementById("dayInput").value;
  const startHour = Number(document.getElementById("startHourInput").value);
  const duration = Number(document.getElementById("durationInput").value);
  const status = document.getElementById("lessonStatus")?.value || "normal";
  const note = document.getElementById("noteInput").value.trim();

  const errEl = document.getElementById("formError");
  errEl.classList.add("hidden");

  if (!teacherName) {
    errEl.textContent = "Vui lòng chọn giáo viên (hoặc thêm giáo viên trong 'Quản lý danh sách' trước).";
    errEl.classList.remove("hidden");
    return;
  }

  const targetDate = (status === "makeup" || status === "off") ? getTargetDateForDay(day) : "";
  const candidate = { room, day, startHour, duration, status, targetDate };

  const conflict = findRoomConflict(candidate, state.lessons, id || null);
  if (conflict) {
    const conflictType = getEffectiveStatus(conflict) === "makeup" ? "lịch Tạm thời" : "lịch Cố định";
    const conflictEnd = Number(conflict.startHour) + Number(conflict.duration || 1.5);
    const msg = `${conflict.room} hiện đã có ${conflictType} của ${conflict.teacherName} (${formatHour(conflict.startHour)}–${formatHour(conflictEnd)}).`;
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
    showToast(msg, "error");
    return;
  }

  const btn = document.getElementById("saveLessonBtn");
  btn.disabled = true;
  btn.textContent = "Đang lưu...";

  try {
    suppressNextSyncToast = true;
    const payload = {
      teacherName,
      room,
      subject,
      day,
      startHour,
      duration,
      status,
      isMakeup: status === "makeup",
      targetDate,
      note,
      updatedBy: state.currentUser.email
    };

    if (id) {
      const oldLesson = state.lessons.find(l => l.id === id);
      await updateDoc(doc(db, "lessons", id), payload);
      const statusLabels = { normal: "Cố định", makeup: "Tạm thời", off: "Báo nghỉ" };
      const detail = oldLesson
        ? `Đổi sang: ${room}, ${DAY_LABELS[day]} ${formatHour(startHour)} (${statusLabels[status] || "Cố định"})`
        : "";
      await writeActivityLog("update", oldLesson || payload, detail, id);
      showToast("Đã cập nhật lịch phòng.", "success");
    } else {
      const createdRef = await addDoc(lessonsRef, payload);
      await writeActivityLog("create", payload, "", createdRef.id);
      showToast("Đã đặt phòng thành công!", "success");
    }
    window.closeLessonModal();
  } catch (err) {
    errEl.textContent = "Không thể lưu lịch. Vui lòng kiểm tra kết nối mạng.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Lưu lịch";
  }
};

window.deleteLesson = async function () {
  const id = document.getElementById("lessonId").value;
  if (!id || !state.currentUser) return;
  if (!(await showAppConfirm("Bạn có chắc muốn xóa lịch phòng này không?", "Xóa lịch học", "Xóa lịch", true))) return;

  const target = state.lessons.find(l => l.id === id);
  suppressNextSyncToast = true;
  await deleteDoc(doc(db, "lessons", id));
  if (target) {
    await writeActivityLog("delete", target);
  }
  window.closeLessonModal();
  showToast("Đã xóa lịch phòng.", "info");
};

// ==========================================
// 11. ĐỒNG HỒ INTERNET & PHÍM TẮT ESC
// ==========================================
syncInternetClock().then(() => {
  renderTimetable();
  cleanupExpiredLessons();
});
setInterval(() => {
  renderTimetable();
  cleanupExpiredLessons();
}, 60 * 1000);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const appDialog = document.getElementById("appDialogModal");
  if (appDialog && !appDialog.classList.contains("hidden")) {
    const cancelBtn = document.getElementById("appDialogCancelBtn");
    const okBtn = document.getElementById("appDialogOkBtn");
    if (cancelBtn && !cancelBtn.classList.contains("hidden")) cancelBtn.click();
    else if (okBtn) okBtn.click();
    return;
  }

  const confirmDel = document.getElementById("confirmDeleteModal");
  if (confirmDel && !confirmDel.classList.contains("hidden")) {
    window.closeConfirmDeleteModal?.();
    return;
  }

  const modalClosers = [
    ["renameModal", () => window.closeRenameModal?.()],
    ["offSlotChoiceModal", () => window.closeOffSlotChoiceModal?.()],
    ["helpModal", () => window.closeHelpModal?.()],
    ["lessonModal", () => window.closeLessonModal?.()],
    ["manageModal", () => window.closeManageModal?.()],
    ["historyModal", () => window.closeHistoryModal?.()],
    ["loginModal", () => window.closeLoginModal?.()]
  ];

  for (const [id, closeFn] of modalClosers) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("hidden")) {
      closeFn();
      return;
    }
  }

  const drawerBackdrop = document.getElementById("rightDrawerBackdrop");
  if (drawerBackdrop && !drawerBackdrop.classList.contains("hidden")) {
    window.closeRightDrawer?.();
  }
});

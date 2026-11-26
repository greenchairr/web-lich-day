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
  isLessonStatusExpired
} from "./ui.js";

initHourOptions();

const OFFLINE_CACHE_KEY = "tkb_offline_snapshot_v1";

function saveOfflineSnapshot() {
  // Chỉ lưu khi thực sự có dữ liệu và đang có mạng (tránh ghi đè mảng rỗng khi offline)
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

function syncOfflineStatus() {
  const status = document.getElementById("syncStatus");
  if (!status) return;
  if (!navigator.onLine) {
    status.title = "Ngoại tuyến (Đang xem bản lưu)";
    status.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>`;
  }
}

window.addEventListener("offline", syncOfflineStatus);
window.addEventListener("online", () => {
  syncInternetClock().then(() => renderTimetable());
});

loadOfflineSnapshot();
syncOfflineStatus();

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


// Theo dõi đăng nhập
onAuthStateChanged(auth, (user) => {
  state.currentUser = user;
  const loginBtn = document.getElementById("loginBtn");
  const addLessonBtn = document.getElementById("addLessonBtn");
  const manageBtn = document.getElementById("manageBtn");
  const userBadge = document.getElementById("userBadge");
  const userEmailLabel = document.getElementById("userEmailLabel");
  const headerTitleWrap = document.getElementById("headerTitleWrap");

  if (user) {
    if (headerTitleWrap) headerTitleWrap.classList.add("hidden", "sm:block");
    loginBtn.classList.add("hidden");
    addLessonBtn.classList.remove("hidden");
    addLessonBtn.classList.add("inline-flex");
    manageBtn.classList.remove("hidden");
    manageBtn.classList.add("inline-flex");
    userBadge.classList.remove("hidden");
    userBadge.classList.add("inline-flex");
    userEmailLabel.textContent = user.email;
  } else {
    if (headerTitleWrap) headerTitleWrap.classList.remove("hidden", "sm:block");
    loginBtn.classList.remove("hidden");
    addLessonBtn.classList.add("hidden");
    addLessonBtn.classList.remove("inline-flex");
    manageBtn.classList.add("hidden");
    manageBtn.classList.remove("inline-flex");
    userBadge.classList.add("hidden");
    userBadge.classList.remove("inline-flex");
  }
  renderTimetable();
  renderHistoryList();
  cleanupExpiredLessons();
});


// Đồng bộ dữ liệu thời gian thực
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
  // Nếu Firestore trả về rỗng từ cache cục bộ trong khi đã có bản lưu offline, giữ nguyên lịch đã nạp
  if (snap.empty && state.lessons.length > 0 && (!navigator.onLine || snap.metadata.fromCache)) {
    syncOfflineStatus();
    return;
  }

  state.lessons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTimetable();
  saveOfflineSnapshot();
  cleanupExpiredLessons();

  const status = document.getElementById("syncStatus");
  if (status) {
    if (navigator.onLine && !snap.metadata.fromCache) {
      status.title = "Đã đồng bộ";
      status.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>`;
    } else {
      syncOfflineStatus();
    }
  }
}, () => {
  syncOfflineStatus();
});


// Đồng bộ 50 lịch sử hoạt động gần nhất
const recentLogsQuery = query(logsRef, orderBy("createdAt", "desc"), limit(50));
onSnapshot(recentLogsQuery, (snap) => {
  // Giữ nguyên lịch sử thay đổi đã nạp từ localStorage nếu Firestore trả về rỗng lúc mất mạng
  if (snap.empty && state.logsList.length > 0 && (!navigator.onLine || snap.metadata.fromCache)) {
    return;
  }

  state.logsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateHistoryBadge();
  renderHistoryList();
  saveOfflineSnapshot();
});


let appDialogResolver = null;

function showAppNotice(message, title = "Thông báo") {
  return new Promise((resolve) => {
    appDialogResolver = resolve;
    document.getElementById("appDialogTitle").textContent = title;
    document.getElementById("appDialogMessage").textContent = message;
    document.getElementById("appDialogCancelBtn").classList.add("hidden");
    const okBtn = document.getElementById("appDialogOkBtn");
    okBtn.textContent = "Đã hiểu";
    okBtn.className = "px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl";
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
      ? "px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl"
      : "px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl";
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

// Gắn các hàm ra window để HTML gọi trực tiếp
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
    closeLoginModal();
  } catch (err) {
    errEl.textContent = "Email hoặc mật khẩu không đúng.";
    errEl.classList.remove("hidden");
  }
};

// Lịch sử hoạt động & Khôi phục
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
  const log = state.logsList.find(item => item.id === logId);
  if (!log || !log.lesson) return;

  const snap = log.lesson;
  const startHour = Number(snap.startHour);
  const endHour = startHour + Number(snap.duration || 1.5);
  const existingLesson = log.lessonId ? state.lessons.find(l => l.id === log.lessonId) : null;

  // Bỏ qua chính lịch đang sửa (existingLesson.id) và bỏ qua lịch học bù đã hết hạn sau 23:00
  const conflict = state.lessons.find(l => {
    if (existingLesson && l.id === existingLesson.id) return false;
    const lStatus = l.status || (l.isMakeup ? "makeup" : "normal");
    if (lStatus === "makeup" && isLessonStatusExpired(l)) return false;
    if (l.day !== snap.day || l.room !== snap.room) return false;
    const lStart = Number(l.startHour);
    const lEnd = lStart + Number(l.duration || 1);
    return startHour < lEnd && endHour > lStart;
  });

  if (conflict) {
    await showAppNotice(
      `Không thể khôi phục vì ${snap.room} vào ${DAY_LABELS[snap.day]} (${formatHour(startHour)}–${formatHour(endHour)}) hiện đã có lịch của ${conflict.teacherName}.`,
      "Trùng lịch phòng"
    );
    return;
  }

  const ok = await showAppConfirm(
    `Khôi phục lịch của ${snap.teacherName} tại ${snap.room} (${DAY_LABELS[snap.day]}, ${formatHour(startHour)}) về trạng thái trước đó?`,
    "Khôi phục lịch học",
    "Khôi phục"
  );
  if (!ok) return;

  const restoredStatus = snap.status || (snap.isMakeup ? "makeup" : "normal");
  const payload = {
    teacherName: snap.teacherName,
    room: snap.room,
    subject: snap.subject || "",
    day: snap.day,
    startHour,
    duration: Number(snap.duration || 1.5),
    status: restoredStatus,
    isMakeup: restoredStatus === "makeup",
    targetDate: (restoredStatus === "makeup" || restoredStatus === "off") ? getTargetDateForDay(snap.day) : "",
    note: snap.note || "",
    updatedBy: state.currentUser.email
  };

  if (existingLesson) {
    await updateDoc(doc(db, "lessons", existingLesson.id), payload);
    await writeActivityLog("restore", payload, "Hoàn tác chỉnh sửa", existingLesson.id);
  } else {
    const newRef = await addDoc(lessonsRef, payload);
    await writeActivityLog("restore", payload, "Khôi phục từ lịch sử", newRef.id);
  }
  closeHistoryModal();
};

// Quản lý danh sách
window.openManageModal = function () {
if (!state.currentUser || !navigator.onLine) return;
  if (!state.currentUser) return;
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
    closeRenameModal();
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
    closeRenameModal();
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
  yesBtn.className = "px-4 py-2 text-sm font-bold rounded-xl bg-slate-200 text-slate-400 cursor-not-allowed transition min-w-[96px]";
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
      yesBtn.className = "px-4 py-2 text-sm font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer transition min-w-[96px]";
      yesBtn.onclick = async () => {
        closeConfirmDeleteModal();
        await deleteDoc(doc(db, colName, id));
      };
    }
  }, 1000);
};

// Đăng nhập / Đăng xuất
window.openLoginModal = function () {
  document.getElementById("loginError").classList.add("hidden");
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("loginModal").classList.add("flex");
};

window.closeLoginModal = function () {
  document.getElementById("loginModal").classList.add("hidden");
  document.getElementById("loginModal").classList.remove("flex");
};

window.logoutTeacher = async function () {
  await signOut(auth);
};

window.selectLessonStatus = function (status) {
  const input = document.getElementById("lessonStatus");
  if (input) input.value = status;
  const isNewBooking = !document.getElementById("lessonId")?.value;
  document.querySelectorAll(".status-pill-btn").forEach(btn => {
    const active = btn.dataset.status === status;
    const hideOff = isNewBooking && btn.dataset.status === "off";
    btn.className = `${hideOff ? "hidden " : ""}status-pill-btn py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-bold transition ${
      active
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
    }`;
  });
};

// Đặt / Sửa phòng học
window.openLessonModal = function (lesson = null, defaultDay = TODAY_NAME, defaultHour = 9) {
if (!state.currentUser || !navigator.onLine) return;
  if (!state.currentUser) return;
  
  

  const initialStatus = lesson?.status || (lesson?.isMakeup ? "makeup" : "normal");
selectLessonStatus(initialStatus);

const offBtn = document.getElementById("statusOffBtn");
if (offBtn) {
  offBtn.classList.toggle("hidden", !lesson);
  const grid = offBtn.parentElement;
  if (grid) {
    grid.classList.toggle("grid-cols-2", !lesson);
    grid.classList.toggle("grid-cols-3", Boolean(lesson));
  }
}

  document.getElementById("formError").classList.add("hidden");
  const deleteBtn = document.getElementById("deleteLessonBtn");
  const teacherSelect = document.getElementById("teacherSelectInput");
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

    document.getElementById("roomSelectInput").value = lesson.room || state.roomsList[0]?.name || "";

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
    document.getElementById("roomSelectInput").value = state.roomsList[0]?.name || "";
    subjectSelect.value = "";
    document.getElementById("dayInput").value = defaultDay;
    document.getElementById("startHourInput").value = defaultHour;
    document.getElementById("durationInput").value = 1.5;
    document.getElementById("noteInput").value = "";
    deleteBtn.classList.add("hidden");
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
  const endHour = startHour + duration;

  const errEl = document.getElementById("formError");
  if (!teacherName) {
    errEl.textContent = "Vui lòng chọn giáo viên (hoặc thêm giáo viên trong 'Danh sách' trước).";
    errEl.classList.remove("hidden");
    return;
  }

  const conflict = state.lessons.find(l => {
    if (l.id === id) return false;
    const lStatus = l.status || (l.isMakeup ? "makeup" : "normal");
    if (lStatus === "makeup" && isLessonStatusExpired(l)) return false;
    if (l.day !== day || l.room !== room) return false;
    const lStart = Number(l.startHour);
    const lEnd = lStart + Number(l.duration || 1);
    return startHour < lEnd && endHour > lStart;
  });

  if (conflict) {
    errEl.textContent = `${room} đã có lịch vào ${DAY_LABELS[day]} từ ${formatHour(conflict.startHour)} đến ${formatHour(Number(conflict.startHour) + Number(conflict.duration || 1))} (${conflict.teacherName}).`;
    errEl.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("saveLessonBtn");
  btn.disabled = true;
  btn.textContent = "Đang lưu...";

  try {
    const payload = {
      teacherName,
      room,
      subject,
      day,
      startHour,
      duration,
      status,
      isMakeup: status === "makeup",
      targetDate: (status === "makeup" || status === "off") ? getTargetDateForDay(day) : "",
      note,
      updatedBy: state.currentUser.email
    };
    if (id) {
      const oldLesson = state.lessons.find(l => l.id === id);
      await updateDoc(doc(db, "lessons", id), payload);
      const statusLabels = { normal: "Bình thường", makeup: "Học bù", off: "Báo nghỉ" };
      const detail = oldLesson
        ? `Đổi sang: ${room}, ${DAY_LABELS[day]} ${formatHour(startHour)} (${statusLabels[status] || "Bình thường"})`
        : "";
      await writeActivityLog("update", oldLesson || payload, detail, id);
    } else {
      const createdRef = await addDoc(lessonsRef, payload);
      await writeActivityLog("create", payload, "", createdRef.id);
    }
    closeLessonModal();
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
  await deleteDoc(doc(db, "lessons", id));
  if (target) {
    await writeActivityLog("delete", target);
  }
  closeLessonModal();
};

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
    ["lessonModal", () => window.closeLessonModal?.()],
    ["manageModal", () => window.closeManageModal?.()],
    ["historyModal", () => window.closeHistoryModal?.()],
    ["loginModal", () => window.closeLoginModal?.()]
  ];

  for (const [id, closeFn] of modalClosers) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("hidden")) {
      closeFn();
      break;
    }
  }
});


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
  syncInternetClock
} from "./ui.js";

initHourOptions();

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
});


// Đồng bộ dữ liệu thời gian thực
onSnapshot(roomsRef, (snap) => {
  const customRooms = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  state.roomsList = customRooms.length > 0 ? customRooms : [...DEFAULT_ROOMS];
  syncRoomDropdowns();
  renderManageLists();
  renderTimetable();
});

onSnapshot(teachersRef, (snap) => {
  state.teachersList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  syncTeacherDropdowns();
  renderManageLists();
});

onSnapshot(subjectsRef, (snap) => {
  state.subjectsList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  syncSubjectDropdowns();
  renderManageLists();
});

onSnapshot(lessonsRef, (snap) => {
  state.lessons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  syncRoomDropdowns();
  syncTeacherDropdowns();
  syncSubjectDropdowns();
  renderTimetable();

  const status = document.getElementById("syncStatus");
  status.title = "Đồng bộ thành công";
  status.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>`;
}, () => {
  const status = document.getElementById("syncStatus");
  status.title = "Chưa kết nối / Lỗi mạng";
  status.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>`;
});

// Đồng bộ 50 lịch sử hoạt động gần nhất
const recentLogsQuery = query(logsRef, orderBy("createdAt", "desc"), limit(50));
onSnapshot(recentLogsQuery, (snap) => {
  state.logsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateHistoryBadge();
  renderHistoryList();
});

async function writeActivityLog(action, lessonData, detail = "") {
  try {
    await addDoc(logsRef, {
      action,
      lesson: {
        teacherName: lessonData.teacherName || "",
        room: lessonData.room || "",
        subject: lessonData.subject || "",
        day: lessonData.day || "",
        startHour: Number(lessonData.startHour || 0),
        duration: Number(lessonData.duration || 1.5),
        status: lessonData.status || "normal",
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

  const conflict = state.lessons.find(l => {
    if (l.day !== snap.day || l.room !== snap.room) return false;
    const lStart = Number(l.startHour);
    const lEnd = lStart + Number(l.duration || 1);
    return startHour < lEnd && endHour > lStart;
  });

  if (conflict) {
    alert(`Không thể khôi phục vì ${snap.room} vào ${DAY_LABELS[snap.day]} (${formatHour(startHour)}–${formatHour(endHour)}) hiện đã có lịch của ${conflict.teacherName}.`);
    return;
  }

  if (!confirm(`Khôi phục lịch của ${snap.teacherName} tại ${snap.room} (${DAY_LABELS[snap.day]}, ${formatHour(startHour)})?`)) return;

  const payload = {
    teacherName: snap.teacherName,
    room: snap.room,
    subject: snap.subject || "",
    day: snap.day,
    startHour,
    duration: Number(snap.duration || 1.5),
    status: snap.status || "normal",
    note: snap.note || "",
    updatedBy: state.currentUser.email
  };

  await addDoc(lessonsRef, payload);
  await writeActivityLog("restore", payload, "Khôi phục từ lịch sử");
  closeHistoryModal();
};

// Quản lý danh sách
window.openManageModal = function () {
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
    alert(`Phòng "${name}" đã tồn tại trong danh sách!`);
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
    alert(`Giáo viên "${name}" đã có trong danh sách!`);
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
    alert(`Môn học "${name}" đã có trong danh sách!`);
    return;
  }

  await addDoc(subjectsRef, { name });
  input.value = "";
};

window.renameManageItem = async function (colName, id) {
  if (!state.currentUser) return;

  const listMap = {
    rooms:    { list: state.roomsList,    field: "room",        label: "tên phòng" },
    teachers: { list: state.teachersList, field: "teacherName", label: "tên giáo viên" },
    subjects: { list: state.subjectsList, field: "subject",     label: "tên môn học" }
  };

  const target = listMap[colName];
  if (!target) return;

  const item = target.list.find(x => x.id === id);
  if (!item) return;

  const input = prompt(`Nhập ${target.label} mới:`, item.name);
  if (input === null) return;

  const newName = input.trim();
  if (!newName || newName === item.name) return;

  const duplicate = target.list.some(
    x => x.id !== id && x.name.toLowerCase() === newName.toLowerCase()
  );
  if (duplicate) {
    alert(`Tên "${newName}" đã tồn tại trong danh sách.`);
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
  } catch (err) {
    alert("Lỗi cập nhật tên: " + err.message);
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
  document.querySelectorAll(".status-pill-btn").forEach(btn => {
    const active = btn.dataset.status === status;
    btn.className = active
      ? "status-pill-btn py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-bold transition bg-slate-900 text-white border-slate-900"
      : "status-pill-btn py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-bold transition bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
  });
};

// Đặt / Sửa phòng học
window.openLessonModal = function (lesson = null, defaultDay = TODAY_NAME, defaultHour = 9) {
  if (!state.currentUser) return;

  const initialStatus = lesson?.status || (lesson?.isMakeup ? "makeup" : "normal");
  selectLessonStatus(initialStatus);

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
      note,
      updatedBy: state.currentUser.email
    };
    if (id) {
      const oldLesson = state.lessons.find(l => l.id === id);
      await updateDoc(doc(db, "lessons", id), payload);
      const detail = oldLesson
        ? `Trước sửa: ${oldLesson.room}, ${DAY_LABELS[oldLesson.day]} ${formatHour(oldLesson.startHour)}`
        : "";
      await writeActivityLog("update", payload, detail);
    } else {
      await addDoc(lessonsRef, payload);
      await writeActivityLog("create", payload);
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
  if (!confirm("Bạn có chắc muốn xóa lịch phòng này không?")) return;

  const target = state.lessons.find(l => l.id === id);
  await deleteDoc(doc(db, "lessons", id));
  if (target) {
    await writeActivityLog("delete", target);
  }
  closeLessonModal();
};

syncInternetClock().then(() => renderTimetable());
setInterval(() => {
  renderTimetable();
}, 60 * 1000);

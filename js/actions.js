import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db, lessonsRef, roomsRef, teachersRef, subjectsRef } from "./firebase.js";
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
  renderManageLists
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

  if (user) {
    loginBtn.classList.add("hidden");
    addLessonBtn.classList.remove("hidden");
    addLessonBtn.classList.add("inline-flex");
    manageBtn.classList.remove("hidden");
    manageBtn.classList.add("inline-flex");
    userBadge.classList.remove("hidden");
    userBadge.classList.add("inline-flex");
    userEmailLabel.textContent = user.email;
  } else {
    loginBtn.classList.remove("hidden");
    addLessonBtn.classList.add("hidden");
    addLessonBtn.classList.remove("inline-flex");
    manageBtn.classList.add("hidden");
    manageBtn.classList.remove("inline-flex");
    userBadge.classList.add("hidden");
    userBadge.classList.remove("inline-flex");
  }
  renderTimetable();
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

// Gắn các hàm ra window để HTML gọi trực tiếp
window.renderTimetable = renderTimetable;

window.jumpToToday = function () {
  state.selectedMobileDay = TODAY_NAME;
  renderTimetable();
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

window.deleteManageItem = async function (colName, id) {
  if (!state.currentUser) return;
  await deleteDoc(doc(db, colName, id));
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

window.handleLogin = async function (e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginSubmitBtn");

  btn.disabled = true;
  btn.textContent = "Đang đăng nhập...";
  errEl.classList.add("hidden");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeLoginModal();
  } catch (err) {
    errEl.textContent = "Sai email hoặc mật khẩu.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Đăng nhập";
  }
};

window.logoutTeacher = async function () {
  await signOut(auth);
};

// Đặt / Sửa phòng học
window.openLessonModal = function (lesson = null, defaultDay = TODAY_NAME, defaultHour = 9) {
  if (!state.currentUser) return;
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
    document.getElementById("durationInput").value = lesson.duration ?? 1;
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
    const payload = { teacherName, room, subject, day, startHour, duration, note, updatedBy: state.currentUser.email };
    if (id) {
      await updateDoc(doc(db, "lessons", id), payload);
    } else {
      await addDoc(lessonsRef, payload);
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
  await deleteDoc(doc(db, "lessons", id));
  closeLessonModal();
};

export const COLOR_PALETTE = {
  blue:    { card: "bg-blue-50 border-blue-200 text-blue-950 hover:border-blue-400",          badge: "bg-blue-100 text-blue-800",       dot: "bg-blue-100 border-blue-300" },
  emerald: { card: "bg-emerald-50 border-emerald-200 text-emerald-950 hover:border-emerald-400", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-100 border-emerald-300" },
  amber:   { card: "bg-amber-50 border-amber-200 text-amber-950 hover:border-amber-400",      badge: "bg-amber-100 text-amber-800",     dot: "bg-amber-100 border-amber-300" },
  purple:  { card: "bg-purple-50 border-purple-200 text-purple-950 hover:border-purple-400",  badge: "bg-purple-100 text-purple-800",   dot: "bg-purple-100 border-purple-300" },
  rose:    { card: "bg-rose-50 border-rose-200 text-rose-950 hover:border-rose-400",          badge: "bg-rose-100 text-rose-800",       dot: "bg-rose-100 border-rose-300" },
  cyan:    { card: "bg-cyan-50 border-cyan-200 text-cyan-950 hover:border-cyan-400",          badge: "bg-cyan-100 text-cyan-800",       dot: "bg-cyan-100 border-cyan-300" }
};

export const DEFAULT_ROOMS = [
  { id: "def-1", name: "Phòng 1", color: "blue", isDefault: true },
  { id: "def-2", name: "Phòng 2", color: "emerald", isDefault: true },
  { id: "def-3", name: "Phòng 3", color: "amber", isDefault: true },
  { id: "def-4", name: "Phòng 4", color: "purple", isDefault: true }
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DAY_LABELS = {
  Monday: "Thứ 2",
  Tuesday: "Thứ 3",
  Wednesday: "Thứ 4",
  Thursday: "Thứ 5",
  Friday: "Thứ 6",
  Saturday: "Thứ 7",
  Sunday: "Chủ Nhật"
};
export const DAY_SHORT = {
  Monday: "T2",
  Tuesday: "T3",
  Wednesday: "T4",
  Thursday: "T5",
  Friday: "T6",
  Saturday: "T7",
  Sunday: "CN"
};

export const HOURS = Array.from({ length: 28 }, (_, i) => 6.5 + i * 0.5);

const JS_DAY_MAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const TODAY_NAME = JS_DAY_MAP[new Date().getDay()];

export const state = {
  lessons: [],
  roomsList: [...DEFAULT_ROOMS],
  teachersList: [],
  subjectsList: [],
  logsList: [],
  currentUser: null,
  selectedMobileDay: TODAY_NAME
};

export function formatHour(hourFloat) {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRoomTheme(roomName) {
  const found = state.roomsList.find(r => r.name === roomName);
  return COLOR_PALETTE[found?.color] || COLOR_PALETTE.blue;
}

export function initHourOptions() {
  const startHourSelect = document.getElementById("startHourInput");
  startHourSelect.innerHTML = "";
  HOURS.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = formatHour(h);
    startHourSelect.appendChild(opt);
  });
}

export function syncRoomDropdowns() {
  const filterSelect = document.getElementById("roomFilter");
  const bookingSelect = document.getElementById("roomSelectInput");
  const currentFilter = filterSelect.value;

  const bookedRoomNames = [...new Set(state.lessons.map(l => l.room).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  filterSelect.innerHTML = `<option value="ALL">Tất cả các phòng</option>`;
  bookedRoomNames.forEach(roomName => {
    const opt = document.createElement("option");
    opt.value = roomName;
    opt.textContent = roomName;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = bookedRoomNames.includes(currentFilter) ? currentFilter : "ALL";

  bookingSelect.innerHTML = "";
  state.roomsList.forEach(room => {
    const opt2 = document.createElement("option");
    opt2.value = room.name;
    opt2.textContent = room.name;
    bookingSelect.appendChild(opt2);
  });
}

export function syncTeacherDropdowns() {
  const filterSelect = document.getElementById("teacherFilter");
  const bookingSelect = document.getElementById("teacherSelectInput");
  const currentFilter = filterSelect.value;

  const bookedTeachers = [...new Set(state.lessons.map(l => l.teacherName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  filterSelect.innerHTML = `<option value="ALL">Tất cả Giáo Viên</option>`;
  bookedTeachers.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = bookedTeachers.includes(currentFilter) ? currentFilter : "ALL";

  const allManagedTeachers = [...new Set([
    ...state.teachersList.map(t => t.name),
    ...bookedTeachers
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));

  bookingSelect.innerHTML = "";
  if (allManagedTeachers.length === 0) {
    bookingSelect.innerHTML = `<option value="">-- Thêm giáo viên ở Danh sách trước --</option>`;
  } else {
    allManagedTeachers.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      bookingSelect.appendChild(opt);
    });
  }
}

export function syncSubjectDropdowns() {
  const filterSelect = document.getElementById("subjectFilter");
  const bookingSelect = document.getElementById("subjectSelectInput");
  const currentFilter = filterSelect.value;

  const bookedSubjects = [...new Set(state.lessons.map(l => l.subject).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  filterSelect.innerHTML = `<option value="ALL">Tất cả môn học</option>`;
  bookedSubjects.forEach(subName => {
    const opt = document.createElement("option");
    opt.value = subName;
    opt.textContent = subName;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = bookedSubjects.includes(currentFilter) ? currentFilter : "ALL";

  const allManagedSubjects = [...new Set([
    ...state.subjectsList.map(s => s.name),
    ...bookedSubjects
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));

  bookingSelect.innerHTML = `<option value="">-- Không chọn môn --</option>`;
  allManagedSubjects.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    bookingSelect.appendChild(opt);
  });
}

export function renderTimetable() {
  const roomFilter = document.getElementById("roomFilter").value;
  const teacherFilter = document.getElementById("teacherFilter").value;
  const subjectFilter = document.getElementById("subjectFilter").value;

  // Cập nhật huy hiệu số lượng bộ lọc đang bật & nút Xóa lọc
  const activeCount = [roomFilter, teacherFilter, subjectFilter].filter(v => v !== "ALL").length;
  const filterBadge = document.getElementById("activeFilterBadge");
  const resetBtn = document.getElementById("resetFilterBtn");
  if (filterBadge) {
    filterBadge.textContent = activeCount;
    filterBadge.classList.toggle("hidden", activeCount === 0);
  }
  if (resetBtn) {
    resetBtn.classList.toggle("hidden", activeCount === 0);
  }

  const filtered = state.lessons.filter(l => {
    if (roomFilter !== "ALL" && l.room !== roomFilter) return false;
    if (teacherFilter !== "ALL" && l.teacherName !== teacherFilter) return false;
    if (subjectFilter !== "ALL" && (l.subject || "") !== subjectFilter) return false;
    return true;
  });

  // Tô sáng tiêu đề ngày hôm nay trên bảng máy tính
  DAYS.forEach(day => {
    const th = document.getElementById(`th-${day}`);
    if (!th) return;
    const borderClass = day === "Sunday" ? "" : "border-r border-slate-200";
    if (day === TODAY_NAME) {
      th.className = `py-3 px-2 text-center ${borderClass} bg-amber-50/90 text-amber-950 font-bold`;
      th.innerHTML = `${DAY_LABELS[day]} <span class="block text-xs font-semibold text-amber-700 normal-case">Hôm nay</span>`;
    } else {
      th.className = `py-3.5 px-2 text-center ${borderClass} bg-slate-50`;
      th.textContent = DAY_LABELS[day];
    }
  });

  const tbody = document.getElementById("desktopGridBody");
  tbody.innerHTML = "";

  HOURS.forEach(hour => {
    const tr = document.createElement("tr");
    tr.className = "divide-x divide-slate-200";

    const timeTd = document.createElement("td");
    timeTd.className = "py-3 px-2 text-center text-sm font-semibold text-slate-600 bg-slate-50/60 align-top";
    timeTd.textContent = formatHour(hour);
    tr.appendChild(timeTd);

    DAYS.forEach(day => {
      const td = document.createElement("td");
      const isToday = day === TODAY_NAME;
      td.className = `p-2 align-top min-h-[68px] transition ${
        isToday
          ? (state.currentUser ? "bg-amber-50/40 hover:bg-amber-50/80 cursor-pointer" : "bg-amber-50/35")
          : (state.currentUser ? "hover:bg-slate-50 cursor-pointer" : "")
      }`;

      if (state.currentUser) {
        td.onclick = (e) => {
          if (e.target === td) window.openLessonModal(null, day, hour);
        };
      }

      const slotLessons = filtered
        .filter(l => l.day === day && Number(l.startHour) === hour)
        .sort((a, b) => a.room.localeCompare(b.room, "vi"));

      const stack = document.createElement("div");
      stack.className = "space-y-2";

      slotLessons.forEach(lesson => {
        const card = document.createElement("div");
        const theme = getRoomTheme(lesson.room);
        const endHour = Number(lesson.startHour) + Number(lesson.duration || 1);

        card.className = `p-2.5 rounded-xl border text-left transition ${theme.card} ${state.currentUser ? "cursor-pointer shadow-2xs" : ""}`;
        if (state.currentUser) {
          card.onclick = (e) => {
            e.stopPropagation();
            window.openLessonModal(lesson);
          };
        }

        card.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <span class="text-xs font-bold px-2 py-0.5 rounded-md truncate max-w-full ${theme.badge}">${escapeHtml(lesson.room)}</span>
            <span class="text-xs font-medium opacity-80 whitespace-nowrap">${formatHour(lesson.startHour)}–${formatHour(endHour)}</span>
          </div>
          <div class="font-bold text-sm leading-snug">${escapeHtml(lesson.teacherName)}</div>
          ${lesson.subject ? `<div class="text-xs opacity-85 truncate mt-0.5">${escapeHtml(lesson.subject)}</div>` : ""}
          ${lesson.note ? `<div class="mt-1.5 inline-block text-xs font-medium px-2 py-0.5 rounded-md bg-white/85 text-slate-800 border border-black/10 max-w-full truncate">📝 ${escapeHtml(lesson.note)}</div>` : ""}
        `;
        stack.appendChild(card);
      });

      td.appendChild(stack);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  renderMobileView(filtered);
}

function renderMobileView(filtered) {
  const tabsContainer = document.getElementById("mobileDayTabs");
  tabsContainer.innerHTML = "";

  DAYS.forEach(day => {
    const btn = document.createElement("button");
    const active = day === state.selectedMobileDay;
    const isToday = day === TODAY_NAME;

    btn.className = `py-2.5 rounded-xl text-sm font-bold text-center transition flex flex-col items-center justify-center ${
      active
        ? "bg-slate-900 text-white shadow-xs"
        : isToday
          ? "bg-amber-50 text-amber-900 border border-amber-300"
          : "bg-white text-slate-600 border border-slate-200"
    }`;
    btn.innerHTML = `<span>${DAY_SHORT[day]}</span>${isToday ? `<span class="w-1.5 h-1.5 rounded-full mt-0.5 ${active ? "bg-amber-400" : "bg-amber-600"}"></span>` : ""}`;
    btn.onclick = () => {
      state.selectedMobileDay = day;
      renderTimetable();
    };
    tabsContainer.appendChild(btn);
  });

  const todayBtn = document.getElementById("mobileTodayBtn");
  if (todayBtn) {
    const isAlreadyToday = state.selectedMobileDay === TODAY_NAME;
    todayBtn.disabled = isAlreadyToday;
    todayBtn.className = isAlreadyToday
      ? "shrink-0 px-3.5 rounded-xl text-sm font-bold border border-slate-200 bg-slate-100 text-slate-400 whitespace-nowrap flex items-center justify-center"
      : "shrink-0 px-3.5 rounded-xl text-sm font-bold border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 active:scale-95 transition whitespace-nowrap flex items-center justify-center";
  }

  const list = document.getElementById("mobileAgendaList");
  const dayLessons = filtered
    .filter(l => l.day === state.selectedMobileDay)
    .sort((a, b) => Number(a.startHour) - Number(b.startHour) || a.room.localeCompare(b.room, "vi"));

  if (dayLessons.length === 0) {
    list.innerHTML = `<div class="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-base text-slate-400">Không có lịch học vào ${DAY_LABELS[state.selectedMobileDay]}.</div>`;
    return;
  }

  list.innerHTML = "";
  dayLessons.forEach(lesson => {
    const theme = getRoomTheme(lesson.room);
    const endHour = Number(lesson.startHour) + Number(lesson.duration || 1);

    const item = document.createElement("div");
    item.className = `p-4 rounded-2xl border ${theme.card} flex items-start justify-between gap-3 ${state.currentUser ? "cursor-pointer active:scale-[0.99]" : ""}`;
    if (state.currentUser) {
      item.onclick = () => window.openLessonModal(lesson);
    }
    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${theme.badge}">${escapeHtml(lesson.room)}</span>
          <span class="text-sm font-semibold text-slate-700 whitespace-nowrap">${formatHour(lesson.startHour)} – ${formatHour(endHour)}</span>
        </div>
        <div class="font-bold text-base text-slate-900 truncate">${escapeHtml(lesson.teacherName)}</div>
        ${lesson.subject ? `<div class="text-sm text-slate-600 mt-0.5 truncate">${escapeHtml(lesson.subject)}</div>` : ""}
        ${lesson.note ? `<div class="mt-2 inline-block text-xs font-medium px-2.5 py-1 rounded-lg bg-white/90 text-slate-800 border border-black/10 max-w-full truncate">📝 ${escapeHtml(lesson.note)}</div>` : ""}
      </div>
      ${state.currentUser ? `
        <span class="p-2 rounded-xl bg-white/80 text-slate-700 shrink-0" title="Chỉnh sửa">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>` : ""}
    `;
    list.appendChild(item);
  });
}

export function renderManageLists() {
  const rList = document.getElementById("manageRoomsList");
  rList.innerHTML = "";
  state.roomsList.forEach(r => {
    const theme = COLOR_PALETTE[r.color] || COLOR_PALETTE.blue;
    const row = document.createElement("div");
    row.className = "flex items-center justify-between px-3.5 py-3 text-sm";
    row.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-3.5 h-3.5 rounded-sm border shrink-0 ${theme.dot}"></span>
        <span class="font-medium text-slate-800 truncate">${escapeHtml(r.name)}</span>
      </div>
      ${r.isDefault
        ? `<span class="text-xs text-slate-400 shrink-0">Mặc định</span>`
        : `<button onclick="deleteManageItem('rooms', '${r.id}')" class="text-xs font-semibold text-red-600 hover:underline shrink-0 ml-2">Xóa</button>`}
    `;
    rList.appendChild(row);
  });

  const tList = document.getElementById("manageTeachersList");
  tList.innerHTML = state.teachersList.length === 0
    ? `<div class="p-4 text-center text-sm text-slate-400">Chưa có giáo viên nào. Hãy thêm ở ô phía trên.</div>`
    : "";
  state.teachersList.forEach(t => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between px-3.5 py-3 text-sm";
    row.innerHTML = `
      <span class="font-medium text-slate-800 truncate">${escapeHtml(t.name)}</span>
      <button onclick="deleteManageItem('teachers', '${t.id}')" class="text-xs font-semibold text-red-600 hover:underline shrink-0 ml-2">Xóa</button>
    `;
    tList.appendChild(row);
  });

  const sList = document.getElementById("manageSubjectsList");
  sList.innerHTML = state.subjectsList.length === 0
    ? `<div class="p-4 text-center text-sm text-slate-400">Chưa có môn học nào. Hãy thêm ở ô phía trên.</div>`
    : "";
  state.subjectsList.forEach(s => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between px-3.5 py-3 text-sm";
    row.innerHTML = `
      <span class="font-medium text-slate-800 truncate">${escapeHtml(s.name)}</span>
      <button onclick="deleteManageItem('subjects', '${s.id}')" class="text-xs font-semibold text-red-600 hover:underline shrink-0 ml-2">Xóa</button>
    `;
    sList.appendChild(row);
  });
}

function formatLogTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} • ${dd}/${mo}`;
}

export function updateHistoryBadge() {
  const badge = document.getElementById("historyBadge");
  if (!badge) return;
  const lastSeen = Number(localStorage.getItem("tkb_last_seen_log") || 0);
  const unreadCount = (state.logsList || []).filter(item => (item.createdAt || 0) > lastSeen).length;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
    badge.classList.remove("hidden");
    badge.classList.add("inline-flex");
  } else {
    badge.classList.add("hidden");
    badge.classList.remove("inline-flex");
  }
}

export function renderHistoryList() {
  const container = document.getElementById("historyList");
  if (!container) return;

  const logs = state.logsList || [];
  if (logs.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-sm text-slate-400 border border-slate-200 rounded-xl">Chưa có lịch sử hoạt động nào.</div>`;
    return;
  }

  const ACTION_META = {
    create:  { label: "Đặt mới",   cls: "bg-emerald-100 text-emerald-800" },
    update:  { label: "Chỉnh sửa", cls: "bg-amber-100 text-amber-800" },
    delete:  { label: "Đã xóa",    cls: "bg-red-100 text-red-800" },
    restore: { label: "Khôi phục", cls: "bg-blue-100 text-blue-800" }
  };

  container.innerHTML = "";
  logs.forEach(log => {
    const meta = ACTION_META[log.action] || ACTION_META.create;
    const snap = log.lesson || {};
    const endHour = Number(snap.startHour || 0) + Number(snap.duration || 1.5);
    const canRestore = state.currentUser && (log.action === "delete" || log.action === "update") && snap.room;

    const card = document.createElement("div");
    card.className = "p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5";
    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold px-2 py-0.5 rounded-md ${meta.cls}">${meta.label}</span>
        <span class="text-xs text-slate-500 font-medium">${formatLogTime(log.createdAt)}</span>
      </div>
      <div class="text-sm font-bold text-slate-900">
        ${escapeHtml(snap.teacherName || "")} • ${escapeHtml(snap.room || "")}
      </div>
      <div class="text-xs sm:text-sm text-slate-700">
        ${DAY_LABELS[snap.day] || snap.day || ""} (${formatHour(snap.startHour || 0)} – ${formatHour(endHour)})${snap.subject ? ` • ${escapeHtml(snap.subject)}` : ""}
      </div>
      ${log.detail ? `<div class="text-xs text-slate-500 italic">${escapeHtml(log.detail)}</div>` : ""}
      ${state.currentUser ? `
        <div class="pt-1 flex items-center justify-between gap-2">
          <span class="text-[11px] text-slate-400 truncate">Bởi: ${escapeHtml(log.by || "Giáo viên")}</span>
          ${canRestore ? `<button onclick="restoreFromLog('${log.id}')" class="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition shrink-0">Khôi phục</button>` : ""}
        </div>
      ` : ""}
    `;
    container.appendChild(card);
  });
}

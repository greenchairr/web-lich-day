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

// Icon SVG đơn sắc dùng chung trong giao diện
const ICON_CLOCK = `<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
const ICON_BAN = `<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>`;
const ICON_NOTE = `<svg class="w-3 h-3 shrink-0 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`;

let serverTimeOffsetMs = 0;

export async function syncInternetClock() {
  try {
    const res = await fetch("https://www.gstatic.com/generate_204", {
      method: "HEAD",
      cache: "no-store"
    });
    const dateHeader = res.headers.get("Date");
    if (dateHeader) {
      serverTimeOffsetMs = new Date(dateHeader).getTime() - Date.now();
    }
  } catch (_) {
    try {
      const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Ho_Chi_Minh");
      const data = await res.json();
      if (data?.unixtime) {
        serverTimeOffsetMs = data.unixtime * 1000 - Date.now();
      }
    } catch (_) {}
  }
}

export function getVietnamNowInfo() {
  const trueUtcMs = Date.now() + serverTimeOffsetMs;
  const vnDate = new Date(trueUtcMs + 7 * 3600 * 1000);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[vnDate.getUTCDay()];
  const currentHour = vnDate.getUTCHours() + vnDate.getUTCMinutes() / 60;
  const dateStr = vnDate.toISOString().slice(0, 10);
  return { dayName, currentHour, dateStr };
}

export function isLessonStatusExpired(lesson) {
  const status = lesson.status || (lesson.isMakeup ? "makeup" : "normal");
  if (status !== "makeup" && status !== "off") return false;

  const { dayName, currentHour, dateStr } = getVietnamNowInfo();
  if (lesson.targetDate) {
    if (dateStr > lesson.targetDate) return true;
    if (dateStr === lesson.targetDate && currentHour >= 23) return true;
    return false;
  }

  return lesson.day === dayName && currentHour >= 23;
}

// Lấy trạng thái hiệu lực của 1 buổi học (đã tính mốc 23:00)
export function getEffectiveStatus(lesson) {
  if (!lesson) return "normal";
  const rawStatus = lesson.status || (lesson.isMakeup ? "makeup" : "normal");
  if (rawStatus === "normal") return "normal";
  if (isLessonStatusExpired(lesson)) {
    return rawStatus === "makeup" ? "expired_makeup" : "normal";
  }
  return rawStatus; // "makeup" hoặc "off"
}

// Trả về true nếu khung giờ của ca "off" đã có ca Cố định hoặc Tạm thời đặt đè vào
export function isOffSlotClaimed(offLesson, allLessons) {
  const start = Number(offLesson.startHour);
  const end = start + Number(offLesson.duration || 1.5);

  return allLessons.some((l) => {
    if (l.id === offLesson.id) return false;
    if (l.room !== offLesson.room || l.day !== offLesson.day) return false;

    const st = getEffectiveStatus(l);
    if (st === "off" || st === "expired_makeup") return false;

    const lStart = Number(l.startHour);
    const lEnd = lStart + Number(l.duration || 1.5);
    return start < lEnd && end > lStart;
  });
}

function getLessonStatusMeta(lesson) {
  const { dayName: todayName, currentHour } = getVietnamNowInfo();
  const endHour = Number(lesson.startHour) + Number(lesson.duration || 1.5);
  const status = getEffectiveStatus(lesson);

  const isToday = lesson.day === todayName;
  const isOngoing = isToday && status !== "off" && currentHour >= Number(lesson.startHour) && currentHour < endHour;
  const isFinished = isToday && currentHour >= endHour;

  const badgesHtml = [
    isOngoing ? `<span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>Đang học</span>` : "",
    isFinished && status !== "off" ? `<span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600">Đã xong</span>` : "",
    status === "makeup" ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">${ICON_CLOCK}<span>Tạm thời</span></span>` : "",
    status === "off" ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">${ICON_BAN}<span>Nghỉ</span></span>` : ""
  ].filter(Boolean).join(" ");

  const cardStateClass = status === "off"
    ? "opacity-75 border-dashed"
    : isFinished
      ? "opacity-60"
      : isOngoing
        ? "ring-2 ring-emerald-500 shadow-md"
        : "";

  const textStateClass = status === "off" ? " text-slate-500" : "";

  return { endHour, badgesHtml, cardStateClass, textStateClass };
}

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
  if (!startHourSelect) return;
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
  if (!filterSelect || !bookingSelect) return;
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
  if (!filterSelect || !bookingSelect) return;
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

  const managedTeachers = [...new Set(state.teachersList.map(t => t.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  bookingSelect.innerHTML = "";
  if (managedTeachers.length === 0) {
    bookingSelect.innerHTML = `<option value="">-- Thêm giáo viên ở Danh sách trước --</option>`;
  } else {
    managedTeachers.forEach(name => {
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
  if (!filterSelect || !bookingSelect) return;
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

  const managedSubjects = [...new Set(state.subjectsList.map(s => s.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "vi"));

  bookingSelect.innerHTML = `<option value="">-- Không chọn môn --</option>`;
  managedSubjects.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    bookingSelect.appendChild(opt);
  });
}

export function renderTimetable() {
  const roomFilter = document.getElementById("roomFilter")?.value || "ALL";
  const teacherFilter = document.getElementById("teacherFilter")?.value || "ALL";
  const subjectFilter = document.getElementById("subjectFilter")?.value || "ALL";

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
    if (getEffectiveStatus(l) === "expired_makeup") return false;
    if (roomFilter !== "ALL" && l.room !== roomFilter) return false;
    if (teacherFilter !== "ALL" && l.teacherName !== teacherFilter) return false;
    if (subjectFilter !== "ALL" && (l.subject || "") !== subjectFilter) return false;
    return true;
  });

  const { dayName: todayName } = getVietnamNowInfo();

  DAYS.forEach(day => {
    const th = document.getElementById(`th-${day}`);
    if (!th) return;
    const borderClass = day === "Sunday" ? "" : "border-r border-slate-200";
    if (day === todayName) {
      th.className = `py-3 px-2 text-center ${borderClass} bg-amber-50/90 text-amber-950 font-bold`;
      th.innerHTML = `${DAY_LABELS[day]} <span class="block text-xs font-semibold text-amber-700 normal-case">Hôm nay</span>`;
    } else {
      th.className = `py-3.5 px-2 text-center ${borderClass} bg-slate-50`;
      th.textContent = DAY_LABELS[day];
    }
  });

  const tbody = document.getElementById("desktopGridBody");
  if (tbody) {
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
        const isToday = day === todayName;
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
          const { endHour, badgesHtml, cardStateClass, textStateClass } = getLessonStatusMeta(lesson);
          const displayNote = ((lesson.status === "off") && isLessonStatusExpired(lesson)) ? "" : (lesson.note || "");

          card.className = `p-2.5 rounded-xl border text-left transition ${theme.card} ${cardStateClass} ${state.currentUser ? "cursor-pointer shadow-2xs" : ""}`;
          if (state.currentUser) {
            card.onclick = (e) => {
              e.stopPropagation();
              window.handleLessonCardClick(lesson);
            };
          }

          card.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <span class="text-xs font-bold px-2 py-0.5 rounded-md truncate max-w-full ${theme.badge}">${escapeHtml(lesson.room)}</span>
              <span class="text-xs font-medium opacity-80 whitespace-nowrap">${formatHour(lesson.startHour)}–${formatHour(endHour)}</span>
            </div>
            ${badgesHtml ? `<div class="flex flex-wrap gap-1 mb-1.5">${badgesHtml}</div>` : ""}
            <div class="font-bold text-sm leading-snug ${textStateClass}">${escapeHtml(lesson.teacherName)}</div>
            ${lesson.subject ? `<div class="text-xs opacity-85 truncate mt-0.5 ${textStateClass}">${escapeHtml(lesson.subject)}</div>` : ""}
            ${displayNote ? `<div class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-white/85 text-slate-800 border border-black/10 max-w-full">${ICON_NOTE}<span class="truncate">${escapeHtml(displayNote)}</span></div>` : ""}
          `;
          stack.appendChild(card);
        });

        td.appendChild(stack);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  renderMobileView(filtered);
}

function renderMobileView(filtered) {
  const tabsContainer = document.getElementById("mobileDayTabs");
  if (!tabsContainer) return;
  tabsContainer.innerHTML = "";
  const { dayName: todayName } = getVietnamNowInfo();

  DAYS.forEach(day => {
    const btn = document.createElement("button");
    const active = day === state.selectedMobileDay;
    const isToday = day === todayName;

    btn.className = `h-12 rounded-xl text-sm font-bold text-center transition flex flex-col items-center justify-center ${
      active
        ? "bg-slate-900 text-white shadow-xs"
        : isToday
          ? "bg-amber-50 text-amber-900 border border-amber-300"
          : "bg-white text-slate-600 border border-slate-200"
    }`;
    btn.innerHTML = `<span>${DAY_SHORT[day]}</span><span class="w-1.5 h-1.5 rounded-full mt-0.5 ${
      isToday ? (active ? "bg-amber-400" : "bg-amber-600") : "opacity-0"
    }"></span>`;
    btn.onclick = () => {
      state.selectedMobileDay = day;
      renderTimetable();
    };
    tabsContainer.appendChild(btn);
  });

  const todayBtn = document.getElementById("mobileTodayBtn");
  if (todayBtn) {
    const isAlreadyToday = state.selectedMobileDay === todayName;
    todayBtn.disabled = isAlreadyToday;
    todayBtn.className = isAlreadyToday
      ? "shrink-0 px-3.5 rounded-xl text-sm font-bold border border-slate-200 bg-slate-100 text-slate-400 whitespace-nowrap flex items-center justify-center"
      : "shrink-0 px-3.5 rounded-xl text-sm font-bold border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 active:scale-95 transition whitespace-nowrap flex items-center justify-center";
  }

  const list = document.getElementById("mobileAgendaList");
  if (!list) return;
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
    const { endHour, badgesHtml, cardStateClass, textStateClass } = getLessonStatusMeta(lesson);
    const displayNote = ((lesson.status === "off") && isLessonStatusExpired(lesson)) ? "" : (lesson.note || "");

    const item = document.createElement("div");
    item.className = `p-4 rounded-2xl border ${theme.card} ${cardStateClass} flex items-start justify-between gap-3 ${state.currentUser ? "cursor-pointer active:scale-[0.99]" : ""}`;
    if (state.currentUser) {
      item.onclick = () => window.handleLessonCardClick(lesson);
    }
    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${theme.badge}">${escapeHtml(lesson.room)}</span>
          <span class="text-sm font-semibold text-slate-700 whitespace-nowrap">${formatHour(lesson.startHour)} – ${formatHour(endHour)}</span>
          ${badgesHtml}
        </div>
        <div class="font-bold text-base text-slate-900 truncate ${textStateClass}">${escapeHtml(lesson.teacherName)}</div>
        ${lesson.subject ? `<div class="text-sm text-slate-600 mt-0.5 truncate ${textStateClass}">${escapeHtml(lesson.subject)}</div>` : ""}
        ${displayNote ? `<div class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/90 text-slate-800 border border-black/10 max-w-full">${ICON_NOTE}<span class="truncate">${escapeHtml(displayNote)}</span></div>` : ""}
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
  if (rList) {
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
          : `<div class="flex items-center gap-3 shrink-0 ml-2">
              <button onclick="renameManageItem('rooms', '${r.id}')" class="text-xs font-semibold text-blue-600 hover:underline">Sửa</button>
              <button onclick="deleteManageItem('rooms', '${r.id}')" class="text-xs font-semibold text-red-600 hover:underline">Xóa</button>
            </div>`}
      `;
      rList.appendChild(row);
    });
  }

  const tList = document.getElementById("manageTeachersList");
  if (tList) {
    tList.innerHTML = state.teachersList.length === 0
      ? `<div class="p-4 text-center text-sm text-slate-400">Chưa có giáo viên nào. Hãy thêm ở ô phía trên.</div>`
      : "";
    state.teachersList.forEach(t => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between px-3.5 py-3 text-sm";
      row.innerHTML = `
        <span class="font-medium text-slate-800 truncate">${escapeHtml(t.name)}</span>
        <div class="flex items-center gap-3 shrink-0 ml-2">
          <button onclick="renameManageItem('teachers', '${t.id}')" class="text-xs font-semibold text-blue-600 hover:underline">Sửa</button>
          <button onclick="deleteManageItem('teachers', '${t.id}')" class="text-xs font-semibold text-red-600 hover:underline">Xóa</button>
        </div>
      `;
      tList.appendChild(row);
    });
  }

  const sList = document.getElementById("manageSubjectsList");
  if (sList) {
    sList.innerHTML = state.subjectsList.length === 0
      ? `<div class="p-4 text-center text-sm text-slate-400">Chưa có môn học nào. Hãy thêm ở ô phía trên.</div>`
      : "";
    state.subjectsList.forEach(s => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between px-3.5 py-3 text-sm";
      row.innerHTML = `
        <span class="font-medium text-slate-800 truncate">${escapeHtml(s.name)}</span>
        <div class="flex items-center gap-3 shrink-0 ml-2">
          <button onclick="renameManageItem('subjects', '${s.id}')" class="text-xs font-semibold text-blue-600 hover:underline">Sửa</button>
          <button onclick="deleteManageItem('subjects', '${s.id}')" class="text-xs font-semibold text-red-600 hover:underline">Xóa</button>
        </div>
      `;
      sList.appendChild(row);
    });
  }
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
  const lastSeen = Number(localStorage.getItem("tkb_last_seen_log") || 0);
  const unreadCount = (state.logsList || []).filter(item => (item.createdAt || 0) > lastSeen).length;
  const label = unreadCount > 9 ? "9+" : String(unreadCount);

  ["unreadBadge", "drawerUnreadBadge"].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = label;
      badge.classList.remove("hidden");
      badge.classList.add("flex");
    } else {
      badge.classList.add("hidden");
      badge.classList.remove("flex");
    }
  });
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

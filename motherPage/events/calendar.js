// Renders the interactive month calendar on the Events page using the
// `teaClubEvents` data from events-data.js. Clicking an event pill opens
// that event's page.
(function () {
    "use strict";

    const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function dateKey(year, monthIndex, day) {
        return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    }

    function buildEventsByDate(events) {
        const map = new Map();
        (events || []).forEach((event) => {
            if (!map.has(event.date)) {
                map.set(event.date, []);
            }
            map.get(event.date).push(event);
        });
        return map;
    }

    function init() {
        const grid = document.getElementById("calGrid");
        const weekdaysEl = document.getElementById("calWeekdays");
        const labelEl = document.getElementById("calLabel");
        const prevBtn = document.getElementById("calPrev");
        const nextBtn = document.getElementById("calNext");
        const todayBtn = document.getElementById("calToday");

        if (!grid || !weekdaysEl || !labelEl) {
            return;
        }

        const eventsByDate = buildEventsByDate(typeof teaClubEvents !== "undefined" ? teaClubEvents : []);

        const today = new Date();
        const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

        let viewYear = today.getFullYear();
        let viewMonth = today.getMonth();

        function renderWeekdays() {
            weekdaysEl.innerHTML = "";
            WEEKDAY_LABELS.forEach((label, i) => {
                const cell = document.createElement("span");
                cell.className = "calendar_weekday";
                if (i === 0 || i === 6) {
                    cell.classList.add("is-weekend");
                }
                cell.textContent = label;
                weekdaysEl.appendChild(cell);
            });
        }

        function renderGrid() {
            grid.innerHTML = "";

            const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
            const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

            for (let i = 0; i < totalCells; i++) {
                const offset = i - firstWeekday;
                let cellYear = viewYear;
                let cellMonth = viewMonth;
                let cellDay;
                let inCurrentMonth = true;

                if (offset < 0) {
                    cellDay = daysInPrevMonth + offset + 1;
                    cellMonth = viewMonth - 1;
                    inCurrentMonth = false;
                } else if (offset >= daysInMonth) {
                    cellDay = offset - daysInMonth + 1;
                    cellMonth = viewMonth + 1;
                    inCurrentMonth = false;
                } else {
                    cellDay = offset + 1;
                }

                if (cellMonth < 0) {
                    cellMonth = 11;
                    cellYear -= 1;
                } else if (cellMonth > 11) {
                    cellMonth = 0;
                    cellYear += 1;
                }

                const key = dateKey(cellYear, cellMonth, cellDay);
                const dayEvents = eventsByDate.get(key) || [];
                const weekdayIndex = i % 7;

                const cell = document.createElement("div");
                cell.className = "calendar_cell";
                if (!inCurrentMonth) {
                    cell.classList.add("is-otherMonth");
                }
                if (key === todayKey) {
                    cell.classList.add("is-today");
                }
                if (weekdayIndex === 0 || weekdayIndex === 6) {
                    cell.classList.add("is-weekend");
                }
                if (dayEvents.length > 0) {
                    cell.classList.add("has-events");
                }

                const dayNum = document.createElement("span");
                dayNum.className = "calendar_daynum";
                dayNum.textContent = String(cellDay);
                cell.appendChild(dayNum);

                if (dayEvents.length > 0) {
                    const eventList = document.createElement("div");
                    eventList.className = "calendar_events";
                    dayEvents.forEach((event) => {
                        const link = document.createElement("a");
                        link.className = "calendar_event";
                        link.href = `../${event.path}`;
                        link.textContent = event.title;
                        if (event.subtitle) {
                            link.title = event.subtitle;
                        }
                        eventList.appendChild(link);
                    });
                    cell.appendChild(eventList);
                }

                grid.appendChild(cell);
            }
        }

        function render() {
            labelEl.textContent = `${viewYear}년 ${viewMonth + 1}월`;
            renderGrid();
        }

        prevBtn?.addEventListener("click", () => {
            viewMonth -= 1;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear -= 1;
            }
            render();
        });

        nextBtn?.addEventListener("click", () => {
            viewMonth += 1;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear += 1;
            }
            render();
        });

        todayBtn?.addEventListener("click", () => {
            viewYear = today.getFullYear();
            viewMonth = today.getMonth();
            render();
        });

        renderWeekdays();
        render();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

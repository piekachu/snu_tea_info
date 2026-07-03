// Renders the date/location/facilitator/fee/category info card on an event
// subpage, and shows the tea-lineup section ("#teaLineup") only when this
// event's category is "regulars". Reads teaClubEvents from events-data.js —
// must load after it.
(function () {
    "use strict";

    const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    function currentRelPath() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
    }

    function formatDateKo(dateStr) {
        const [year, month, day] = dateStr.split("-").map(Number);
        const weekday = WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
        return `${year}년 ${month}월 ${day}일 (${weekday})`;
    }

    function formatDateRangeKo(dateStr, endDateStr) {
        if (!endDateStr || endDateStr === dateStr) {
            return formatDateKo(dateStr);
        }
        const [year, month] = dateStr.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
        const endWeekday = WEEKDAY_LABELS[new Date(endYear, endMonth - 1, endDay).getDay()];
        const start = formatDateKo(dateStr);
        // same year+month: shorten the end date to just "일 (요일)"
        if (year === endYear && month === endMonth) {
            return `${start} ~ ${endDay}일 (${endWeekday})`;
        }
        return `${start} ~ ${formatDateKo(endDateStr)}`;
    }

    function addRow(list, label, value) {
        if (!value) return;
        const row = document.createElement("div");
        row.className = "event_meta_row";
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        if (/^https?:\/\//.test(value)) {
            // a map link (e.g. location) rather than plain text
            const link = document.createElement("a");
            link.href = value;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "event_meta_link";
            link.textContent = "지도에서 보기";
            dd.appendChild(link);
        } else {
            dd.textContent = value;
        }
        row.appendChild(dt);
        row.appendChild(dd);
        list.appendChild(row);
    }

    function init() {
        if (typeof teaClubEvents === "undefined") return;

        const here = currentRelPath();
        const event = teaClubEvents.find((e) => e.path === here);
        if (!event) return;

        const metaEl = document.getElementById("eventMeta");
        if (metaEl) {
            const status = typeof eventStatuses !== "undefined" ? eventStatuses[event.status] : null;
            const category = typeof eventCategories !== "undefined" ? eventCategories[event.category] : null;

            if (status || category) {
                const badges = document.createElement("div");
                badges.className = "event_meta_badges";
                if (status) {
                    const statusBadge = document.createElement("span");
                    statusBadge.className = `event_meta_badge event_status_${event.status}`;
                    statusBadge.textContent = status.label;
                    badges.appendChild(statusBadge);
                }
                if (category) {
                    const categoryBadge = document.createElement("span");
                    categoryBadge.className = "event_meta_badge";
                    categoryBadge.textContent = category.label;
                    badges.appendChild(categoryBadge);
                }
                metaEl.appendChild(badges);
            }

            const list = document.createElement("dl");
            list.className = "event_meta_list";
            addRow(list, "날짜", formatDateRangeKo(event.date, event.endDate));
            addRow(list, "장소", event.location);
            addRow(list, "진행자", event.facilitator);
            addRow(list, "참가비", event.fee);
            metaEl.appendChild(list);
        }

        const isRegulars = event.category === "regulars";
        const teaLineup = document.getElementById("teaLineup");
        if (teaLineup) {
            teaLineup.style.display = isRegulars ? "" : "none";
        }
        const teaNav = document.getElementById("magazine_lnb");
        if (teaNav) {
            teaNav.style.display = isRegulars ? "" : "none";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

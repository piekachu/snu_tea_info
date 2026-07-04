// Renders the date/location/facilitator/fee/category info card on an event
// subpage, and shows the tea-lineup section ("#teaLineup") only when this
// event's category is "regulars". Reads teaClubEvents from events-data.js —
// must load after it.
(function () {
    "use strict";

    function currentRelPath() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
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
            const main = document.createElement("div");
            main.className = "event_meta_main";

            const effectiveStatus = typeof effectiveEventStatus !== "undefined" ? effectiveEventStatus(event) : event.status;
            const status = typeof eventStatuses !== "undefined" ? eventStatuses[effectiveStatus] : null;
            const category = typeof eventCategories !== "undefined" ? eventCategories[event.category] : null;

            if (status || category) {
                const badges = document.createElement("div");
                badges.className = "event_meta_badges";
                if (status) {
                    const statusBadge = document.createElement("span");
                    statusBadge.className = `event_meta_badge event_status_${effectiveStatus}`;
                    statusBadge.textContent = status.label;
                    badges.appendChild(statusBadge);
                }
                if (category) {
                    const categoryBadge = document.createElement("span");
                    categoryBadge.className = "event_meta_badge";
                    categoryBadge.textContent = category.label;
                    badges.appendChild(categoryBadge);
                }
                main.appendChild(badges);
            }

            const list = document.createElement("dl");
            list.className = "event_meta_list";
            addRow(list, "날짜", formatEventDateRangeKo(event.date, event.endDate));
            addRow(list, "장소", event.location);
            addRow(list, "진행자", event.facilitator);
            addRow(list, "참가비", event.fee);
            main.appendChild(list);

            metaEl.appendChild(main);

            // one-line description — sits at the right end of the info
            // section instead of overlaid on the hero photo
            if (event.subtitle) {
                const brief = document.createElement("p");
                brief.className = "event_meta_brief";
                brief.textContent = event.subtitle;
                metaEl.appendChild(brief);
            }
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

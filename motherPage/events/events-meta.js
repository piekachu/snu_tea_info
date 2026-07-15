// Renders the date+time/location/fee/category info card (plus the share
// button at the right end of the status/category badge row) on an
// event subpage, and shows the tea-lineup section ("#teaLineup") only when
// this event's category has `showsTeaInfo: true` (see eventCategories in
// events-data.js). Reads teaClubEvents from events-data.js — must load
// after it.
(function () {
    "use strict";

    function currentRelPath() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
    }

    // native share sheet where available, otherwise copy the page link to
    // the clipboard
    function createShareButton() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event_meta_share_btn";
        btn.setAttribute("aria-label", "공유하기");
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
            + '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
            + '<path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
            + '</svg>';

        btn.addEventListener("click", async () => {
            const shareData = { title: document.title, url: window.location.href };
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    // user dismissed the native share sheet — nothing to do
                }
                return;
            }
            try {
                await navigator.clipboard.writeText(shareData.url);
                btn.classList.add("copied");
                setTimeout(() => btn.classList.remove("copied"), 1500);
            } catch (err) {
                window.prompt("아래 링크를 복사해주세요:", shareData.url);
            }
        });

        return btn;
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
            // pushed to the right end of the badge row by margin-left: auto
            // (see .event_meta_share_btn in subpage.css)
            badges.appendChild(createShareButton());
            main.appendChild(badges);

            const list = document.createElement("dl");
            list.className = "event_meta_list";
            addRow(list, "일시", formatEventDateTimeKo(event));
            addRow(list, "장소", event.location);
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

        const showsTeaInfo = typeof eventCategories !== "undefined" && !!eventCategories[event.category] && !!eventCategories[event.category].showsTeaInfo;
        const teaLineup = document.getElementById("teaLineup");
        const teaNav = document.getElementById("magazine_lnb");
        const infoToggle = document.getElementById("infoToggle");
        const eventInfoPanel = document.getElementById("eventInfoPanel");
        const eventApply = document.querySelector(".event_apply");

        if (!showsTeaInfo) {
            if (teaLineup) teaLineup.style.display = "none";
            if (teaNav) teaNav.style.display = "none";
            if (infoToggle) infoToggle.style.display = "none";
            return;
        }

        // "regulars" (정기다회): the toggle switches which panel is shown
        // below the hero — event info (intro/meta/guidelines) or the tea
        // lineup — instead of showing both at once. The apply button only
        // makes sense alongside the event info (date/location/fee), so it
        // follows that panel rather than staying up regardless of which
        // one is open.
        if (infoToggle) infoToggle.style.display = "";
        const showPanel = (panel) => {
            if (eventInfoPanel) eventInfoPanel.style.display = panel === "event" ? "" : "none";
            if (teaLineup) teaLineup.style.display = panel === "tea" ? "" : "none";
            if (teaNav) teaNav.style.display = panel === "tea" ? "" : "none";
            if (eventApply) eventApply.style.display = panel === "event" ? "" : "none";
            if (infoToggle) {
                infoToggle.querySelectorAll(".info_toggle_btn").forEach((btn) => {
                    btn.classList.toggle("active", btn.dataset.panel === panel);
                });
            }
        };
        if (infoToggle) {
            infoToggle.querySelectorAll(".info_toggle_btn").forEach((btn) => {
                btn.addEventListener("click", () => showPanel(btn.dataset.panel));
            });
        }
        showPanel("event");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

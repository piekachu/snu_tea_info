// Populates the "#sidebarEventLinks" list on every event subpage from the
// shared teaClubEvents data (events-data.js), so a new event is added in one
// place instead of hand-edited into every other event page's sidebar.
// Must load after events-data.js.
(function () {
    "use strict";

    function currentRelPath() {
        const segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
    }

    function init() {
        const list = document.getElementById("sidebarEventLinks");
        if (!list || typeof teaClubEvents === "undefined") return;

        const here = currentRelPath();
        const sorted = [...teaClubEvents].sort((a, b) => a.date.localeCompare(b.date));

        sorted.forEach((event) => {
            const link = document.createElement("a");
            link.href = `../${event.path}`;
            link.textContent = `📄 ${event.title}`;
            if (event.path === here) {
                link.classList.add("active");
            }
            list.appendChild(link);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

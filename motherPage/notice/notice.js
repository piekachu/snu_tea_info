// Expands/collapses each notice's content panel — click the title/date row
// (.notice_item_toggle) to reveal its .notice_item_panel below it.
(function () {
    "use strict";

    function init() {
        document.querySelectorAll(".notice_item_toggle").forEach((btn) => {
            const panel = document.getElementById(btn.getAttribute("aria-controls"));
            if (!panel) return;
            btn.addEventListener("click", () => {
                const isOpen = btn.getAttribute("aria-expanded") === "true";
                btn.setAttribute("aria-expanded", String(!isOpen));
                panel.hidden = isOpen;
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

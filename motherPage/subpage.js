// Shared behavior for subordinate (magazine-style) pages: sidebar toggle,
// tea-section shortcut highlighting, and hero-visibility-triggered nav reveal.
// Requires elements with ids #mySidebar / #menuToggle and, optionally,
// .magazine_lnb_tab / .article_header.header_overlay.
(function () {
    "use strict";

    function toggleNav() {
        const sidebar = document.getElementById("mySidebar");
        const toggleBtn = document.getElementById("menuToggle");
        if (!sidebar) return;
        sidebar.classList.toggle("open");
        if (toggleBtn) toggleBtn.classList.toggle("open");
        document.body.classList.toggle("nav-open");
    }
    window.toggleNav = toggleNav;

    document.addEventListener("click", (e) => {
        const sidebar = document.getElementById("mySidebar");
        const toggleBtn = document.getElementById("menuToggle");
        if (!sidebar || !sidebar.classList.contains("open")) return;
        if (sidebar.contains(e.target) || (toggleBtn && toggleBtn.contains(e.target))) return;
        toggleNav();
    });

    // highlight the section shortcut for whichever tea is currently in view
    document.addEventListener("DOMContentLoaded", () => {
        const tabs = document.querySelectorAll(".magazine_lnb_tab[href^='#tea_']");
        if (!tabs.length) return;
        const sections = Array.from(tabs)
            .map((tab) => document.querySelector(tab.getAttribute("href")))
            .filter(Boolean);
        const setActive = (id) => {
            tabs.forEach((tab) => {
                tab.classList.toggle("active", tab.getAttribute("href") === `#${id}`);
            });
        };
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            },
            { rootMargin: "-40% 0px -50% 0px" }
        );
        sections.forEach((section) => observer.observe(section));
    });

    // reveal the section-shortcut nav only once the hero banner has scrolled out of view
    document.addEventListener("DOMContentLoaded", () => {
        const hero = document.querySelector(".article_header.header_overlay");
        if (!hero) return;
        const heroObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    document.body.classList.toggle("nav-visible", !entry.isIntersecting);
                });
            },
            { threshold: 0 }
        );
        heroObserver.observe(hero);
    });
})();

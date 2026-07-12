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

    // share button, overlaid bottom-right on the hero photo — native share
    // sheet where available, otherwise copy the page link to the clipboard
    document.addEventListener("DOMContentLoaded", () => {
        const hero = document.querySelector(".article_header.header_overlay");
        if (!hero) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hero_share_btn";
        btn.setAttribute("aria-label", "공유하기");
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
            + '<circle cx="18" cy="5" r="2.5" stroke="currentColor" stroke-width="1.6"/>'
            + '<circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="1.6"/>'
            + '<circle cx="18" cy="19" r="2.5" stroke="currentColor" stroke-width="1.6"/>'
            + '<path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
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

        hero.appendChild(btn);
    });
})();

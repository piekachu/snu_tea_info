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

    // highlight the section shortcut for whichever tea is currently in view.
    // Driven by scroll position rather than IntersectionObserver: with a
    // thin trigger band, a section shorter than the viewport (or a jump
    // straight to an anchor, which doesn't necessarily pass through that
    // band) could leave the previously-active tab highlighted indefinitely,
    // since nothing ever tells it to turn back off — this instead
    // recomputes "current section" from scratch on every scroll.
    //
    // Exposed (not just run on DOMContentLoaded) so a page that builds its
    // .magazine_lnb_tab links dynamically — events/view.html, admin-created
    // events — can call this once those links actually exist. On this
    // file's own DOMContentLoaded run, a page like that has no tabs yet, so
    // the early return below is expected there; it wires up for real when
    // the page calls this itself afterwards.
    function initSectionShortcuts() {
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

        // a section counts as "current" once its top has scrolled up past
        // this line (roughly a third of the way down the viewport)
        const referenceLine = () => window.innerHeight * 0.35;
        const updateActive = () => {
            let current = sections[0];
            for (const section of sections) {
                if (section.getBoundingClientRect().top <= referenceLine()) {
                    current = section;
                } else {
                    break;
                }
            }
            if (current) setActive(current.id);
        };

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                updateActive();
                ticking = false;
            });
        };
        document.addEventListener("scroll", onScroll, { passive: true });

        // jump straight to the matching tab on click instead of waiting for
        // the next scroll event to catch up
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => setActive(tab.getAttribute("href").slice(1)));
        });

        updateActive();
    }
    document.addEventListener("DOMContentLoaded", initSectionShortcuts);

    // reveal the section-shortcut nav only once the hero banner has scrolled
    // out of view. Also exposed, for symmetry with initSectionShortcuts —
    // events/view.html's hero element exists from initial page load either
    // way (only its visibility toggles later), so this one already works
    // fine from the DOMContentLoaded wiring below without a manual call.
    function initNavReveal() {
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
    }
    document.addEventListener("DOMContentLoaded", initNavReveal);

    window.Subpage = { initSectionShortcuts, initNavReveal };
})();

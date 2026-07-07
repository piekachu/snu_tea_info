// Renders an embedded Naver Map (with a "길찾기" directions button) into
// "#eventMap" on an event subpage, when that event has `lat`/`lng` set in
// events-data.js. Loads the Naver Maps JS SDK lazily, only on pages that
// actually need it, so pages without coordinates pay no extra cost.
// Reads teaClubEvents from events-data.js — must load after it.
(function () {
    "use strict";

    // NAVER Cloud Platform Maps key — restricted to this site's registered
    // domain(s) in the NCP console; not a secret. Passed as `ncpKeyId` (the
    // current param name — older docs/examples use the retired `ncpClientId`).
    var NCP_KEY_ID = "7x2r5r252m";

    function currentRelPath() {
        var segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
    }

    function loadNaverMapsSdk(onReady) {
        if (window.naver && window.naver.maps) {
            onReady();
            return;
        }
        // the SDK can call this before it's actually finished assigning
        // window.naver.maps later in the same script — defer to the next
        // tick so that assignment has definitely completed by the time
        // onReady runs.
        window.__snuTeaMapReady = function () {
            setTimeout(onReady, 0);
        };
        var script = document.createElement("script");
        script.src = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=" + NCP_KEY_ID + "&callback=__snuTeaMapReady";
        script.onerror = function () {
            console.error("[events-map] Naver Maps SDK failed to load. Check that this page's domain is registered as a Web Dynamic Map Service URL for client ID \"" + NCP_KEY_ID + "\" in the NCP console.");
        };
        document.head.appendChild(script);
    }

    function renderMap(mapEl, event) {
        var point = new naver.maps.LatLng(event.lat, event.lng);
        var canvas = document.createElement("div");
        canvas.className = "event_map_canvas";
        mapEl.appendChild(canvas);

        var map = new naver.maps.Map(canvas, { center: point, zoom: 17 });
        new naver.maps.Marker({ position: point, map: map });

        if (event.mapLink) {
            var link = document.createElement("a");
            link.href = event.mapLink;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "event_map_directions";
            link.textContent = "길찾기";
            mapEl.appendChild(link);
        }
    }

    function init() {
        if (typeof teaClubEvents === "undefined") return;

        var mapEl = document.getElementById("eventMap");
        if (!mapEl) return;

        var here = currentRelPath();
        var event = teaClubEvents.find(function (e) { return e.path === here; });

        if (!event || typeof event.lat !== "number" || typeof event.lng !== "number") {
            mapEl.style.display = "none";
            return;
        }

        loadNaverMapsSdk(function () {
            renderMap(mapEl, event);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

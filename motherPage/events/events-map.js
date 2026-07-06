// Renders an embedded Naver Map (with a "길찾기" directions button) into
// "#eventMap" on an event subpage, when that event's `location` in
// events-data.js is a plain address rather than a map link. Loads the
// Naver Maps JS SDK lazily, only on pages that actually need it, so pages
// without a geocodable address pay no extra cost.
// Reads teaClubEvents from events-data.js — must load after it.
(function () {
    "use strict";

    // NAVER Cloud Platform Maps "Client ID" — restricted to this site's
    // registered domain(s) in the NCP console; not a secret.
    var NCP_CLIENT_ID = "7x2r5r252m";

    function currentRelPath() {
        var segments = window.location.pathname.split("/").filter(Boolean);
        return segments.slice(-2).join("/");
    }

    function loadNaverMapsSdk(onReady) {
        if (window.naver && window.naver.maps && window.naver.maps.Service) {
            onReady();
            return;
        }
        var script = document.createElement("script");
        script.src = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=" + NCP_CLIENT_ID + "&submodules=geocoder";
        script.onload = onReady;
        script.onerror = function () {
            console.error("[events-map] Naver Maps SDK failed to load. Check that this page's domain is registered as a Web Dynamic Map Service URL for client ID \"" + NCP_CLIENT_ID + "\" in the NCP console.");
        };
        document.head.appendChild(script);
    }

    function renderMap(mapEl, event) {
        naver.maps.Service.geocode({ query: event.location }, function (status, response) {
            if (status !== naver.maps.Service.Status.OK) {
                console.warn("[events-map] Geocode failed for \"" + event.location + "\" (status: " + status + "). This can mean the domain isn't authorized for this client ID, or the address didn't match.");
                return;
            }
            var addresses = response.v2.addresses;
            if (!addresses || !addresses.length) {
                console.warn("[events-map] Geocode returned no results for \"" + event.location + "\".");
                return;
            }

            var point = new naver.maps.LatLng(addresses[0].y, addresses[0].x);
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
        });
    }

    function init() {
        if (typeof teaClubEvents === "undefined") return;

        var mapEl = document.getElementById("eventMap");
        if (!mapEl) return;

        var here = currentRelPath();
        var event = teaClubEvents.find(function (e) { return e.path === here; });

        // only geocode plain addresses — a location that's itself a map
        // link has no address text to look up
        if (!event || !event.location || /^https?:\/\//.test(event.location)) {
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

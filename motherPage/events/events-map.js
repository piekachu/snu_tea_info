// Renders an embedded Naver Map into "#eventMap" on an event subpage.
// Supports two modes depending on the event's data in events-data.js:
//
//   Single venue  — event has `lat`/`lng` (+ optional `mapLink`).
//                   Drops one marker and shows a "길찾기" button below.
//
//   Multiple venues — event has `venues: [{lat, lng, label, mapLink}, …]`.
//                   Drops one marker per venue, auto-fits the map to show
//                   all of them, and shows a "길찾기" button per venue below
//                   the map. Clicking a marker opens a small label popup;
//                   clicking another venue's marker closes the previous one.
//
// Loads the Naver Maps JS SDK lazily — pages without coordinates pay no cost.
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

    // ── Single-venue map ─────────────────────────────────────────────────────
    function renderSingleVenueMap(mapEl, event) {
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

    // ── Multi-venue map ──────────────────────────────────────────────────────
    function renderMultiVenueMap(mapEl, venues) {
        // filter out any venue that is missing coordinates
        var validVenues = venues.filter(function (v) {
            return typeof v.lat === "number" && typeof v.lng === "number";
        });
        if (!validVenues.length) return;

        var canvas = document.createElement("div");
        canvas.className = "event_map_canvas";
        mapEl.appendChild(canvas);

        // initialise the map centred on the first venue; fitBounds will adjust
        var firstPoint = new naver.maps.LatLng(validVenues[0].lat, validVenues[0].lng);
        var map = new naver.maps.Map(canvas, { center: firstPoint, zoom: 15 });

        // keep track of the currently open info window so we can close it when
        // the user clicks a different marker
        var openInfoWindow = null;

        validVenues.forEach(function (venue) {
            var point = new naver.maps.LatLng(venue.lat, venue.lng);
            var marker = new naver.maps.Marker({ position: point, map: map });

            if (venue.label) {
                var directionsHtml = venue.mapLink
                    ? '<a href="' + venue.mapLink + '" target="_blank" rel="noopener noreferrer" class="event_map_infowin_link">길찾기</a>'
                    : "";
                var infoWindow = new naver.maps.InfoWindow({
                    content: '<div class="event_map_infowin">'
                        + '<span class="event_map_infowin_label">' + venue.label + '</span>'
                        + directionsHtml
                        + '</div>',
                    borderWidth: 0,
                    disableAnchor: false,
                    backgroundColor: "transparent",
                    pixelOffset: new naver.maps.Point(0, -8)
                });

                naver.maps.Event.addListener(marker, "click", function () {
                    if (openInfoWindow) {
                        openInfoWindow.close();
                        // if clicking the same marker again, just close and return
                        if (openInfoWindow === infoWindow) {
                            openInfoWindow = null;
                            return;
                        }
                    }
                    infoWindow.open(map, marker);
                    openInfoWindow = infoWindow;
                });
            }
        });

        // auto-fit the viewport to contain all markers (with padding)
        if (validVenues.length > 1) {
            var bounds = new naver.maps.LatLngBounds();
            validVenues.forEach(function (v) {
                bounds.extend(new naver.maps.LatLng(v.lat, v.lng));
            });
            map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
        }

        // directions row — one button per venue that has a mapLink
        var linksWithUrl = validVenues.filter(function (v) { return v.mapLink; });
        if (linksWithUrl.length) {
            var row = document.createElement("div");
            row.className = "event_map_directions_row";
            linksWithUrl.forEach(function (venue) {
                var link = document.createElement("a");
                link.href = venue.mapLink;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "event_map_directions";
                link.textContent = venue.label ? venue.label + " 길찾기" : "길찾기";
                row.appendChild(link);
            });
            mapEl.appendChild(row);
        }
    }

    // ── shared entry point ──────────────────────────────────────────────────
    // Renders into mapEl for a single event object. Used both by this file's
    // own init() below (hand-authored pages, event looked up by pathname)
    // and by events/view.html (admin-created events, looked up by ?id= —
    // events-map.js's own path-matching doesn't apply there since every
    // dynamic event shares the same "events/view.html" pathname).
    function render(mapEl, event) {
        if (!mapEl || !event) return;

        // multi-venue path: event.venues array takes priority
        var hasVenues = Array.isArray(event.venues) && event.venues.length > 0;
        // single-venue path: top-level lat/lng
        var hasSingleVenue = typeof event.lat === "number" && typeof event.lng === "number";

        if (!hasVenues && !hasSingleVenue) {
            mapEl.style.display = "none";
            return;
        }

        // undo a possible earlier "none" (e.g. this file's own init() below
        // ran first, on a page — like events/view.html — that legitimately
        // has no entry in teaClubEvents for it to match by pathname, and
        // hid the container before this direct render() call arrived)
        mapEl.style.display = "";

        loadNaverMapsSdk(function () {
            if (hasVenues) {
                renderMultiVenueMap(mapEl, event.venues);
            } else {
                renderSingleVenueMap(mapEl, event);
            }
        });
    }

    // ── Entry point (hand-authored event subpages) ──────────────────────────
    function init() {
        if (typeof teaClubEvents === "undefined") return;

        var mapEl = document.getElementById("eventMap");
        if (!mapEl) return;

        var here = currentRelPath();
        var event = teaClubEvents.find(function (e) { return e.path === here; });
        // no match is now an expected case too (events/view.html, which
        // renders admin-created events by ?id= instead of pathname, and
        // calls EventsMap.render() itself once its own fetch resolves) —
        // leave the empty container alone rather than hiding it, since that
        // would race with and clobber the real render() call on that page
        if (!event) return;

        render(mapEl, event);
    }

    window.EventsMap = { render: render };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

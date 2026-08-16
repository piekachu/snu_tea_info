// 소모임 신청 (Join) page: a month calendar where anyone can create an event
// on a date, and anyone else can sign up to it. Backed by a Google Sheet via
// Apps Script (see apps-script/SETUP.md) — until join-config.js has a real
// URL configured, runs in a local "demo mode" (localStorage only, per
// browser) so the page is fully testable before that backend exists.
(function () {
    "use strict";

    const API_URL = (window.JOIN_APPS_SCRIPT_URL || "").trim();
    const DEMO_MODE = !API_URL;
    const DEMO_KEY = "joinDemoData_v1";
    const TOKENS_KEY = "joinEditTokens_v1";
    // stale-while-revalidate cache of the last successful `list` response.
    // The Apps Script call takes ~3-8s, so a repeat visit paints from this
    // instantly and then refreshes in the background. Real mode only (demo
    // data is already local). Shared with join-carousel.js on the home page.
    const LIST_CACHE_KEY = "joinListCache_v1";

    const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    // ---------- edit-token storage (per browser; proves "I made this") ----------
    function loadTokens() {
        try {
            const parsed = JSON.parse(localStorage.getItem(TOKENS_KEY));
            return parsed && typeof parsed === "object" ? { events: parsed.events || {}, signups: parsed.signups || {} } : { events: {}, signups: {} };
        } catch (err) {
            return { events: {}, signups: {} };
        }
    }
    function saveTokens(tokens) {
        localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    }
    function rememberEventToken(id, token) {
        const t = loadTokens();
        t.events[id] = token;
        saveTokens(t);
    }
    function rememberSignupToken(id, token) {
        const t = loadTokens();
        t.signups[id] = token;
        saveTokens(t);
    }
    function forgetEventToken(id) {
        const t = loadTokens();
        delete t.events[id];
        saveTokens(t);
    }
    function forgetSignupToken(id) {
        const t = loadTokens();
        delete t.signups[id];
        saveTokens(t);
    }
    function myEventToken(id) {
        return loadTokens().events[id];
    }
    function mySignupIdForEvent(eventId) {
        const tokens = loadTokens().signups;
        const mine = signups.find((s) => s.eventId === eventId && tokens[s.id]);
        return mine ? mine.id : null;
    }

    // ---------- demo-mode data layer (localStorage) ----------
    function loadDemo() {
        try {
            const parsed = JSON.parse(localStorage.getItem(DEMO_KEY));
            return parsed && typeof parsed === "object" ? { events: parsed.events || [], signups: parsed.signups || [] } : { events: [], signups: [] };
        } catch (err) {
            return { events: [], signups: [] };
        }
    }
    function saveDemo(data) {
        localStorage.setItem(DEMO_KEY, JSON.stringify(data));
    }
    function uid() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function demoList() {
        const d = loadDemo();
        // mirrors publicEvents_/publicSignups_ in Code.gs — password/editToken
        // stay out of the array the rest of the page actually renders from,
        // even though it's all local anyway in demo mode
        const events = d.events.map((e) => ({
            id: e.id,
            date: e.date,
            time: e.time,
            title: e.title,
            location: e.location,
            mapLink: e.mapLink,
            capacity: e.capacity,
            host: e.host,
            description: e.description,
            hostSignupId: e.hostSignupId,
            createdAt: e.createdAt,
        }));
        // canceled signups are excluded from the public list (soft-delete)
        const signups = d.signups
            .filter((s) => !s.canceledAt)
            .map((s) => ({ id: s.id, eventId: s.eventId, name: s.name, createdAt: s.createdAt }));
        return { ok: true, events, signups };
    }

    // shared by demoCreateEvent/demoUpdateEvent — mirrors validateEventFields_ in Code.gs
    function validateDemoEventFields(body, existingSignupCount) {
        const title = String(body.title || "").trim();
        const date = String(body.date || "").trim();
        const host = String(body.host || "").trim();
        if (!title || !date || !host) {
            return { error: "제목, 날짜, 주최자 이름은 필수예요." };
        }
        const capacity = Number(body.capacity);
        if (body.capacity === "" || body.capacity == null || !Number.isFinite(capacity) || capacity < 1) {
            return { error: "정원은 1 이상의 숫자여야 해요 (본인 포함)." };
        }
        if (existingSignupCount != null && capacity < existingSignupCount) {
            return { error: `이미 ${existingSignupCount}명이 참가 중이라 정원을 그보다 줄일 수 없어요.` };
        }
        return {
            title,
            date,
            host,
            capacity,
            time: String(body.time || "").trim(),
            location: String(body.location || "").trim(),
            mapLink: String(body.mapLink || "").trim(),
            description: String(body.description || "").trim(),
        };
    }

    function demoCreateEvent(body) {
        const password = String(body.password || "");
        if (!password) return { ok: false, error: "비밀번호를 설정해주세요. 나중에 수정/삭제할 때 필요해요." };

        const fields = validateDemoEventFields(body, null);
        if (fields.error) return { ok: false, error: fields.error };

        // the host is a participant too, so they give a real name like everyone else
        const hostRealName = String(body.hostRealName || "").trim();
        if (!hostRealName) return { ok: false, error: "주최자 실명을 입력해주세요." };

        const d = loadDemo();
        const id = uid();
        const editToken = uid();
        const createdAt = new Date().toISOString();

        // the creator counts toward their own capacity — auto-signup them so
        // the headcount starts at 1/N instead of 0/N (see Code.gs's createEvent_)
        const hostSignupId = uid();
        d.signups.push({ id: hostSignupId, eventId: id, name: fields.host, realName: hostRealName, contact: "", createdAt, editToken: uid() });

        const event = { id, date: fields.date, time: fields.time, title: fields.title, location: fields.location, mapLink: fields.mapLink, capacity: fields.capacity, host: fields.host, description: fields.description, password, hostSignupId, createdAt, editToken };
        d.events.push(event);
        saveDemo(d);
        return { ok: true, event, editToken };
    }

    function demoUpdateEvent(body) {
        const d = loadDemo();
        const idx = d.events.findIndex((e) => e.id === body.id);
        if (idx === -1) return { ok: false, error: "존재하지 않는 소모임이에요." };
        const target = d.events[idx];

        const isOwner = (!!body.editToken && target.editToken === body.editToken) || (!!body.password && target.password === body.password);
        const isAdmin = !!body.adminPassword && body.adminPassword === DEMO_ADMIN_PASSWORD;
        if (!isOwner && !isAdmin) return { ok: false, error: "수정 권한이 없어요. 비밀번호를 확인해주세요." };

        const currentSignupCount = d.signups.filter((s) => s.eventId === body.id && !s.canceledAt).length;
        const fields = validateDemoEventFields(body, currentSignupCount);
        if (fields.error) return { ok: false, error: fields.error };

        const oldHost = target.host;
        Object.assign(target, {
            title: fields.title,
            time: fields.time,
            location: fields.location,
            mapLink: fields.mapLink,
            capacity: fields.capacity,
            host: fields.host,
            description: fields.description,
        });
        if (target.hostSignupId && oldHost !== fields.host) {
            const hostSignup = d.signups.find((s) => s.id === target.hostSignupId);
            if (hostSignup) hostSignup.name = fields.host;
        }
        saveDemo(d);
        return { ok: true, event: target };
    }

    // demo mode has no real backend to hold a secret, so "admin" here is
    // just this fixed local password — enough to exercise the admin-delete
    // UI/flow before a real backend exists; the real check happens in
    // Code.gs's deleteEvent_ once join-config.js points at a live deployment
    const DEMO_ADMIN_PASSWORD = "admin";

    function demoDeleteEvent(body) {
        const d = loadDemo();
        const idx = d.events.findIndex((e) => e.id === body.id);
        if (idx === -1) return { ok: false, error: "존재하지 않는 소모임이에요." };
        const target = d.events[idx];

        const isOwner = (!!body.editToken && target.editToken === body.editToken) || (!!body.password && target.password === body.password);
        const isAdmin = !!body.adminPassword && body.adminPassword === DEMO_ADMIN_PASSWORD;
        if (!isOwner && !isAdmin) return { ok: false, error: "삭제 권한이 없어요. 비밀번호를 확인해주세요." };

        const allSignups = d.signups.filter((s) => s.eventId === body.id);
        // only active (non-canceled) signups block the host from deleting the event
        const otherSignups = allSignups.filter((s) => s.id !== target.hostSignupId && !s.canceledAt);
        if (otherSignups.length > 0 && !isAdmin) return { ok: false, error: "다른 참가자가 있어 삭제할 수 없어요." };

        // safe to clear every signup tied to this event now — either it's
        // just the creator's own auto-signup, or an admin is force-clearing
        d.signups = d.signups.filter((s) => s.eventId !== body.id);
        d.events.splice(idx, 1);
        saveDemo(d);
        return { ok: true };
    }

    function demoSignup(body) {
        const d = loadDemo();
        const event = d.events.find((e) => e.id === body.eventId);
        if (!event) return { ok: false, error: "존재하지 않는 소모임이에요." };
        if (signupsClosed(event)) return { ok: false, error: "신청이 마감되었어요. (행사 24시간 전 마감)" };
        const name = String(body.name || "").trim();
        if (!name) return { ok: false, error: "이름을 입력해주세요." };
        const realName = String(body.realName || "").trim();
        if (!realName) return { ok: false, error: "실명을 입력해주세요." };
        // only count active (non-canceled) signups against capacity and name-uniqueness
        const existing = d.signups.filter((s) => s.eventId === body.eventId && !s.canceledAt);
        if (event.capacity !== "" && existing.length >= Number(event.capacity)) {
            return { ok: false, error: "정원이 찼어요." };
        }
        if (existing.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
            return { ok: false, error: "이미 같은 이름으로 신청되어 있어요." };
        }
        const id = uid();
        const editToken = uid();
        const createdAt = new Date().toISOString();
        // cancelPassword stored as plain text in demo (no real backend to hash it)
        const cancelPassword = String(body.cancelPassword || "").trim() || null;
        d.signups.push({ id, eventId: body.eventId, name, realName, contact: String(body.contact || "").trim(), createdAt, editToken, cancelPassword });
        saveDemo(d);
        return { ok: true, signup: { id, eventId: body.eventId, name, createdAt }, editToken };
    }

    function demoCancelSignup(body) {
        const d = loadDemo();
        const idx = d.signups.findIndex((s) => s.id === body.id);
        if (idx === -1) return { ok: false, error: "존재하지 않는 신청이에요." };
        if (d.signups[idx].editToken !== body.editToken) return { ok: false, error: "취소 권한이 없어요." };
        if (d.signups[idx].canceledAt) return { ok: false, error: "이미 취소된 신청이에요." };
        // enforce the 2-day withdrawal deadline
        const event = d.events.find((e) => e.id === d.signups[idx].eventId);
        if (event && !canWithdrawSignup(event)) {
            return { ok: false, error: "행사 2일 전부터는 신청을 취소할 수 없어요." };
        }
        // soft-delete: stamp canceledAt so the cancellation is tracked
        d.signups[idx].canceledAt = new Date().toISOString();
        saveDemo(d);
        return { ok: true };
    }

    function demoCancelSignupByPassword(body) {
        const d = loadDemo();
        const event = d.events.find((e) => e.id === body.eventId);
        if (!event) return { ok: false, error: "존재하지 않는 소모임이에요." };
        if (!canWithdrawSignup(event)) return { ok: false, error: "행사 2일 전부터는 신청을 취소할 수 없어요." };

        const realName = String(body.realName || "").trim();
        const cancelPassword = String(body.cancelPassword || "");
        const idx = d.signups.findIndex(
            (s) =>
                s.eventId === body.eventId &&
                String(s.realName || "").trim() === realName &&
                s.cancelPassword &&
                s.cancelPassword === cancelPassword &&
                !s.canceledAt
        );
        if (idx === -1) return { ok: false, error: "실명 또는 취소 비밀번호가 올바르지 않아요." };
        d.signups[idx].canceledAt = new Date().toISOString();
        saveDemo(d);
        return { ok: true };
    }

    function demoEventParticipants(body) {
        const d = loadDemo();
        const target = d.events.find((e) => e.id === body.id);
        if (!target) return { ok: false, error: "존재하지 않는 소모임이에요." };
        const isOwner = (!!body.editToken && target.editToken === body.editToken) || (!!body.password && target.password === body.password);
        const isAdmin = !!body.adminPassword && body.adminPassword === DEMO_ADMIN_PASSWORD;
        if (!isOwner && !isAdmin) return { ok: false, error: "권한이 없어요. 비밀번호를 확인해주세요." };
        // host/admin sees ALL signups including canceled, so they can track
        // who originally signed up and then withdrew
        const participants = d.signups
            .filter((s) => s.eventId === body.id)
            .map((s) => ({
                id: s.id,
                name: s.name,
                realName: s.realName || "",
                contact: s.contact || "",
                isHost: s.id === target.hostSignupId,
                createdAt: s.createdAt,
                canceledAt: s.canceledAt || null,
            }));
        return { ok: true, participants };
    }

    // ---------- API layer ----------
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Supabase Edge Functions are called with a normal POST + JSON body (no
    // redirect issues, unlike the old Apps Script GET-param workaround).
    // One quiet retry covers transient cold-start latency on the first request
    // to a function that hasn't been invoked recently.
    async function fetchPost(payload) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    cache: "no-store",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                if (attempt === 1) throw err;
                await sleep(700);
            }
        }
    }

    async function apiList() {
        if (DEMO_MODE) return demoList();
        return fetchPost({ action: "list" });
    }
    async function apiPost(action, payload) {
        if (DEMO_MODE) {
            switch (action) {
                case "createEvent":
                    return demoCreateEvent(payload);
                case "updateEvent":
                    return demoUpdateEvent(payload);
                case "deleteEvent":
                    return demoDeleteEvent(payload);
                case "signup":
                    return demoSignup(payload);
                case "cancelSignup":
                    return demoCancelSignup(payload);
                case "cancelSignupByPassword":
                    return demoCancelSignupByPassword(payload);
                case "eventParticipants":
                    return demoEventParticipants(payload);
                default:
                    return { ok: false, error: "unknown action" };
            }
        }
        return fetchPost({ action, ...payload });
    }

    // ---------- date helpers ----------
    function pad2(n) {
        return String(n).padStart(2, "0");
    }
    function dateKey(y, m, d) {
        return `${y}-${pad2(m + 1)}-${pad2(d)}`;
    }
    function formatDateLabel(key) {
        const [y, m, d] = key.split("-").map(Number);
        const wd = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
        return `${y}년 ${m}월 ${d}일 (${wd})`;
    }
    function formatTime(time) {
        if (!time) return "";
        const [h, m] = time.split(":").map(Number);
        const period = h < 12 ? "오전" : "오후";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${period} ${h12}:${pad2(m)}`;
    }

    // (re)build the hour + minute <select>s. The minute list is only :00 / :30,
    // which is what hard-enforces the 30-minute grid; splitting hour off keeps
    // either list short. Called each time the modal opens so a legacy off-grid
    // minute injected on a previous edit doesn't linger. Values are the stored
    // zero-padded "HH" / "MM"; getTimeValue() joins them into "HH:MM".
    function populateTimeOptions() {
        if (!els.createHour) return;
        const hours = ['<option value="">선택 안 함</option>'];
        for (let h = 0; h < 24; h += 1) {
            hours.push(`<option value="${pad2(h)}">${h}시</option>`);
        }
        els.createHour.innerHTML = hours.join("");
        els.createMinute.innerHTML = ["00", "30"]
            .map((m) => `<option value="${m}">${m}분</option>`)
            .join("");
    }

    // "" when no hour is picked (time is optional); otherwise "HH:MM".
    function getTimeValue() {
        if (!els.createHour.value) return "";
        return `${els.createHour.value}:${els.createMinute.value}`;
    }

    // select an existing event's time when editing. An off-grid legacy minute
    // (e.g. 18:15, saved before the 30-min restriction) isn't in the :00 / :30
    // list, so setting it would silently snap to another value — inject a
    // one-off option for it first, marked "(기존)".
    function setTimeValue(time) {
        const [hh = "", mm = ""] = (time || "").split(":");
        els.createHour.value = hh;
        if (mm && !Array.from(els.createMinute.options).some((o) => o.value === mm)) {
            els.createMinute.add(new Option(`${mm}분 (기존)`, mm));
        }
        els.createMinute.value = mm || "00";
    }

    // falls back to a Naver Map search for the venue text when the creator
    // didn't paste an actual map link — there's no stored coordinate to
    // point at otherwise, since anyone can type any venue name here, unlike
    // the curated event pages
    function naverSearchUrl(text) {
        return `https://map.naver.com/p/search/${encodeURIComponent(text)}`;
    }

    // one dt/dd row in the event-page-style info list (.event_meta_list,
    // shared with event subpages via subpage.css); `mapHref` adds a
    // "지도에서 보기" link next to the value, pointed wherever it says
    function addMetaRow(list, label, value, opts) {
        if (!value) return;
        const row = el("div", "event_meta_row");
        row.appendChild(el("dt", null, label));
        const dd = document.createElement("dd");
        dd.textContent = value;
        if (opts && opts.mapHref) {
            dd.appendChild(document.createTextNode(" · "));
            const link = document.createElement("a");
            link.href = opts.mapHref;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "event_meta_link";
            link.textContent = "지도에서 보기";
            dd.appendChild(link);
        }
        row.appendChild(dd);
        list.appendChild(row);
    }

    // native share sheet where available, otherwise copy a link straight to
    // this event (via ?event=<id>, opened automatically on load — see
    // openSharedEventIfAny) to the clipboard; same icon/fallback pattern as
    // events-meta.js's share button on the curated event pages
    function createShareButton(ev) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event_meta_share_btn";
        btn.setAttribute("aria-label", "공유하기");
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            "</svg>";

        btn.addEventListener("click", async () => {
            const url = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(ev.id)}`;
            const lines = [`[${ev.title}]`, "", ev.description || "소모임에 초대합니다!"];
            const datePart = [formatDateLabel(ev.date), formatTime(ev.time)].filter(Boolean).join(" ");
            if (datePart) lines.push("", `🗓 일시 : ${datePart}`);
            if (ev.location) lines.push("", `🚡 장소 : ${ev.location}`);
            if (ev.host) lines.push("", `🙋 주최 : ${ev.host}`);
            lines.push("", "✅️ 신청 방법 : 아래 링크를 통해 신청", "", url);

            const text = lines.join("\n");
            try {
                await navigator.clipboard.writeText(text);
                btn.classList.add("copied");
                setTimeout(() => btn.classList.remove("copied"), 1500);
            } catch (err) {
                window.prompt("아래 내용을 복사해주세요:", text);
            }
        });

        return btn;
    }

    // ---------- state ----------
    let events = [];
    let signups = [];
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let selectedDateKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    function eventsByDate() {
        const map = new Map();
        events.forEach((ev) => {
            if (!map.has(ev.date)) map.set(ev.date, []);
            map.get(ev.date).push(ev);
        });
        return map;
    }
    function signupsForEvent(eventId) {
        return signups.filter((s) => s.eventId === eventId);
    }
    function capacityLabel(event) {
        const count = signupsForEvent(event.id).length;
        if (event.capacity === "" || event.capacity == null) return `신청 ${count}명`;
        return `${count}/${event.capacity}명`;
    }
    function isFull(event) {
        if (event.capacity === "" || event.capacity == null) return false;
        return signupsForEvent(event.id).length >= Number(event.capacity);
    }
    function isPastEvent(event) {
        const eventEnd = eventStartDate(event);
        if (!eventEnd) return false;
        return Date.now() > eventEnd.getTime();
    }

    const SIGNUP_CLOSE_BEFORE_MS = 24 * 60 * 60 * 1000; // signups close 24h before the event starts
    const CANCEL_DEADLINE_BEFORE_MS = 2 * 24 * 60 * 60 * 1000; // can't withdraw within 2 days of event

    // the event's start as a Date in the viewer's local time — the whole app
    // treats these stored date/time strings as Korea wall-clock (the club's
    // local time), and Korean visitors' browsers are in that same zone, so
    // parsing them locally matches. The server re-checks in the sheet's
    // timezone anyway (signupsClosed_ in Code.gs), so this is only the UI hint.
    function eventStartDate(event) {
        if (!event || !event.date) return null;
        const d = new Date(`${event.date}T${event.time || "00:00"}:00`);
        return isNaN(d.getTime()) ? null : d;
    }
    function signupsClosed(event) {
        const start = eventStartDate(event);
        if (!start) return false;
        return Date.now() >= start.getTime() - SIGNUP_CLOSE_BEFORE_MS;
    }
    // returns true if the user can still withdraw their signup (i.e. still
    // more than 2 days before the event). Unknown/unparseable dates return true
    // so a bad row never permanently locks someone in.
    function canWithdrawSignup(event) {
        const start = eventStartDate(event);
        if (!start) return true;
        return Date.now() < start.getTime() - CANCEL_DEADLINE_BEFORE_MS;
    }

    // ---------- DOM refs (filled in on init) ----------
    let els = {};

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // ---------- calendar rendering ----------
    function renderWeekdays() {
        els.calWeekdays.innerHTML = "";
        WEEKDAY_LABELS.forEach((label, i) => {
            const cell = el("span", "calendar_weekday", label);
            if (i === 0 || i === 6) cell.classList.add("is-weekend");
            els.calWeekdays.appendChild(cell);
        });
    }

    function renderCalendar() {
        els.calLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
        els.calGrid.innerHTML = "";

        const byDate = eventsByDate();
        const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
        const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

        for (let i = 0; i < totalCells; i++) {
            const offset = i - firstWeekday;
            let cellYear = viewYear;
            let cellMonth = viewMonth;
            let cellDay;
            let inCurrentMonth = true;

            if (offset < 0) {
                cellDay = daysInPrevMonth + offset + 1;
                cellMonth = viewMonth - 1;
                inCurrentMonth = false;
            } else if (offset >= daysInMonth) {
                cellDay = offset - daysInMonth + 1;
                cellMonth = viewMonth + 1;
                inCurrentMonth = false;
            } else {
                cellDay = offset + 1;
            }
            if (cellMonth < 0) {
                cellMonth = 11;
                cellYear -= 1;
            } else if (cellMonth > 11) {
                cellMonth = 0;
                cellYear += 1;
            }

            const key = dateKey(cellYear, cellMonth, cellDay);
            const dayEvents = byDate.get(key) || [];
            const weekdayIndex = i % 7;

            const cell = el("div", "calendar_cell");
            cell.tabIndex = 0;
            cell.setAttribute("role", "button");
            cell.setAttribute("aria-label", `${cellYear}년 ${cellMonth + 1}월 ${cellDay}일`);
            if (!inCurrentMonth) cell.classList.add("is-otherMonth");
            if (key === todayKey) cell.classList.add("is-today");
            if (key === selectedDateKey) cell.classList.add("is-selected");
            if (weekdayIndex === 0 || weekdayIndex === 6) cell.classList.add("is-weekend");
            if (dayEvents.length > 0) cell.classList.add("has-events");

            cell.appendChild(el("span", "calendar_daynum", String(cellDay)));

            if (dayEvents.length > 0) {
                const list = el("div", "calendar_events");
                dayEvents.forEach((ev) => {
                    const pill = el("a", "calendar_event", ev.title);
                    pill.href = "#";
                    if (ev.time) pill.title = `${formatTime(ev.time)} · ${ev.title}`;
                    pill.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectDate(key);
                        openDetailModal(ev.id);
                    });
                    list.appendChild(pill);
                });
                cell.appendChild(list);
            }

            const selectThis = () => selectDate(key);
            cell.addEventListener("click", selectThis);
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectThis();
                }
            });

            els.calGrid.appendChild(cell);
        }
    }

    function selectDate(key) {
        selectedDateKey = key;
        renderCalendar();
        renderDayPanel();
    }

    // ---------- day panel ----------
    function renderDayPanel() {
        els.dayPanelDate.textContent = formatDateLabel(selectedDateKey);
        els.eventList.innerHTML = "";

        // creating a 소모임 is only allowed on future dates (not today, not past)
        const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const canCreate = selectedDateKey > todayStr;
        els.createBtn.disabled = !canCreate;
        els.createBtn.title = canCreate ? "" : "내일 이후 날짜를 선택해야 소모임을 만들 수 있어요.";

        const dayEvents = events.filter((ev) => ev.date === selectedDateKey).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

        if (dayEvents.length === 0) {
            const msg = canCreate
                ? "이 날짜에는 아직 소모임이 없어요. 첫 소모임을 만들어보세요!"
                : "이 날짜에는 소모임이 없어요.";
            els.eventList.appendChild(el("p", "join_empty_state", msg));
            return;
        }

        dayEvents.forEach((ev) => {
            const card = el("button", "join_event_card");
            card.type = "button";

            const main = el("div", "join_event_card_main");
            main.appendChild(el("span", "join_event_card_title", ev.title));
            const metaParts = [formatTime(ev.time), ev.location, `주최: ${ev.host}`].filter(Boolean);
            main.appendChild(el("span", "join_event_card_meta", metaParts.join(" · ")));
            card.appendChild(main);

            const badge = el("span", "join_event_card_badge", isPastEvent(ev) || isFull(ev) ? "마감" : capacityLabel(ev));
            if (isFull(ev) || isPastEvent(ev)) badge.classList.add("is-full");
            card.appendChild(badge);

            card.addEventListener("click", () => openDetailModal(ev.id));
            els.eventList.appendChild(card);
        });
    }

    // ---------- create/edit event modal (one modal, two modes) ----------
    // non-null while editing an existing event instead of creating a new one
    let editingEvent = null;

    function openCreateModal() {
        // guard: only allow future dates (belt-and-suspenders alongside the
        // disabled button state set in renderDayPanel)
        const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
        if (selectedDateKey <= todayStr) return;

        editingEvent = null;
        populateTimeOptions();
        els.createForm.reset();
        els.createCapacity.value = "1";
        els.createFormError.hidden = true;
        els.createModalTitle.textContent = "새 소모임 만들기";
        els.createSubmitBtn.textContent = "만들기";
        els.createHostRealNameField.hidden = false;
        els.createHostRealName.required = true;
        els.createPasswordField.hidden = false;
        els.createPassword.required = true;
        els.createModalDate.textContent = formatDateLabel(selectedDateKey);
        openModal(els.createModalOverlay);
        els.createTitle.focus();
    }

    function openEditModal(ev) {
        editingEvent = ev;
        populateTimeOptions();
        els.createForm.reset();
        els.createFormError.hidden = true;
        els.createModalTitle.textContent = "소모임 수정하기";
        els.createSubmitBtn.textContent = "수정하기";
        // editing never touches the password (there's no "change password"
        // here), the host's real name (already on file from creation), or the
        // date (reschedule = delete + recreate, for now)
        els.createHostRealNameField.hidden = true;
        els.createHostRealName.required = false;
        els.createPasswordField.hidden = true;
        els.createPassword.required = false;
        els.createModalDate.textContent = formatDateLabel(ev.date);
        els.createTitle.value = ev.title;
        setTimeValue(ev.time);
        els.createCapacity.value = ev.capacity;
        els.createLocation.value = ev.location || "";
        els.createMapLink.value = ev.mapLink || "";
        els.createHost.value = ev.host;
        els.createDesc.value = ev.description || "";
        openModal(els.createModalOverlay);
        els.createTitle.focus();
    }

    async function handleCreateSubmit(e) {
        e.preventDefault();
        els.createFormError.hidden = true;

        const submitBtn = els.createForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            const fields = {
                title: els.createTitle.value,
                time: getTimeValue(),
                capacity: els.createCapacity.value,
                location: els.createLocation.value,
                mapLink: els.createMapLink.value,
                host: els.createHost.value,
                description: els.createDesc.value,
            };

            let result;
            if (editingEvent) {
                const auth = getEventAuth(editingEvent);
                result = await apiPost("updateEvent", { id: editingEvent.id, date: editingEvent.date, ...auth, ...fields });
            } else {
                result = await apiPost("createEvent", {
                    date: selectedDateKey,
                    password: els.createPassword.value,
                    hostRealName: els.createHostRealName.value,
                    ...fields,
                });
            }

            if (!result.ok) {
                els.createFormError.textContent = result.error || "저장하지 못했어요. 다시 시도해주세요.";
                els.createFormError.hidden = false;
                return;
            }
            if (!editingEvent) {
                rememberEventToken(result.event.id, result.editToken);
            }
            closeModal(els.createModalOverlay);
            await refresh();
            openDetailModal(result.event.id);
        } catch (err) {
            console.error(err);
            els.createFormError.textContent = "네트워크 오류가 발생했어요. 다시 시도해주세요.";
            els.createFormError.hidden = false;
        } finally {
            submitBtn.disabled = false;
        }
    }

    // ---------- event detail / signup modal ----------
    let activeDetailEventId = null;

    function openDetailModal(eventId) {
        activeDetailEventId = eventId;
        renderDetailModal();
        openModal(els.detailModalOverlay);
    }

    function renderDetailModal() {
        const ev = events.find((e) => e.id === activeDetailEventId);
        if (!ev) {
            closeModal(els.detailModalOverlay);
            return;
        }

        els.detailModalTitle.textContent = ev.title;

        els.detailModalBadges.innerHTML = "";
        const capacityBadge = el("span", "event_meta_badge", capacityLabel(ev));
        if (isFull(ev)) capacityBadge.classList.add("is-full");
        els.detailModalBadges.appendChild(capacityBadge);
        els.detailModalBadges.appendChild(createShareButton(ev));

        els.detailModalMetaList.innerHTML = "";
        addMetaRow(els.detailModalMetaList, "일시", [formatDateLabel(ev.date), formatTime(ev.time)].filter(Boolean).join(" · "));
        addMetaRow(els.detailModalMetaList, "장소", ev.location, { mapHref: ev.mapLink || (ev.location ? naverSearchUrl(ev.location) : null) });
        addMetaRow(els.detailModalMetaList, "주최자", ev.host);
        addMetaRow(els.detailModalMetaList, "정원", ev.capacity === "" || ev.capacity == null ? "무제한" : `${ev.capacity}명`);

        els.detailModalDesc.textContent = ev.description || "";
        els.detailModalDesc.hidden = !ev.description;

        const participants = signupsForEvent(ev.id);
        els.detailParticipantsTitle.textContent = `참가자 (${capacityLabel(ev)})`;
        els.detailParticipantsList.innerHTML = "";
        if (participants.length === 0) {
            els.detailParticipantsList.appendChild(el("span", "join_empty_state", "아직 신청자가 없어요."));
        } else {
            participants.forEach((s) => {
                const isHost = s.id === ev.hostSignupId;
                els.detailParticipantsList.appendChild(el("span", "join_participant_chip", isHost ? `${s.name} (주최자)` : s.name));
            });
        }

        renderSignupArea(ev, participants);
        renderHostArea(ev, participants);
    }

    function renderSignupArea(ev, participants) {
        const area = els.detailSignupArea;
        area.innerHTML = "";

        const mySignupId = mySignupIdForEvent(ev.id);
        if (mySignupId) {
            const mine = participants.find((s) => s.id === mySignupId);
            const state = el("div", "join_signup_state", `✅ ${mine ? mine.name : ""}님으로 신청 완료했어요.`);
            area.appendChild(state);
            if (canWithdrawSignup(ev)) {
                const cancelBtn = el("button", "join_cancel_link", "신청 취소하기");
                cancelBtn.type = "button";
                cancelBtn.addEventListener("click", () => handleCancelSignup(mySignupId));
                area.appendChild(cancelBtn);
            } else {
                area.appendChild(el("p", "join_signup_state is-closed", "행사 2일 전이라 신청 취소가 불가능해요."));
            }
            return;
        }

        // the creator is already "in" via their auto-signup at creation —
        // no separate signup action makes sense for them (edit/delete
        // instead, in the host area below)
        if (getEventAuth(ev)) {
            area.appendChild(el("div", "join_signup_state", "✅ 주최자로 참여 중이에요."));
            return;
        }

        if (isPastEvent(ev)) {
            area.appendChild(el("div", "join_signup_state is-full", "행사가 종료되었어요."));
            return;
        }

        // For full/closed: show the status but don't return — let the
        // cross-device cancel section render below for people who signed up
        // on another device and still want to withdraw.
        if (isFull(ev)) {
            area.appendChild(el("div", "join_signup_state is-full", "정원이 찼습니다."));
        } else if (signupsClosed(ev)) {
            area.appendChild(el("div", "join_signup_state is-closed", "신청이 마감되었어요. (행사 24시간 전 마감)"));
        } else {

        const form = document.createElement("form");
        form.className = "join_signup_form";

        const nameField = el("div", "join_field");
        const nameLabel = el("label", null, "이름 *");
        nameLabel.htmlFor = "signupName";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "signupName";
        nameInput.maxLength = 30;
        nameInput.required = true;
        nameInput.placeholder = "닉네임도 좋아요";
        nameField.appendChild(nameLabel);
        nameField.appendChild(nameInput);

        // never shown publicly — only the host/admin can see this (participant
        // contacts view), so the admin can confirm who's actually attending
        const realNameField = el("div", "join_field");
        const realNameLabel = el("label", null, "실명 *");
        realNameLabel.htmlFor = "signupRealName";
        const realNameInput = document.createElement("input");
        realNameInput.type = "text";
        realNameInput.id = "signupRealName";
        realNameInput.maxLength = 30;
        realNameInput.required = true;
        realNameInput.placeholder = "관리자 확인용, 공개되지 않아요";
        realNameField.appendChild(realNameLabel);
        realNameField.appendChild(realNameInput);

        const contactField = el("div", "join_field");
        const contactLabel = el("label", null, "연락처 (선택)");
        contactLabel.htmlFor = "signupContact";
        const contactInput = document.createElement("input");
        contactInput.type = "text";
        contactInput.id = "signupContact";
        contactInput.maxLength = 60;
        contactInput.placeholder = "카카오톡 ID / 전화번호 등 (주최자만 볼 수 있어요)";
        contactField.appendChild(contactLabel);
        contactField.appendChild(contactInput);

        // optional — lets the user cancel from a different device later
        const cancelPwField = el("div", "join_field");
        const cancelPwLabel = el("label", null, "취소 비밀번호 (선택)");
        cancelPwLabel.htmlFor = "signupCancelPw";
        const cancelPwHint = el("span", "join_field_hint", "다른 기기에서 신청을 취소할 때 필요해요.");
        const cancelPwInput = document.createElement("input");
        cancelPwInput.type = "password";
        cancelPwInput.id = "signupCancelPw";
        cancelPwInput.maxLength = 60;
        cancelPwInput.placeholder = "비밀번호를 설정하면 다른 기기에서도 취소 가능";
        cancelPwField.appendChild(cancelPwLabel);
        cancelPwField.appendChild(cancelPwHint);
        cancelPwField.appendChild(cancelPwInput);

        const error = el("p", "join_form_error", "");
        error.hidden = true;

        const submitBtn = el("button", "join_btn_primary", "신청하기");
        submitBtn.type = "submit";
        submitBtn.style.width = "100%";

        form.appendChild(nameField);
        form.appendChild(realNameField);
        form.appendChild(contactField);
        form.appendChild(cancelPwField);
        form.appendChild(error);
        form.appendChild(submitBtn);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            error.hidden = true;
            submitBtn.disabled = true;
            try {
                const result = await apiPost("signup", {
                    eventId: ev.id,
                    name: nameInput.value,
                    realName: realNameInput.value,
                    contact: contactInput.value,
                    cancelPassword: cancelPwInput.value || undefined,
                });
                if (!result.ok) {
                    error.textContent = result.error || "신청하지 못했어요. 다시 시도해주세요.";
                    error.hidden = false;
                    return;
                }
                rememberSignupToken(result.signup.id, result.editToken);
                await refresh();
                renderDetailModal();
            } catch (err) {
                console.error(err);
                error.textContent = "네트워크 오류가 발생했어요. 다시 시도해주세요.";
                error.hidden = false;
            } finally {
                submitBtn.disabled = false;
            }
        });

        area.appendChild(form);

        } // end else (not full, not closed)

        // Cross-device cancel: visible whenever someone might have signed up
        // on another device and the withdrawal window is still open.
        if (canWithdrawSignup(ev)) {
            renderCrossDeviceCancel(area, ev);
        }
    }

    // Collapsible section that lets someone cancel their signup using the
    // cancel password they set at registration — works from any device.
    function renderCrossDeviceCancel(area, ev) {
        const section = el("div", "join_crossdevice_cancel");

        const toggle = el("button", "join_admin_link", "다른 기기에서 신청하셨나요? 비밀번호로 취소하기");
        toggle.type = "button";
        section.appendChild(toggle);

        const formWrap = el("div", "join_crossdevice_form");
        formWrap.hidden = true;

        const realNameField = el("div", "join_field");
        const realNameLabel = el("label", null, "실명 *");
        realNameLabel.htmlFor = "cancelByPwRealName";
        const realNameInput = document.createElement("input");
        realNameInput.type = "text";
        realNameInput.id = "cancelByPwRealName";
        realNameInput.placeholder = "신청 시 입력한 실명";
        realNameInput.required = true;
        realNameField.appendChild(realNameLabel);
        realNameField.appendChild(realNameInput);

        const pwField = el("div", "join_field");
        const pwLabel = el("label", null, "취소 비밀번호 *");
        pwLabel.htmlFor = "cancelByPwPw";
        const pwInput = document.createElement("input");
        pwInput.type = "password";
        pwInput.id = "cancelByPwPw";
        pwInput.placeholder = "신청 시 설정한 취소 비밀번호";
        pwInput.required = true;
        pwField.appendChild(pwLabel);
        pwField.appendChild(pwInput);

        const cancelError = el("p", "join_form_error", "");
        cancelError.hidden = true;

        const cancelSubmitBtn = el("button", "join_btn_danger", "신청 취소하기");
        cancelSubmitBtn.type = "submit";
        cancelSubmitBtn.style.width = "100%";

        const cancelForm = document.createElement("form");
        cancelForm.appendChild(realNameField);
        cancelForm.appendChild(pwField);
        cancelForm.appendChild(cancelError);
        cancelForm.appendChild(cancelSubmitBtn);

        cancelForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            cancelError.hidden = true;
            cancelSubmitBtn.disabled = true;
            try {
                const result = await apiPost("cancelSignupByPassword", {
                    eventId: ev.id,
                    realName: realNameInput.value,
                    cancelPassword: pwInput.value,
                });
                if (result.ok) {
                    await refresh();
                    renderDetailModal();
                } else {
                    cancelError.textContent = result.error || "취소하지 못했어요.";
                    cancelError.hidden = false;
                }
            } catch (err) {
                console.error(err);
                cancelError.textContent = "네트워크 오류가 발생했어요.";
                cancelError.hidden = false;
            } finally {
                cancelSubmitBtn.disabled = false;
            }
        });

        formWrap.appendChild(cancelForm);
        section.appendChild(formWrap);

        toggle.addEventListener("click", () => {
            formWrap.hidden = !formWrap.hidden;
            if (!formWrap.hidden) realNameInput.focus();
        });

        area.appendChild(section);
    }

    async function handleCancelSignup(signupId) {
        const editToken = loadTokens().signups[signupId];
        if (!editToken) return;
        try {
            const result = await apiPost("cancelSignup", { id: signupId, editToken });
            if (result.ok) {
                forgetSignupToken(signupId);
                await refresh();
                renderDetailModal();
            } else {
                window.alert(result.error || "취소하지 못했어요.");
            }
        } catch (err) {
            console.error(err);
            window.alert("네트워크 오류가 발생했어요.");
        }
    }

    // password typed in to unlock edit/delete from a browser that doesn't
    // already hold the event's editToken — kept only in memory (never
    // localStorage, never resent anywhere but this event's own API calls),
    // so it's gone again on refresh and must be re-entered each session
    let unlockedEventPasswords = {};

    // {editToken} if this browser created the event, else {password} if the
    // owner unlocked it this session, else null (not authorized — the
    // "관리자 권한으로" path is separate, see handleAdminDelete)
    function getEventAuth(ev) {
        const editToken = myEventToken(ev.id);
        if (editToken) return { editToken };
        const password = unlockedEventPasswords[ev.id];
        if (password) return { password };
        return null;
    }

    function renderHostArea(ev, participants) {
        const area = els.detailHostArea;
        area.innerHTML = "";
        area.className = "join_host_area";

        const auth = getEventAuth(ev);
        if (auth) {
            const actions = el("div", "join_host_actions");

            const editBtn = el("button", "join_btn_secondary join_btn_small", "이 소모임 수정하기");
            editBtn.type = "button";
            editBtn.addEventListener("click", () => openEditModal(ev));
            actions.appendChild(editBtn);

            // the creator's own auto-signup doesn't count as "another
            // participant" here — an untouched, just-created event should
            // still be deletable
            const otherParticipants = participants.filter((p) => p.id !== ev.hostSignupId);
            if (otherParticipants.length === 0) {
                const deleteBtn = el("button", "join_btn_danger", "이 소모임 삭제하기");
                deleteBtn.type = "button";
                deleteBtn.addEventListener("click", () => handleDeleteEvent(ev, auth));
                actions.appendChild(deleteBtn);
            }

            // host-only: fetch the participant list WITH contacts (the public
            // list never carries them) — server re-checks ownership
            const contactsBtn = el("button", "join_btn_secondary join_btn_small", "참가자 연락처 보기");
            contactsBtn.type = "button";
            actions.appendChild(contactsBtn);

            area.appendChild(actions);

            if (otherParticipants.length > 0) {
                area.appendChild(el("p", "join_host_note", "다른 참가자가 있어 삭제할 수 없어요."));
            }

            const contactsBody = el("div", "join_host_contacts_body");
            area.appendChild(contactsBody);
            contactsBtn.addEventListener("click", () => handleShowParticipants(ev, auth, contactsBody, contactsBtn));
        } else {
            const unlockBtn = el("button", "join_admin_link", "비밀번호로 관리 (수정/삭제)");
            unlockBtn.type = "button";
            unlockBtn.addEventListener("click", () => handleOwnerUnlock(ev));
            area.appendChild(unlockBtn);
        }

        // always available, to anyone — not just the creator — so an admin
        // can remove a problem event (spam, duplicate, etc.) even with
        // signups on it; the server is the one actually checking the password
        const adminLink = el("button", "join_admin_link", "관리자 권한으로 삭제");
        adminLink.type = "button";
        adminLink.addEventListener("click", () => handleAdminDelete(ev));
        area.appendChild(adminLink);
    }

    function handleOwnerUnlock(ev) {
        const password = window.prompt("이 소모임을 만들 때 설정한 비밀번호를 입력해주세요.");
        if (password == null || password === "") return; // cancelled
        // not verified until the first actual edit/delete attempt — a wrong
        // password just surfaces as that action's own error, at which point
        // we forget it again so the unlock prompt comes back
        unlockedEventPasswords[ev.id] = password;
        renderDetailModal();
    }

    async function handleShowParticipants(ev, auth, container, btn) {
        btn.disabled = true;
        try {
            const result = await apiPost("eventParticipants", { id: ev.id, ...auth });
            if (!result.ok) {
                window.alert(result.error || "참가자 목록을 불러오지 못했어요.");
                // a wrong unlocked password surfaces here — forget it so the
                // "비밀번호로 관리" prompt comes back
                if (auth.password) {
                    delete unlockedEventPasswords[ev.id];
                    renderDetailModal();
                }
                return;
            }
            renderParticipantContacts(container, result.participants);
            btn.hidden = true;
        } catch (err) {
            console.error(err);
            window.alert("네트워크 오류가 발생했어요.");
        } finally {
            btn.disabled = false;
        }
    }

    function renderParticipantContacts(container, participants) {
        container.innerHTML = "";
        container.appendChild(el("p", "join_host_contacts_title", "참가자 연락처 (주최자 전용)"));
        const list = el("ul", "join_host_contacts_list");
        participants.forEach((p) => {
            const isCanceled = !!p.canceledAt;
            const item = el("li", "join_host_contacts_item" + (isCanceled ? " is-canceled" : ""));

            // show name with role/status badge
            let nameText = p.isHost ? `${p.name} (주최자)` : p.name;
            if (isCanceled) nameText += " (취소)";
            item.appendChild(el("span", "join_host_contacts_name", nameText));

            const meta = el("div", "join_host_contacts_meta");
            // real name: host/admin-only (never on the public participant list),
            // so the admin can confirm who's actually attending
            const realName = el("span", "join_host_contacts_realname", p.realName ? `실명: ${p.realName}` : "실명 미입력");
            if (!p.realName) realName.classList.add("is-empty");
            meta.appendChild(realName);
            const contact = el("span", "join_host_contacts_contact", p.contact ? p.contact : "연락처 미입력");
            if (!p.contact) contact.classList.add("is-empty");
            meta.appendChild(contact);
            item.appendChild(meta);

            list.appendChild(item);
        });
        container.appendChild(list);
    }

    async function handleDeleteEvent(ev, auth) {
        if (!window.confirm("이 소모임을 삭제할까요? 되돌릴 수 없어요.")) return;
        try {
            const result = await apiPost("deleteEvent", { id: ev.id, ...auth });
            if (result.ok) {
                forgetEventToken(ev.id);
                delete unlockedEventPasswords[ev.id];
                closeModal(els.detailModalOverlay);
                await refresh();
            } else {
                window.alert(result.error || "삭제하지 못했어요.");
                if (auth.password) {
                    delete unlockedEventPasswords[ev.id];
                    renderDetailModal();
                }
            }
        } catch (err) {
            console.error(err);
            window.alert("네트워크 오류가 발생했어요.");
        }
    }

    async function handleAdminDelete(ev) {
        const password = window.prompt("관리자 비밀번호를 입력해주세요.");
        if (password == null || password === "") return; // cancelled
        await handleDeleteEvent(ev, { adminPassword: password });
    }

    // ---------- modal plumbing ----------
    function openModal(overlay) {
        overlay.classList.add("is-open");
        document.body.classList.add("join-modal-open");
    }
    function closeModal(overlay) {
        overlay.classList.remove("is-open");
        document.body.classList.remove("join-modal-open");
    }
    function wireModal(overlay, key) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
        overlay.querySelectorAll(`[data-close-modal="${key}"]`).forEach((btn) => {
            btn.addEventListener("click", () => closeModal(overlay));
        });
    }

    // ---------- data refresh ----------
    function loadListCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(LIST_CACHE_KEY));
            if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.signups)) return parsed;
        } catch (err) {
            /* ignore malformed cache */
        }
        return null;
    }
    function saveListCache(data) {
        try {
            localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ events: data.events, signups: data.signups }));
        } catch (err) {
            /* storage full / unavailable — not fatal */
        }
    }

    async function refresh() {
        const result = await apiList();
        if (!result.ok) throw new Error(result.error || "list failed");
        events = result.events || [];
        signups = result.signups || [];
        if (!DEMO_MODE) saveListCache({ events, signups });
        renderCalendar();
        renderDayPanel();
    }

    async function init() {
        els = {
            demoBanner: document.getElementById("joinDemoBanner"),
            loading: document.getElementById("joinLoading"),
            error: document.getElementById("joinError"),
            content: document.getElementById("joinContent"),
            calGrid: document.getElementById("calGrid"),
            calWeekdays: document.getElementById("calWeekdays"),
            calLabel: document.getElementById("calLabel"),
            calPrev: document.getElementById("calPrev"),
            calNext: document.getElementById("calNext"),
            calToday: document.getElementById("calToday"),
            dayPanelDate: document.getElementById("joinDayPanelDate"),
            eventList: document.getElementById("joinEventList"),
            createBtn: document.getElementById("joinCreateBtn"),
            createModalOverlay: document.getElementById("createModalOverlay"),
            createModalTitle: document.getElementById("createModalTitle"),
            createModalDate: document.getElementById("createModalDate"),
            createForm: document.getElementById("createEventForm"),
            createFormError: document.getElementById("createFormError"),
            createSubmitBtn: document.getElementById("createSubmitBtn"),
            createTitle: document.getElementById("createTitle"),
            createHour: document.getElementById("createHour"),
            createMinute: document.getElementById("createMinute"),
            createCapacity: document.getElementById("createCapacity"),
            createLocation: document.getElementById("createLocation"),
            createMapLink: document.getElementById("createMapLink"),
            createPasswordField: document.getElementById("createPasswordField"),
            createPassword: document.getElementById("createPassword"),
            createHost: document.getElementById("createHost"),
            createHostRealNameField: document.getElementById("createHostRealNameField"),
            createHostRealName: document.getElementById("createHostRealName"),
            createDesc: document.getElementById("createDesc"),
            detailModalOverlay: document.getElementById("detailModalOverlay"),
            detailModalTitle: document.getElementById("detailModalTitle"),
            detailModalBadges: document.getElementById("detailModalBadges"),
            detailModalMetaList: document.getElementById("detailModalMetaList"),
            detailModalDesc: document.getElementById("detailModalDesc"),
            detailParticipantsTitle: document.getElementById("detailParticipantsTitle"),
            detailParticipantsList: document.getElementById("detailParticipantsList"),
            detailSignupArea: document.getElementById("detailSignupArea"),
            detailHostArea: document.getElementById("detailHostArea"),
        };

        if (!els.calGrid) return;

        if (DEMO_MODE) els.demoBanner.hidden = false;

        renderWeekdays();

        els.calPrev.addEventListener("click", () => {
            viewMonth -= 1;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear -= 1;
            }
            renderCalendar();
        });
        els.calNext.addEventListener("click", () => {
            viewMonth += 1;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear += 1;
            }
            renderCalendar();
        });
        els.calToday.addEventListener("click", () => {
            viewYear = today.getFullYear();
            viewMonth = today.getMonth();
            selectDate(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
        });

        els.createBtn.addEventListener("click", openCreateModal);
        els.createForm.addEventListener("submit", handleCreateSubmit);

        wireModal(els.createModalOverlay, "create");
        wireModal(els.detailModalOverlay, "detail");

        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            if (els.createModalOverlay.classList.contains("is-open")) closeModal(els.createModalOverlay);
            if (els.detailModalOverlay.classList.contains("is-open")) closeModal(els.detailModalOverlay);
        });

        // Reveal the calendar shell immediately instead of blocking the whole
        // page on the 3-8s Apps Script call behind a spinner — the calendar,
        // month nav, day panel and "새 소모임 만들기" all work with no server
        // data; only the event pills need the fetch. On a repeat visit we also
        // paint the last cached events instantly, then quietly revalidate.
        els.content.hidden = false;

        const cached = DEMO_MODE ? null : loadListCache();
        if (cached) {
            events = cached.events;
            signups = cached.signups;
        }
        renderCalendar();
        renderDayPanel();

        // cached (or demo) → nothing to wait for; cold first load → keep the
        // small "불러오는 중" hint up so an empty calendar doesn't read as
        // "no events" while the background fetch is still running
        els.loading.hidden = !!cached || DEMO_MODE;

        try {
            await refresh();
            openSharedEventIfAny();
        } catch (err) {
            console.error(err);
            // the shell is already up; only flag an error if we had nothing
            // cached to show in the first place
            if (!cached) els.error.hidden = false;
        } finally {
            els.loading.hidden = true;
        }
    }

    // a share link looks like join/index.html?event=<id> — jump straight to
    // that event's date and pop its detail modal open, then drop the query
    // param so navigating away and back (or refreshing) doesn't reopen it
    function openSharedEventIfAny() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("event");
        if (!id) return;
        const ev = events.find((e) => e.id === id);
        window.history.replaceState({}, "", window.location.pathname);
        if (!ev) return;
        selectDate(ev.date);
        openDetailModal(ev.id);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

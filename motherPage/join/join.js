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
        return { ok: true, events: d.events, signups: d.signups.map((s) => ({ id: s.id, eventId: s.eventId, name: s.name, createdAt: s.createdAt })) };
    }

    function demoCreateEvent(body) {
        const title = String(body.title || "").trim();
        const date = String(body.date || "").trim();
        const host = String(body.host || "").trim();
        if (!title || !date || !host) {
            return { ok: false, error: "제목, 날짜, 주최자 이름은 필수예요." };
        }
        if (body.capacity !== "" && body.capacity != null && (!Number.isFinite(Number(body.capacity)) || Number(body.capacity) < 1)) {
            return { ok: false, error: "정원은 1 이상의 숫자여야 해요." };
        }
        const d = loadDemo();
        const id = uid();
        const editToken = uid();
        const createdAt = new Date().toISOString();
        const capacity = body.capacity === "" || body.capacity == null ? "" : Number(body.capacity);
        const event = { id, date, time: String(body.time || "").trim(), title, location: String(body.location || "").trim(), capacity, host, description: String(body.description || "").trim(), createdAt };
        d.events.push(event);
        saveDemo(d);
        return { ok: true, event, editToken };
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

        const isOwner = !!body.editToken && d.events[idx].editToken === body.editToken;
        const isAdmin = !!body.adminPassword && body.adminPassword === DEMO_ADMIN_PASSWORD;
        if (!isOwner && !isAdmin) return { ok: false, error: "삭제 권한이 없어요." };

        const signupCount = d.signups.filter((s) => s.eventId === body.id).length;
        if (signupCount > 0 && !isAdmin) return { ok: false, error: "신청자가 있어 삭제할 수 없어요." };
        if (isAdmin && signupCount > 0) {
            d.signups = d.signups.filter((s) => s.eventId !== body.id);
        }

        d.events.splice(idx, 1);
        saveDemo(d);
        return { ok: true };
    }

    function demoSignup(body) {
        const d = loadDemo();
        const event = d.events.find((e) => e.id === body.eventId);
        if (!event) return { ok: false, error: "존재하지 않는 소모임이에요." };
        const name = String(body.name || "").trim();
        if (!name) return { ok: false, error: "이름을 입력해주세요." };
        const existing = d.signups.filter((s) => s.eventId === body.eventId);
        if (event.capacity !== "" && existing.length >= Number(event.capacity)) {
            return { ok: false, error: "정원이 찼어요." };
        }
        if (existing.some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
            return { ok: false, error: "이미 같은 이름으로 신청되어 있어요." };
        }
        const id = uid();
        const editToken = uid();
        const createdAt = new Date().toISOString();
        d.signups.push({ id, eventId: body.eventId, name, contact: String(body.contact || "").trim(), createdAt, editToken });
        saveDemo(d);
        return { ok: true, signup: { id, eventId: body.eventId, name, createdAt }, editToken };
    }

    function demoCancelSignup(body) {
        const d = loadDemo();
        const idx = d.signups.findIndex((s) => s.id === body.id);
        if (idx === -1) return { ok: false, error: "존재하지 않는 신청이에요." };
        if (d.signups[idx].editToken !== body.editToken) return { ok: false, error: "취소 권한이 없어요." };
        d.signups.splice(idx, 1);
        saveDemo(d);
        return { ok: true };
    }

    // ---------- API layer ----------
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Apps Script Web Apps occasionally answer a fresh request with a
    // transient error (a bare 404, or an HTML error page where JSON was
    // expected) that clears up immediately on retry — not something our own
    // requests cause, just infra flakiness on Google's end. One quiet retry
    // covers it without the user ever seeing "failed to load".
    async function fetchJson(url) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url, { method: "GET", cache: "no-store" });
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
        return fetchJson(`${API_URL}?action=list`);
    }
    async function apiPost(action, payload) {
        if (DEMO_MODE) {
            switch (action) {
                case "createEvent":
                    return demoCreateEvent(payload);
                case "deleteEvent":
                    return demoDeleteEvent(payload);
                case "signup":
                    return demoSignup(payload);
                case "cancelSignup":
                    return demoCancelSignup(payload);
                default:
                    return { ok: false, error: "unknown action" };
            }
        }
        // Deliberately a GET, not a POST: a fetch() POST to an Apps Script Web
        // App gets redirected cross-origin, and the browser blocks reading
        // the redirected response as a CORS failure before our code ever
        // sees it. GET doesn't hit that redirect, so writes go over the
        // query string instead of a request body (see Code.gs's doGet).
        const params = new URLSearchParams({ action });
        Object.entries(payload || {}).forEach(([key, value]) => {
            if (value != null) params.set(key, String(value));
        });
        return fetchJson(`${API_URL}?${params.toString()}`);
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

    // one dt/dd row in the event-page-style info list (.event_meta_list,
    // shared with event subpages via subpage.css); `mapLink` adds a "지도에서
    // 보기" link next to the value, pointed at a Naver Map search for the
    // venue text — there's no stored coordinate to link to directly since
    // anyone can type any venue name here, unlike the curated event pages
    function addMetaRow(list, label, value, opts) {
        if (!value) return;
        const row = el("div", "event_meta_row");
        row.appendChild(el("dt", null, label));
        const dd = document.createElement("dd");
        dd.textContent = value;
        if (opts && opts.mapLink) {
            dd.appendChild(document.createTextNode(" · "));
            const link = document.createElement("a");
            link.href = `https://map.naver.com/p/search/${encodeURIComponent(value)}`;
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
            const shareData = {
                title: `${ev.title} — 소모임 신청`,
                text: [formatDateLabel(ev.date), formatTime(ev.time), ev.title].filter(Boolean).join(" · "),
                url,
            };
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    // user dismissed the native share sheet — nothing to do
                }
                return;
            }
            try {
                await navigator.clipboard.writeText(url);
                btn.classList.add("copied");
                setTimeout(() => btn.classList.remove("copied"), 1500);
            } catch (err) {
                window.prompt("아래 링크를 복사해주세요:", url);
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

        const dayEvents = events.filter((ev) => ev.date === selectedDateKey).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

        if (dayEvents.length === 0) {
            els.eventList.appendChild(el("p", "join_empty_state", "이 날짜에는 아직 소모임이 없어요. 첫 소모임을 만들어보세요!"));
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

            const badge = el("span", "join_event_card_badge", capacityLabel(ev));
            if (isFull(ev)) badge.classList.add("is-full");
            card.appendChild(badge);

            card.addEventListener("click", () => openDetailModal(ev.id));
            els.eventList.appendChild(card);
        });
    }

    // ---------- create-event modal ----------
    function openCreateModal() {
        els.createForm.reset();
        els.createFormError.hidden = true;
        els.createModalDate.textContent = formatDateLabel(selectedDateKey);
        openModal(els.createModalOverlay);
        els.createTitle.focus();
    }

    async function handleCreateSubmit(e) {
        e.preventDefault();
        els.createFormError.hidden = true;

        const submitBtn = els.createForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            const result = await apiPost("createEvent", {
                date: selectedDateKey,
                title: els.createTitle.value,
                time: els.createTime.value,
                capacity: els.createCapacity.value,
                location: els.createLocation.value,
                host: els.createHost.value,
                description: els.createDesc.value,
            });
            if (!result.ok) {
                els.createFormError.textContent = result.error || "만들지 못했어요. 다시 시도해주세요.";
                els.createFormError.hidden = false;
                return;
            }
            rememberEventToken(result.event.id, result.editToken);
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
        addMetaRow(els.detailModalMetaList, "장소", ev.location, { mapLink: true });
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
                els.detailParticipantsList.appendChild(el("span", "join_participant_chip", s.name));
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
            const cancelBtn = el("button", "join_cancel_link", "신청 취소하기");
            cancelBtn.type = "button";
            cancelBtn.addEventListener("click", () => handleCancelSignup(mySignupId));
            area.appendChild(state);
            area.appendChild(cancelBtn);
            return;
        }

        if (isFull(ev)) {
            area.appendChild(el("div", "join_signup_state is-full", "정원이 찼습니다."));
            return;
        }

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

        const contactField = el("div", "join_field");
        const contactLabel = el("label", null, "연락처 (선택)");
        contactLabel.htmlFor = "signupContact";
        const contactInput = document.createElement("input");
        contactInput.type = "text";
        contactInput.id = "signupContact";
        contactInput.maxLength = 60;
        contactInput.placeholder = "카카오톡 ID / 전화번호 등 (주최자에게만 전달돼요)";
        contactField.appendChild(contactLabel);
        contactField.appendChild(contactInput);

        const error = el("p", "join_form_error", "");
        error.hidden = true;

        const submitBtn = el("button", "join_btn_primary", "신청하기");
        submitBtn.type = "submit";
        submitBtn.style.width = "100%";

        form.appendChild(nameField);
        form.appendChild(contactField);
        form.appendChild(error);
        form.appendChild(submitBtn);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            error.hidden = true;
            submitBtn.disabled = true;
            try {
                const result = await apiPost("signup", { eventId: ev.id, name: nameInput.value, contact: contactInput.value });
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

    function renderHostArea(ev, participants) {
        const area = els.detailHostArea;
        area.innerHTML = "";
        area.className = "join_host_area";

        const editToken = myEventToken(ev.id);
        if (editToken) {
            if (participants.length > 0) {
                area.appendChild(el("p", "join_host_note", "신청자가 있어 이 소모임은 삭제할 수 없어요."));
            } else {
                const deleteBtn = el("button", "join_btn_danger", "이 소모임 삭제하기");
                deleteBtn.type = "button";
                deleteBtn.addEventListener("click", () => handleDeleteEvent(ev.id, { editToken }));
                area.appendChild(deleteBtn);
            }
        }

        // always available, to anyone — not just the creator — so an admin
        // can remove a problem event (spam, duplicate, etc.) even with
        // signups on it; the server is the one actually checking the password
        const adminLink = el("button", "join_admin_link", "관리자 권한으로 삭제");
        adminLink.type = "button";
        adminLink.addEventListener("click", () => handleAdminDelete(ev.id));
        area.appendChild(adminLink);
    }

    async function handleDeleteEvent(eventId, auth) {
        if (!window.confirm("이 소모임을 삭제할까요? 되돌릴 수 없어요.")) return;
        try {
            const result = await apiPost("deleteEvent", { id: eventId, ...auth });
            if (result.ok) {
                forgetEventToken(eventId);
                closeModal(els.detailModalOverlay);
                await refresh();
            } else {
                window.alert(result.error || "삭제하지 못했어요.");
            }
        } catch (err) {
            console.error(err);
            window.alert("네트워크 오류가 발생했어요.");
        }
    }

    async function handleAdminDelete(eventId) {
        const password = window.prompt("관리자 비밀번호를 입력해주세요.");
        if (password == null || password === "") return; // cancelled
        await handleDeleteEvent(eventId, { adminPassword: password });
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
    async function refresh() {
        const result = await apiList();
        if (!result.ok) throw new Error(result.error || "list failed");
        events = result.events || [];
        signups = result.signups || [];
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
            createModalDate: document.getElementById("createModalDate"),
            createForm: document.getElementById("createEventForm"),
            createFormError: document.getElementById("createFormError"),
            createTitle: document.getElementById("createTitle"),
            createTime: document.getElementById("createTime"),
            createCapacity: document.getElementById("createCapacity"),
            createLocation: document.getElementById("createLocation"),
            createHost: document.getElementById("createHost"),
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

        try {
            await refresh();
            els.loading.hidden = true;
            els.content.hidden = false;
            openSharedEventIfAny();
        } catch (err) {
            console.error(err);
            els.loading.hidden = true;
            els.error.hidden = false;
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

// Event sign-up system — injects a status card and modal form for
// every event subpage whose effectiveEventStatus() is "recruiting".
// Requires events-data.js to load first.
//
// Extra fields per event (optional): add a `signupFields` array to the
// event's entry in events-data.js, e.g.:
//   signupFields: [
//     { name: "affiliation", label: "소속", hint: "학과/단체", required: true },
//     { name: "dietary",     label: "식이 제한",              required: false }
//   ]
// Values are stored in the `metadata` JSON column on the backend.
(function () {
    "use strict";

    const API_URL =
        "https://mzuxduxbzvaekuancotu.supabase.co/functions/v1/event-signup";

    // ── storage helpers ──────────────────────────────────────────────

    function storageKey(path) {
        return "ev_signup_v1_" + path.replace(/\//g, "_");
    }
    function getSaved(path) {
        try { return JSON.parse(localStorage.getItem(storageKey(path))); }
        catch { return null; }
    }
    function setSaved(path, data) {
        try { localStorage.setItem(storageKey(path), JSON.stringify(data)); }
        catch {}
    }
    function clearSaved(path) {
        try { localStorage.removeItem(storageKey(path)); }
        catch {}
    }

    // ── API ──────────────────────────────────────────────────────────

    async function api(payload) {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return res.json();
    }

    // ── deadline countdown ───────────────────────────────────────────

    function formatDeadline(event) {
        if (typeof getSignupEnd !== "function") return null;
        const endStr = getSignupEnd(event);
        const deadline = new Date(`${endStr}T23:59:59`);
        const now = new Date();
        const diffMs = deadline - now;
        if (diffMs <= 0) return null;
        const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins  = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (diffDays >= 1) return `마감까지 ${diffDays}일 ${diffHours}시간`;
        if (diffHours >= 1) return `마감까지 ${diffHours}시간 ${diffMins}분`;
        return `마감까지 ${diffMins}분`;
    }

    // ── status card ──────────────────────────────────────────────────
    // Always visible when recruiting. Shows confirmed/wait counts,
    // deadline, and a collapsible participant name list.

    function createStatusCard(event) {
        const card = document.createElement("div");
        card.className = "evs_status_card";

        // ─ header row: title + toggle
        const header = document.createElement("div");
        header.className = "evs_status_header";

        const title = document.createElement("span");
        title.className = "evs_status_title";
        title.textContent = "신청 현황";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "evs_names_toggle";
        toggle.textContent = "참가자 목록 ▾";
        toggle.setAttribute("aria-expanded", "false");

        header.appendChild(title);
        header.appendChild(toggle);

        // ─ chips row: confirmed + wait + deadline
        const chipsRow = document.createElement("div");
        chipsRow.className = "evs_status_chips";

        const confirmedChip = document.createElement("span");
        confirmedChip.className = "evs_stat_chip";
        confirmedChip.textContent = "확정 —명";

        const waitChip = document.createElement("span");
        waitChip.className = "evs_stat_chip evs_stat_wait";
        waitChip.hidden = true;

        const deadlineEl = document.createElement("span");
        deadlineEl.className = "evs_stat_deadline";
        const dl = formatDeadline(event);
        if (dl) deadlineEl.textContent = dl;

        chipsRow.appendChild(confirmedChip);
        chipsRow.appendChild(waitChip);
        chipsRow.appendChild(deadlineEl);

        // ─ names panel (hidden by default)
        const namesPanel = document.createElement("div");
        namesPanel.className = "evs_names_panel";
        namesPanel.setAttribute("aria-hidden", "true");

        card.appendChild(header);
        card.appendChild(chipsRow);
        card.appendChild(namesPanel);

        // toggle behavior (class-based so CSS can animate smoothly)
        let namesOpen = false;
        function setNamesOpen(open) {
            namesOpen = open;
            namesPanel.classList.toggle("is-open", open);
            namesPanel.setAttribute("aria-hidden", String(!open));
            toggle.setAttribute("aria-expanded", String(open));
            toggle.textContent = open ? "참가자 목록 ▴" : "참가자 목록 ▾";
        }
        toggle.addEventListener("click", () => setNamesOpen(!namesOpen));

        // ─ public methods

        function updateStats(confirmed, waiting, cap) {
            const capStr = cap != null ? `/${cap}명` : "명";
            confirmedChip.textContent = `확정 ${confirmed.length}${capStr}`;
            if (waiting.length > 0) {
                waitChip.textContent = `대기 ${waiting.length}명`;
                waitChip.hidden = false;
            } else {
                waitChip.hidden = true;
            }
            // refresh deadline text
            const d = formatDeadline(event);
            deadlineEl.textContent = d || "";
        }

        function updateNames(confirmed, waiting) {
            namesPanel.innerHTML = "";

            // inner wrapper carries the top border (clipped with the panel's max-height)
            const inner = document.createElement("div");
            inner.className = "evs_names_inner";

            if (confirmed.length === 0 && waiting.length === 0) {
                const emp = document.createElement("p");
                emp.className = "evs_names_empty";
                emp.textContent = "아직 신청자가 없습니다.";
                inner.appendChild(emp);
            } else {
                function makeSection(label, list, chipClass) {
                    const sec = document.createElement("div");
                    sec.className = "evs_names_section";
                    const lbl = document.createElement("p");
                    lbl.className = "evs_names_label" + (chipClass === "evs_name_chip_wait" ? " evs_names_label_wait" : "");
                    lbl.textContent = label;
                    sec.appendChild(lbl);
                    const wrap = document.createElement("div");
                    wrap.className = "evs_names_chips";
                    list.forEach(s => {
                        const chip = document.createElement("span");
                        chip.className = "evs_name_chip " + chipClass;
                        chip.textContent = s.nickname;
                        wrap.appendChild(chip);
                    });
                    sec.appendChild(wrap);
                    inner.appendChild(sec);
                }
                if (confirmed.length > 0) makeSection("확정", confirmed, "");
                if (waiting.length  > 0) makeSection("대기", waiting,   "evs_name_chip_wait");
            }

            namesPanel.appendChild(inner);
        }

        function openNames() {
            if (!namesOpen) setNamesOpen(true);
        }

        return { card, updateStats, updateNames, openNames };
    }

    // ── load live signup data ────────────────────────────────────────

    async function loadSignups(event, statusCard) {
        try {
            const result = await api({ action: "listSignups", eventPath: event.path });
            if (!result.signups) return;
            const confirmed = result.signups.filter(s => !s.waitlisted);
            const waiting   = result.signups.filter(s =>  s.waitlisted);
            const cap = event["인원"] ?? null;
            statusCard.updateStats(confirmed, waiting, cap);
            statusCard.updateNames(confirmed, waiting);
        } catch { /* non-critical */ }
    }

    // ── modal ────────────────────────────────────────────────────────

    function openModal(event, onSuccess) {
        document.body.classList.add("evs_modal_open");
        const extra = Array.isArray(event.signupFields) ? event.signupFields : [];

        const overlay = document.createElement("div");
        overlay.className = "evs_overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "evs_dlg_title");

        overlay.innerHTML = `
<div class="evs_dialog">
  <button type="button" class="evs_close" aria-label="닫기">&times;</button>
  <h2 class="evs_dlg_title" id="evs_dlg_title">행사 신청</h2>
  <p class="evs_dlg_event">${event.title}</p>
  <form class="evs_form" novalidate>
    <div class="evs_field">
      <label class="evs_lbl" for="evs_nick">닉네임 <span class="evs_req">*</span></label>
      <span class="evs_hint">참가자 명단에 표시됩니다.</span>
      <input class="evs_input" id="evs_nick" name="nickname" type="text" required autocomplete="off" placeholder="홍길동">
    </div>
    <div class="evs_field">
      <label class="evs_lbl" for="evs_real">실명 <span class="evs_req">*</span></label>
      <span class="evs_hint">운영진에게만 공개됩니다.</span>
      <input class="evs_input" id="evs_real" name="realName" type="text" required autocomplete="name" placeholder="홍길동">
    </div>
    ${extra.map(f => `
    <div class="evs_field">
      <label class="evs_lbl" for="evs_x_${f.name}">${f.label}${f.required ? ' <span class="evs_req">*</span>' : ""}</label>
      ${f.hint ? `<span class="evs_hint">${f.hint}</span>` : ""}
      <input class="evs_input" id="evs_x_${f.name}" name="${f.name}" type="${f.type || "text"}" ${f.required ? "required" : ""} autocomplete="off" placeholder="${f.placeholder || ""}">
    </div>`).join("")}
    <p class="evs_err" hidden></p>
    <button type="submit" class="evs_submit">신청하기</button>
  </form>
</div>`;

        document.body.appendChild(overlay);

        // trigger enter animation — setTimeout(0) flushes the paint of the
        // initial opacity:0 state before we add is-open, so the transition fires
        setTimeout(() => overlay.classList.add("is-open"), 16);

        // focus trap
        const focusable = Array.from(overlay.querySelectorAll(
            "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ));
        setTimeout(() => focusable[0]?.focus(), 60);
        overlay.addEventListener("keydown", e => {
            if (e.key === "Escape") { close(); return; }
            if (e.key !== "Tab") return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        });

        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        overlay.querySelector(".evs_close").addEventListener("click", close);

        function close() {
            // exit animation: swap is-open → is-closing, then remove after transition
            overlay.classList.remove("is-open");
            overlay.classList.add("is-closing");
            setTimeout(() => {
                overlay.remove();
                document.body.classList.remove("evs_modal_open");
            }, 180);
        }

        // form submit
        const form      = overlay.querySelector(".evs_form");
        const errEl     = overlay.querySelector(".evs_err");
        const submitBtn = overlay.querySelector(".evs_submit");

        form.addEventListener("submit", async e => {
            e.preventDefault();
            errEl.hidden = true;

            const nickname = form.nickname.value.trim();
            const realName = form.realName.value.trim();
            if (!nickname) { showErr("닉네임을 입력해주세요."); return; }
            if (!realName) { showErr("실명을 입력해주세요."); return; }

            const metadata = {};
            for (const f of extra) {
                const val = (form.elements[f.name]?.value || "").trim();
                if (f.required && !val) { showErr(`${f.label}을(를) 입력해주세요.`); return; }
                if (val) metadata[f.name] = val;
            }

            setLoading(true);
            try {
                const result = await api({
                    action: "signup",
                    eventPath: event.path,
                    nickname,
                    realName,
                    capacity: event["인원"] ?? null,
                    metadata,
                });
                if (result.error) { showErr(result.error); setLoading(false); return; }

                setSaved(event.path, {
                    id: result.id,
                    editToken: result.editToken,
                    nickname,
                    waitlisted: result.waitlisted,
                });
                close();
                onSuccess(result);
            } catch {
                showErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
                setLoading(false);
            }
        });

        function showErr(msg) { errEl.textContent = msg; errEl.hidden = false; }
        function setLoading(on) {
            submitBtn.disabled = on;
            submitBtn.textContent = on ? "신청 중…" : "신청하기";
        }
    }

    // ── apply-button state ───────────────────────────────────────────

    function setSignedUpState(applyDiv, applyBtn, statusCard, event, saved) {
        // swap button → "신청 완료 ✓" (clone to drop all prior listeners)
        if (applyBtn) {
            applyBtn.classList.remove("is-disabled");
            applyBtn.classList.add("is-signed-up");
            applyBtn.setAttribute("aria-disabled", "true");
            applyBtn.setAttribute("tabindex", "-1");
            applyBtn.textContent = "신청 완료 ✓";
            const clone = applyBtn.cloneNode(true);
            clone.addEventListener("click", e => e.preventDefault());
            applyBtn.replaceWith(clone);

            // cancel button — right after the signed-up button
            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "evs_cancel_btn";
            cancelBtn.textContent = "신청 취소";
            clone.insertAdjacentElement("afterend", cancelBtn);

            cancelBtn.addEventListener("click", async () => {
                if (!confirm(`${saved.nickname}님의 신청을 취소하시겠습니까?`)) return;
                cancelBtn.disabled = true;
                cancelBtn.textContent = "취소 중…";
                try {
                    const result = await api({
                        action: "cancelSignup",
                        id: saved.id,
                        editToken: saved.editToken,
                    });
                    if (result.error) {
                        alert(result.error);
                        cancelBtn.disabled = false;
                        cancelBtn.textContent = "신청 취소";
                        return;
                    }
                    clearSaved(event.path);
                    window.location.reload();
                } catch {
                    alert("오류가 발생했습니다. 다시 시도해주세요.");
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = "신청 취소";
                }
            });
        }

        // auto-expand names panel so user can see their name in the list
        statusCard.openNames();
    }

    function showToast(waitlisted, applyDiv) {
        applyDiv.querySelectorAll(".evs_toast").forEach(el => el.remove());
        const toast = document.createElement("p");
        toast.className = "evs_toast" + (waitlisted ? " is-wait" : "");
        toast.textContent = waitlisted
            ? "신청 인원 초과로 대기 명단에 등록되었습니다. 취소자 발생 시 순서대로 안내드립니다."
            : "신청이 완료되었습니다. 행사 당일에 뵙겠습니다! 🍵";
        applyDiv.insertBefore(toast, applyDiv.firstChild);
    }

    // ── init ─────────────────────────────────────────────────────────

    function init() {
        if (typeof teaClubEvents === "undefined") return;

        const segments = window.location.pathname.split("/").filter(Boolean);
        const here = segments.slice(-2).join("/");
        const event = teaClubEvents.find(e => e.path === here);
        if (!event) return;

        // only run when sign-up is open
        const status = typeof effectiveEventStatus === "function"
            ? effectiveEventStatus(event)
            : (event.status || "closed");
        if (status !== "recruiting") return;

        const applyDiv = document.querySelector(".event_apply");
        const applyBtn = document.querySelector(".event_apply_btn");
        if (!applyDiv) return;

        // build status card and insert before the apply button
        const statusCard = createStatusCard(event);
        if (applyBtn) {
            applyDiv.insertBefore(statusCard.card, applyBtn);
        } else {
            applyDiv.appendChild(statusCard.card);
        }

        // load live counts + names
        loadSignups(event, statusCard);

        const saved = getSaved(event.path);
        if (saved) {
            setSignedUpState(applyDiv, applyBtn, statusCard, event, saved);
        } else if (applyBtn) {
            applyBtn.addEventListener("click", e => {
                e.preventDefault();
                openModal(event, result => {
                    const latest = getSaved(event.path);
                    setSignedUpState(applyDiv, applyBtn, statusCard, event, latest);
                    showToast(result.waitlisted, applyDiv);
                    loadSignups(event, statusCard); // refresh counts + names
                });
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

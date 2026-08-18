// Supabase Edge Function — 소모임 신청 backend
// Replaces the old Google Apps Script / Code.gs backend.
// Actions: list | createEvent | updateEvent | deleteEvent | signup | cancelSignup | eventParticipants | cancelSignupByPassword | adminListAll | approveEvent
//
// Required env vars (set in Supabase dashboard → Settings → Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD
//
// JWT verification must be OFF (public endpoint — Settings → API → Edge Functions).
//
// Run this SQL once in the Supabase SQL editor to create the tables:
// ─────────────────────────────────────────────────────────────────────────────
//   CREATE TABLE IF NOT EXISTS join_events (
//     id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//     date            TEXT        NOT NULL,          -- "YYYY-MM-DD"
//     time            TEXT,                          -- "HH:MM", nullable
//     title           TEXT        NOT NULL,
//     location        TEXT,
//     map_link        TEXT,
//     capacity        INTEGER,
//     host            TEXT        NOT NULL,
//     description     TEXT,
//     password_hash   TEXT        NOT NULL,
//     host_signup_id  UUID,
//     created_at      TIMESTAMPTZ DEFAULT now(),
//     edit_token      UUID        NOT NULL,
//     approved_at     TIMESTAMPTZ,           -- NULL = pending admin approval
//     deleted_at      TIMESTAMPTZ            -- NULL = live; non-NULL = soft-deleted
//   );
//
//   CREATE TABLE IF NOT EXISTS join_signups (
//     id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//     event_id        UUID        NOT NULL REFERENCES join_events(id),
//     name            TEXT        NOT NULL,
//     real_name       TEXT        NOT NULL,
//     contact         TEXT,
//     created_at      TIMESTAMPTZ DEFAULT now(),
//     edit_token      UUID        NOT NULL,
//     canceled_at     TIMESTAMPTZ,           -- NULL = active; non-NULL = soft-deleted
//     cancel_password TEXT                   -- SHA-256 hash; NULL if not set
//   );
//
// If the table already exists, just add the cancel_password column:
//   ALTER TABLE join_signups ADD COLUMN IF NOT EXISTS cancel_password TEXT;
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── config ────────────────────────────────────────────────────────────────────

// New signups close this many days before the event (day-level, KST).
// Equivalent to ~24 h before: you can sign up on the day before the event
// but not on the event day itself.
const SIGNUP_CLOSE_DAYS = 1;

// Signup withdrawals are blocked this many days before the event (day-level).
const CANCEL_DEADLINE_DAYS = 2;

// ── helpers ───────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// SHA-256 hex digest — event owner passwords are never stored in plain text.
async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pw)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Today's date as "YYYY-MM-DD" in KST (UTC+9).
function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Subtract `days` from a "YYYY-MM-DD" string; return the result as "YYYY-MM-DD".
function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// True when today (KST) is on or after the cutoff — the action is blocked.
// cutoff = eventDate − days, so `days=1` blocks on the event day itself and
// the day before; `days=2` blocks those two days plus one more day earlier.
function isPastDeadline(eventDate: string, days: number): boolean {
  return todayKST() >= subtractDays(eventDate, days);
}

// Camel-case mappers for DB rows → API responses (frontend uses camelCase).
// deno-lint-ignore no-explicit-any
function mapEvent(ev: any) {
  return {
    id: ev.id,
    date: ev.date,
    time: ev.time ?? null,
    title: ev.title,
    location: ev.location ?? null,
    mapLink: ev.map_link ?? null,
    capacity: ev.capacity ?? null,
    host: ev.host,
    description: ev.description ?? null,
    hostSignupId: ev.host_signup_id ?? null,
    createdAt: ev.created_at,
    // Newly created events start with approved_at IS NULL. Only after an admin
    // approves via the approveEvent action can non-host users sign up.
    approvedAt: ev.approved_at ?? null,
    // Soft-delete marker (see deleteEvent action). Deleted events are hidden
    // from the public list but preserved for the admin 이력 view.
    deletedAt: ev.deleted_at ?? null,
  };
}

// deno-lint-ignore no-explicit-any
function mapSignup(s: any) {
  return { id: s.id, eventId: s.event_id, name: s.name, createdAt: s.created_at };
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";

  try {
    const body = await req.json();
    const { action } = body;

    // ── list ──────────────────────────────────────────────────────────
    if (action === "list") {
      const [{ data: evs, error: evErr }, { data: sigs, error: sigErr }] =
        await Promise.all([
          supabase
            .from("join_events")
            .select(
              "id, date, time, title, location, map_link, capacity, host, description, host_signup_id, created_at, approved_at, deleted_at"
            )
            .is("deleted_at", null)          // deleted events don't appear publicly
            .order("date"),
          supabase
            .from("join_signups")
            .select("id, event_id, name, created_at")
            .is("canceled_at", null)
            .order("created_at"),
        ]);
      if (evErr) throw evErr;
      if (sigErr) throw sigErr;
      return json({
        ok: true,
        events: (evs ?? []).map(mapEvent),
        signups: (sigs ?? []).map(mapSignup),
      });
    }

    // ── createEvent ───────────────────────────────────────────────────
    if (action === "createEvent") {
      const {
        title, date, host, hostRealName, capacity,
        time, location, mapLink, description, password,
      } = body;

      if (!title || !date || !host)
        return json({ ok: false, error: "제목, 날짜, 주최자 이름은 필수예요." });
      if (!hostRealName)
        return json({ ok: false, error: "주최자 실명을 입력해주세요." });
      if (!password)
        return json({ ok: false, error: "비밀번호를 설정해주세요. 나중에 수정/삭제할 때 필요해요." });
      // Time is required — 30-min grid enforced client-side, matched here.
      if (!time || !/^\d{2}:\d{2}$/.test(String(time)))
        return json({ ok: false, error: "시간을 선택해주세요." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))
        return json({ ok: false, error: "날짜 형식이 올바르지 않아요." });

      const cap = Number(capacity);
      if (capacity == null || capacity === "" || !Number.isFinite(cap) || cap < 3)
        return json({ ok: false, error: "정원은 3 이상의 숫자여야 해요 (본인 포함)." });

      const pwHash = await hashPassword(String(password));
      const editToken = crypto.randomUUID();

      // New events start unapproved (approved_at NULL). The DB column default
      // is null so we don't need to set anything here; the approveEvent
      // action below is the only path to flip it to a real timestamp.
      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .insert({
          date,
          time: time || null,
          title,
          location: location || null,
          map_link: mapLink || null,
          capacity: cap,
          host,
          description: description || null,
          password_hash: pwHash,
          edit_token: editToken,
        })
        .select(
          "id, date, time, title, location, map_link, capacity, host, description, created_at, approved_at"
        )
        .single();
      if (evErr) throw evErr;

      // Auto-signup the host (they count toward their own capacity)
      const { data: hostSignup, error: hsErr } = await supabase
        .from("join_signups")
        .insert({
          event_id: ev.id,
          name: host,
          real_name: hostRealName,
          contact: null,
          edit_token: crypto.randomUUID(),
        })
        .select("id")
        .single();
      if (hsErr) throw hsErr;

      // Backfill host_signup_id on the event row
      await supabase
        .from("join_events")
        .update({ host_signup_id: hostSignup.id })
        .eq("id", ev.id);

      return json({
        ok: true,
        event: { ...mapEvent(ev), hostSignupId: hostSignup.id },
        editToken,
      });
    }

    // ── updateEvent ───────────────────────────────────────────────────
    if (action === "updateEvent") {
      const {
        id, editToken, password, adminPassword,
        title, date, host, capacity, time, location, mapLink, description,
      } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, password_hash, edit_token, host, host_signup_id, deleted_at")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });
      if (ev.deleted_at) return json({ ok: false, error: "삭제된 소모임이에요." });

      const isAdmin = ADMIN_PASSWORD !== "" && adminPassword === ADMIN_PASSWORD;
      const tokenOk = editToken && ev.edit_token === editToken;
      const pwHash = password ? await hashPassword(String(password)) : null;
      const pwOk = pwHash && ev.password_hash === pwHash;
      if (!tokenOk && !pwOk && !isAdmin)
        return json({ ok: false, error: "수정 권한이 없어요. 비밀번호를 확인해주세요." });

      if (!title || !date || !host)
        return json({ ok: false, error: "제목, 날짜, 주최자 이름은 필수예요." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))
        return json({ ok: false, error: "날짜 형식이 올바르지 않아요." });
      // Time is required on edit too — the create form and edit form share
      // the same modal, so consistency matters.
      if (!time || !/^\d{2}:\d{2}$/.test(String(time)))
        return json({ ok: false, error: "시간을 선택해주세요." });

      const cap = Number(capacity);
      if (capacity == null || capacity === "" || !Number.isFinite(cap) || cap < 3)
        return json({ ok: false, error: "정원은 3 이상의 숫자여야 해요 (본인 포함)." });

      // Don't let capacity drop below the current active headcount
      const { count: activeCount } = await supabase
        .from("join_signups")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id)
        .is("canceled_at", null);
      if (cap < (activeCount ?? 0))
        return json({
          ok: false,
          error: `이미 ${activeCount}명이 참가 중이라 정원을 그보다 줄일 수 없어요.`,
        });

      const { data: updated, error: updErr } = await supabase
        .from("join_events")
        .update({
          date,
          time: time || null,
          title,
          location: location || null,
          map_link: mapLink || null,
          capacity: cap,
          host,
          description: description || null,
        })
        .eq("id", id)
        .select(
          "id, date, time, title, location, map_link, capacity, host, description, host_signup_id, created_at"
        )
        .single();
      if (updErr) throw updErr;

      // Keep the host's auto-signup name in sync when the host name changes
      if (ev.host_signup_id && ev.host !== host) {
        await supabase
          .from("join_signups")
          .update({ name: host })
          .eq("id", ev.host_signup_id);
      }

      return json({ ok: true, event: mapEvent(updated) });
    }

    // ── deleteEvent ───────────────────────────────────────────────────
    if (action === "deleteEvent") {
      const { id, editToken, password, adminPassword } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, password_hash, edit_token, host_signup_id, deleted_at")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });
      if (ev.deleted_at) return json({ ok: true, alreadyDeleted: true });

      const isAdmin = ADMIN_PASSWORD !== "" && adminPassword === ADMIN_PASSWORD;
      const tokenOk = editToken && ev.edit_token === editToken;
      const pwHash = password ? await hashPassword(String(password)) : null;
      const pwOk = pwHash && ev.password_hash === pwHash;
      if (!tokenOk && !pwOk && !isAdmin)
        return json({ ok: false, error: "삭제 권한이 없어요. 비밀번호를 확인해주세요." });

      // Count active (non-host, non-canceled) signups — these block deletion
      const hostId = ev.host_signup_id ?? "00000000-0000-0000-0000-000000000000";
      const { count: otherCount } = await supabase
        .from("join_signups")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id)
        .neq("id", hostId)
        .is("canceled_at", null);
      if ((otherCount ?? 0) > 0 && !isAdmin)
        return json({ ok: false, error: "다른 참가자가 있어 삭제할 수 없어요." });

      // Soft-delete the event so the admin history panel can still see it.
      // Also stamp canceled_at on every still-active signup so the roster
      // reads consistently (an active signup on a deleted event would be
      // misleading). Uses the same timestamp for both writes so an audit
      // reader can pair them.
      const nowIso = new Date().toISOString();
      await supabase
        .from("join_signups")
        .update({ canceled_at: nowIso })
        .eq("event_id", id)
        .is("canceled_at", null);
      await supabase
        .from("join_events")
        .update({ deleted_at: nowIso })
        .eq("id", id);

      return json({ ok: true, deletedAt: nowIso });
    }

    // ── signup ────────────────────────────────────────────────────────
    if (action === "signup") {
      const { eventId, name, realName, contact, cancelPassword } = body;
      if (!eventId || !name) return json({ ok: false, error: "이름을 입력해주세요." });
      if (!realName) return json({ ok: false, error: "실명을 입력해주세요." });
      // Required so a signup made on one device can still be cancelled from
      // another (see cancelSignupByPassword). Was optional; now mandatory.
      if (!cancelPassword) return json({ ok: false, error: "취소 비밀번호를 설정해주세요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, date, capacity, approved_at, deleted_at")
        .eq("id", eventId)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });
      if (ev.deleted_at) return json({ ok: false, error: "삭제된 소모임이에요." });

      // Signups from non-hosts are blocked until an admin approves.
      // The host is auto-signed up inside createEvent above, so their
      // participation never routes through this action and isn't affected.
      if (ev.approved_at == null)
        return json({ ok: false, error: "아직 관리자 승인 대기 중인 소모임이에요." });

      if (isPastDeadline(ev.date, SIGNUP_CLOSE_DAYS))
        return json({ ok: false, error: "신청이 마감되었어요. (행사 24시간 전 마감)" });

      // Count active signups and check for duplicate names
      const { data: existing, error: listErr } = await supabase
        .from("join_signups")
        .select("id, name")
        .eq("event_id", eventId)
        .is("canceled_at", null);
      if (listErr) throw listErr;

      if (ev.capacity != null && (existing?.length ?? 0) >= ev.capacity)
        return json({ ok: false, error: "정원이 찼어요." });
      if (
        existing?.some(
          (s) => s.name.trim().toLowerCase() === String(name).trim().toLowerCase()
        )
      )
        return json({ ok: false, error: "이미 같은 이름으로 신청되어 있어요." });

      const editToken = crypto.randomUUID();
      const cancelPwHash = cancelPassword
        ? await hashPassword(String(cancelPassword))
        : null;

      const { data: sig, error: sigErr } = await supabase
        .from("join_signups")
        .insert({
          event_id: eventId,
          name: String(name).trim(),
          real_name: String(realName).trim(),
          contact: contact ? String(contact).trim() : null,
          edit_token: editToken,
          cancel_password: cancelPwHash,
        })
        .select("id, event_id, name, created_at")
        .single();
      if (sigErr) throw sigErr;

      return json({
        ok: true,
        signup: {
          id: sig.id,
          eventId: sig.event_id,
          name: sig.name,
          createdAt: sig.created_at,
        },
        editToken,
      });
    }

    // ── cancelSignup ──────────────────────────────────────────────────
    if (action === "cancelSignup") {
      const { id, editToken } = body;
      if (!id || !editToken)
        return json({ ok: false, error: "id와 editToken이 필요해요." });

      const { data: sig, error: sigErr } = await supabase
        .from("join_signups")
        .select("id, edit_token, canceled_at, event_id")
        .eq("id", id)
        .single();
      if (sigErr || !sig) return json({ ok: false, error: "존재하지 않는 신청이에요." });
      if (sig.edit_token !== editToken) return json({ ok: false, error: "취소 권한이 없어요." });
      if (sig.canceled_at) return json({ ok: false, error: "이미 취소된 신청이에요." });

      // Enforce the 2-day withdrawal deadline
      const { data: ev } = await supabase
        .from("join_events")
        .select("date")
        .eq("id", sig.event_id)
        .single();
      if (ev && isPastDeadline(ev.date, CANCEL_DEADLINE_DAYS))
        return json({ ok: false, error: "행사 2일 전부터는 신청을 취소할 수 없어요." });

      // Soft-delete: stamp canceled_at so the cancellation is tracked
      await supabase
        .from("join_signups")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", id);

      return json({ ok: true });
    }

    // ── cancelSignupByPassword (different device — realName + cancel password) ──
    if (action === "cancelSignupByPassword") {
      const { eventId, realName, cancelPassword } = body;
      if (!eventId || !realName || !cancelPassword)
        return json({ ok: false, error: "필수 입력값이 누락되었어요." });

      // Enforce the 2-day withdrawal deadline before touching anything
      const { data: ev } = await supabase
        .from("join_events")
        .select("date")
        .eq("id", eventId)
        .single();
      if (ev && isPastDeadline(ev.date, CANCEL_DEADLINE_DAYS))
        return json({ ok: false, error: "행사 2일 전부터는 신청을 취소할 수 없어요." });

      const pwHash = await hashPassword(String(cancelPassword));

      // Look up by eventId + real_name + hashed cancel_password (active signups only)
      const { data: sig, error: sigErr } = await supabase
        .from("join_signups")
        .select("id")
        .eq("event_id", eventId)
        .eq("real_name", String(realName).trim())
        .eq("cancel_password", pwHash)
        .is("canceled_at", null)
        .limit(1)
        .single();

      if (sigErr || !sig)
        return json({ ok: false, error: "실명 또는 취소 비밀번호가 올바르지 않아요." });

      await supabase
        .from("join_signups")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", sig.id);

      return json({ ok: true });
    }

    // ── eventParticipants (host / admin-gated) ────────────────────────
    if (action === "eventParticipants") {
      const { id, editToken, password, adminPassword } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, password_hash, edit_token, host_signup_id")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });

      const isAdmin = ADMIN_PASSWORD !== "" && adminPassword === ADMIN_PASSWORD;
      const tokenOk = editToken && ev.edit_token === editToken;
      const pwHash = password ? await hashPassword(String(password)) : null;
      const pwOk = pwHash && ev.password_hash === pwHash;
      if (!tokenOk && !pwOk && !isAdmin)
        return json({ ok: false, error: "권한이 없어요. 비밀번호를 확인해주세요." });

      // Admin sees all signups including canceled; host/owner sees active participants only
      let sigQuery = supabase
        .from("join_signups")
        .select("id, name, real_name, contact, created_at, canceled_at")
        .eq("event_id", id)
        .order("created_at");
      if (!isAdmin) sigQuery = sigQuery.is("canceled_at", null);
      const { data: sigs, error: sigErr } = await sigQuery;
      if (sigErr) throw sigErr;

      const participants = (sigs ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        realName: s.real_name,
        contact: s.contact ?? "",
        isHost: s.id === ev.host_signup_id,
        createdAt: s.created_at,
        canceledAt: isAdmin ? (s.canceled_at ?? null) : null,
      }));

      return json({ ok: true, participants });
    }

    // ── adminListAll (admin-only: all events + all signups for history) ─
    if (action === "adminListAll") {
      const { adminPassword } = body;
      const isAdmin = ADMIN_PASSWORD !== "" && adminPassword === ADMIN_PASSWORD;
      if (!isAdmin)
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." });

      const [{ data: evs, error: evErr }, { data: sigs, error: sigErr }] = await Promise.all([
        supabase
          .from("join_events")
          .select("id, date, time, title, location, capacity, host, host_signup_id, created_at, approved_at, deleted_at")
          .order("date"),
        supabase
          .from("join_signups")
          .select("id, event_id, name, real_name, contact, created_at, canceled_at")
          .order("created_at"),
      ]);
      if (evErr) throw evErr;
      if (sigErr) throw sigErr;

      const events = (evs ?? []).map((e) => ({
        id: e.id,
        date: e.date,
        time: e.time ?? "",
        title: e.title,
        location: e.location ?? "",
        capacity: e.capacity ?? null,
        host: e.host,
        hostSignupId: e.host_signup_id,
        createdAt: e.created_at,
        approvedAt: e.approved_at ?? null,
        deletedAt: e.deleted_at ?? null,
      }));

      const signups = (sigs ?? []).map((s) => ({
        id: s.id,
        eventId: s.event_id,
        name: s.name,
        realName: s.real_name,
        contact: s.contact ?? "",
        createdAt: s.created_at,
        canceledAt: s.canceled_at ?? null,
      }));

      return json({ ok: true, events, signups });
    }

    // ── approveEvent (admin-only) ─────────────────────────────────────
    // Flips approved_at from NULL to now(), unblocking signups. A no-op
    // (still ok) if the event was already approved, so a double click on
    // the admin button doesn't error.
    if (action === "approveEvent") {
      const { id, adminPassword } = body;
      const isAdmin = ADMIN_PASSWORD !== "" && adminPassword === ADMIN_PASSWORD;
      if (!isAdmin)
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." });
      if (!id) return json({ ok: false, error: "id가 필요해요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, approved_at, deleted_at")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });
      if (ev.deleted_at) return json({ ok: false, error: "삭제된 소모임이에요." });

      if (ev.approved_at != null) {
        return json({ ok: true, alreadyApproved: true, approvedAt: ev.approved_at });
      }

      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("join_events")
        .update({ approved_at: nowIso })
        .eq("id", id);
      if (updErr) throw updErr;

      return json({ ok: true, approvedAt: nowIso });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (err: unknown) {
    // Supabase-JS returns a PostgrestError object that isn't an Error subclass,
    // so the naive `err.message` check dropped useful info on the floor. Pull
    // the message off whichever shape we got and always log the raw object to
    // the function log so we can see it in the Supabase dashboard.
    console.error("[join] handler error:", err);
    // deno-lint-ignore no-explicit-any
    const anyErr = err as any;
    const msg =
      (anyErr && typeof anyErr.message === "string" && anyErr.message) ||
      (anyErr && typeof anyErr.details === "string" && anyErr.details) ||
      (anyErr && typeof anyErr.hint === "string" && anyErr.hint) ||
      "서버 오류가 발생했습니다.";
    return json({ ok: false, error: msg }, 500);
  }
});

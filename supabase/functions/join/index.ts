// Supabase Edge Function — 소모임 신청 backend
// Replaces the old Google Apps Script / Code.gs backend.
// Actions: list | createEvent | updateEvent | deleteEvent | signup | cancelSignup | eventParticipants
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
//     edit_token      UUID        NOT NULL
//   );
//
//   CREATE TABLE IF NOT EXISTS join_signups (
//     id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//     event_id    UUID        NOT NULL REFERENCES join_events(id),
//     name        TEXT        NOT NULL,
//     real_name   TEXT        NOT NULL,
//     contact     TEXT,
//     created_at  TIMESTAMPTZ DEFAULT now(),
//     edit_token  UUID        NOT NULL,
//     canceled_at TIMESTAMPTZ            -- NULL = active; non-NULL = soft-deleted
//   );
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
              "id, date, time, title, location, map_link, capacity, host, description, host_signup_id, created_at"
            )
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))
        return json({ ok: false, error: "날짜 형식이 올바르지 않아요." });

      const cap = Number(capacity);
      if (capacity == null || capacity === "" || !Number.isFinite(cap) || cap < 1)
        return json({ ok: false, error: "정원은 1 이상의 숫자여야 해요 (본인 포함)." });

      const pwHash = await hashPassword(String(password));
      const editToken = crypto.randomUUID();

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
          "id, date, time, title, location, map_link, capacity, host, description, created_at"
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
        .select("id, password_hash, edit_token, host, host_signup_id")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });

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

      const cap = Number(capacity);
      if (capacity == null || capacity === "" || !Number.isFinite(cap) || cap < 1)
        return json({ ok: false, error: "정원은 1 이상의 숫자여야 해요 (본인 포함)." });

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
        .select("id, password_hash, edit_token, host_signup_id")
        .eq("id", id)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });

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

      // Delete all signups for this event, then the event itself
      await supabase.from("join_signups").delete().eq("event_id", id);
      await supabase.from("join_events").delete().eq("id", id);

      return json({ ok: true });
    }

    // ── signup ────────────────────────────────────────────────────────
    if (action === "signup") {
      const { eventId, name, realName, contact } = body;
      if (!eventId || !name) return json({ ok: false, error: "이름을 입력해주세요." });
      if (!realName) return json({ ok: false, error: "실명을 입력해주세요." });

      const { data: ev, error: evErr } = await supabase
        .from("join_events")
        .select("id, date, capacity")
        .eq("id", eventId)
        .single();
      if (evErr || !ev) return json({ ok: false, error: "존재하지 않는 소모임이에요." });

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
      const { data: sig, error: sigErr } = await supabase
        .from("join_signups")
        .insert({
          event_id: eventId,
          name: String(name).trim(),
          real_name: String(realName).trim(),
          contact: contact ? String(contact).trim() : null,
          edit_token: editToken,
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

      // Return ALL signups (including canceled) so the host can see who withdrew
      const { data: sigs, error: sigErr } = await supabase
        .from("join_signups")
        .select("id, name, real_name, contact, created_at, canceled_at")
        .eq("event_id", id)
        .order("created_at");
      if (sigErr) throw sigErr;

      const participants = (sigs ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        realName: s.real_name,
        contact: s.contact ?? "",
        isHost: s.id === ev.host_signup_id,
        createdAt: s.created_at,
        canceledAt: s.canceled_at ?? null,
      }));

      return json({ ok: true, participants });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return json({ ok: false, error: msg }, 500);
  }
});

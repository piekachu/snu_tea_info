// Supabase Edge Function — event sign-up backend
// Actions: signup | cancelSignup | cancelSignupByPassword | listSignups | adminListSignups
// JWT verification must be OFF in the Supabase dashboard (public endpoint).
// Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD
//
// Schema requirements (run once in Supabase SQL editor):
//   ALTER TABLE event_signups
//     ADD COLUMN IF NOT EXISTS cancel_password TEXT,
//     ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── password hashing ──────────────────────────────────────────────────────────
// SHA-256 hex digest — used for cancel_password storage and comparison.
async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pw)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── withdrawal deadline helpers ───────────────────────────────────────────────

// Today's date as "YYYY-MM-DD" in KST (UTC+9).
function todayDateKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// Subtract `days` from a "YYYY-MM-DD" string; return the result as "YYYY-MM-DD".
function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// Returns true if today (KST) is within `days` days of the event date,
// i.e. withdrawal is no longer permitted.
function isPastWithdrawalDeadline(eventDate: string, days = 2): boolean {
  const cutoff = subtractDays(eventDate, days); // first blocked day
  return todayDateKST() >= cutoff;
}

// ── waitlist promotion ────────────────────────────────────────────────────────
// When a confirmed slot is freed, promote the earliest waitlisted person
// (for per-venue events, only from the same venue's waitlist).
async function promoteWaitlisted(
  supabase: ReturnType<typeof createClient>,
  eventPath: string,
  metadata: Record<string, unknown>
) {
  const venueVal =
    typeof metadata.venue === "string" ? metadata.venue : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("event_signups")
    .select("id")
    .eq("event_path", eventPath)
    .eq("waitlisted", true)
    .is("canceled_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (venueVal) q = q.contains("metadata", { venue: venueVal });

  const { data: next } = await q.single();
  if (next) {
    await supabase
      .from("event_signups")
      .update({ waitlisted: false })
      .eq("id", next.id);
  }
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

    // ── signup ────────────────────────────────────────────────────────
    if (action === "signup") {
      const {
        eventPath, nickname, realName, capacity, metadata = {},
        venueField, venueValue, venueCapacity,
        cancelPassword,          // optional user-set cancel password
      } = body;

      if (!eventPath || !nickname || !realName) {
        return json({ error: "필수 입력값이 누락되었습니다." }, 400);
      }

      let waitlisted = false;

      if (venueField && venueValue != null && venueCapacity != null) {
        // Per-venue capacity: count active confirmed signups for this venue
        const { count: venueCount, error: venueErr } = await supabase
          .from("event_signups")
          .select("*", { count: "exact", head: true })
          .eq("event_path", eventPath)
          .eq("waitlisted", false)
          .is("canceled_at", null)
          .contains("metadata", { [venueField]: venueValue });

        if (venueErr) throw venueErr;
        waitlisted = (venueCount ?? 0) >= venueCapacity;
      } else if (capacity != null) {
        // Total capacity fallback
        const { count, error: countErr } = await supabase
          .from("event_signups")
          .select("*", { count: "exact", head: true })
          .eq("event_path", eventPath)
          .eq("waitlisted", false)
          .is("canceled_at", null);

        if (countErr) throw countErr;
        waitlisted = (count ?? 0) >= capacity;
      }

      const editToken = crypto.randomUUID();
      const pwHash = cancelPassword
        ? await hashPassword(String(cancelPassword))
        : null;

      const { data, error } = await supabase
        .from("event_signups")
        .insert({
          event_path: eventPath,
          nickname,
          real_name: realName,
          waitlisted,
          edit_token: editToken,
          metadata,
          cancel_password: pwHash,
        })
        .select("id")
        .single();

      if (error) throw error;
      return json({ success: true, id: data.id, editToken, waitlisted });
    }

    // ── cancelSignup (same device — uses editToken) ───────────────────
    if (action === "cancelSignup") {
      const { id, editToken, eventDate } = body;
      if (!id || !editToken) {
        return json({ error: "id와 editToken이 필요합니다." }, 400);
      }

      // Reject if past the 2-day withdrawal deadline
      if (
        eventDate &&
        typeof eventDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
      ) {
        if (isPastWithdrawalDeadline(eventDate)) {
          return json(
            { error: "행사 2일 전부터 신청 취소가 불가합니다." },
            403
          );
        }
      }

      // Soft-delete: stamp canceled_at instead of deleting the row
      const { data, error } = await supabase
        .from("event_signups")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", id)
        .eq("edit_token", editToken)
        .is("canceled_at", null)      // guard: already canceled → 404
        .select("id, event_path, waitlisted, metadata")
        .single();

      if (error || !data) {
        return json({ error: "신청 내역을 찾을 수 없습니다." }, 404);
      }

      // Promote first waitlisted person if a confirmed slot was freed
      if (!data.waitlisted) {
        const parsedMeta =
          data.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {};
        await promoteWaitlisted(supabase, data.event_path, parsedMeta);
      }

      return json({ success: true });
    }

    // ── cancelSignupByPassword (different device — uses real name + cancel password) ──
    if (action === "cancelSignupByPassword") {
      const { eventPath, realName, cancelPassword, eventDate } = body;
      if (!eventPath || !realName || !cancelPassword) {
        return json({ error: "필수 입력값이 누락되었습니다." }, 400);
      }

      if (
        eventDate &&
        typeof eventDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
      ) {
        if (isPastWithdrawalDeadline(eventDate)) {
          return json(
            { error: "행사 2일 전부터 신청 취소가 불가합니다." },
            403
          );
        }
      }

      const pwHash = await hashPassword(String(cancelPassword));

      // Lookup by real_name + hashed cancel_password (active signups only)
      const { data, error } = await supabase
        .from("event_signups")
        .select("id, event_path, waitlisted, metadata")
        .eq("event_path", eventPath)
        .eq("real_name", realName)
        .eq("cancel_password", pwHash)
        .is("canceled_at", null)
        .limit(1)
        .single();

      if (error || !data) {
        return json(
          { error: "실명 또는 취소 비밀번호가 올바르지 않습니다." },
          404
        );
      }

      await supabase
        .from("event_signups")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", data.id);

      if (!data.waitlisted) {
        const parsedMeta =
          data.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {};
        await promoteWaitlisted(supabase, data.event_path, parsedMeta);
      }

      return json({ success: true });
    }

    // ── listSignups (public — active signups only, no real_name) ─────
    if (action === "listSignups") {
      const { eventPath } = body;
      if (!eventPath) return json({ error: "eventPath가 필요합니다." }, 400);

      const { data, error } = await supabase
        .from("event_signups")
        .select("id, nickname, waitlisted, created_at, metadata")
        .eq("event_path", eventPath)
        .is("canceled_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ success: true, signups: data });
    }

    // ── adminListSignups (password-gated; all signups, including canceled) ─
    if (action === "adminListSignups") {
      const { eventPath, password } = body;
      if (password !== ADMIN_PASSWORD) {
        return json({ error: "비밀번호가 올바르지 않습니다." }, 403);
      }
      if (!eventPath) return json({ error: "eventPath가 필요합니다." }, 400);

      const { data, error } = await supabase
        .from("event_signups")
        .select(
          "id, nickname, real_name, waitlisted, created_at, canceled_at, metadata"
        )
        .eq("event_path", eventPath)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ success: true, signups: data });
    }

    return json({ error: "알 수 없는 action입니다." }, 400);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return json({ error: msg }, 500);
  }
});

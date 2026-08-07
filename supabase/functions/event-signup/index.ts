// Supabase Edge Function — event sign-up backend
// Actions: signup | cancelSignup | listSignups | adminListSignups
// JWT verification must be OFF in the Supabase dashboard (public endpoint).
// Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD

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
      const { eventPath, nickname, realName, capacity, metadata = {},
              venueField, venueValue, venueCapacity } = body;

      if (!eventPath || !nickname || !realName) {
        return json({ error: "필수 입력값이 누락되었습니다." }, 400);
      }

      let waitlisted = false;

      if (venueField && venueValue != null && venueCapacity != null) {
        // Per-venue capacity: count confirmed signups for this specific venue
        const { count: venueCount, error: venueErr } = await supabase
          .from("event_signups")
          .select("*", { count: "exact", head: true })
          .eq("event_path", eventPath)
          .eq("waitlisted", false)
          .contains("metadata", { [venueField]: venueValue });

        if (venueErr) throw venueErr;
        waitlisted = (venueCount ?? 0) >= venueCapacity;
      } else if (capacity != null) {
        // Total capacity fallback (events without per-venue fields)
        const { count, error: countErr } = await supabase
          .from("event_signups")
          .select("*", { count: "exact", head: true })
          .eq("event_path", eventPath)
          .eq("waitlisted", false);

        if (countErr) throw countErr;
        waitlisted = (count ?? 0) >= capacity;
      }

      const editToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from("event_signups")
        .insert({
          event_path: eventPath,
          nickname,
          real_name: realName,
          waitlisted,
          edit_token: editToken,
          metadata,
        })
        .select("id")
        .single();

      if (error) throw error;
      return json({ success: true, id: data.id, editToken, waitlisted });
    }

    // ── cancelSignup ──────────────────────────────────────────────────
    if (action === "cancelSignup") {
      const { id, editToken } = body;
      if (!id || !editToken) {
        return json({ error: "id와 editToken이 필요합니다." }, 400);
      }

      const { data, error } = await supabase
        .from("event_signups")
        .delete()
        .eq("id", id)
        .eq("edit_token", editToken)
        .select("id, event_path, waitlisted, metadata")
        .single();

      if (error || !data) {
        return json({ error: "신청 내역을 찾을 수 없습니다." }, 404);
      }

      // if a confirmed slot freed up, promote the first waitlisted person
      if (!data.waitlisted) {
        // For per-venue events, promote from the same venue's waitlist;
        // fall back to any waitlisted person for non-venue events.
        const parsedMeta = (data.metadata && typeof data.metadata === "object")
          ? data.metadata as Record<string, unknown>
          : {};
        const venueVal = typeof parsedMeta.venue === "string" ? parsedMeta.venue : null;

        let nextQuery = supabase
          .from("event_signups")
          .select("id")
          .eq("event_path", data.event_path)
          .eq("waitlisted", true)
          .order("created_at", { ascending: true })
          .limit(1);

        if (venueVal) {
          nextQuery = nextQuery.contains("metadata", { venue: venueVal });
        }

        const { data: next } = await nextQuery.single();

        if (next) {
          await supabase
            .from("event_signups")
            .update({ waitlisted: false })
            .eq("id", next.id);
        }
      }

      return json({ success: true });
    }

    // ── listSignups (public — nicknames + metadata, no real_name) ────────
    if (action === "listSignups") {
      const { eventPath } = body;
      if (!eventPath) return json({ error: "eventPath가 필요합니다." }, 400);

      const { data, error } = await supabase
        .from("event_signups")
        .select("id, nickname, waitlisted, created_at, metadata")
        .eq("event_path", eventPath)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ success: true, signups: data });
    }

    // ── adminListSignups (password-gated, includes real_name + metadata) ─
    if (action === "adminListSignups") {
      const { eventPath, password } = body;
      if (password !== ADMIN_PASSWORD) {
        return json({ error: "비밀번호가 올바르지 않습니다." }, 403);
      }
      if (!eventPath) return json({ error: "eventPath가 필요합니다." }, 400);

      const { data, error } = await supabase
        .from("event_signups")
        .select("id, nickname, real_name, waitlisted, created_at, metadata")
        .eq("event_path", eventPath)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ success: true, signups: data });
    }

    return json({ error: "알 수 없는 action입니다." }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return json({ error: msg }, 500);
  }
});

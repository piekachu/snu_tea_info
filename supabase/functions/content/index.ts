// Supabase Edge Function — admin-authored content backend.
// Covers three content types the admin page can create/edit/delete:
//   공지사항 (notices) · 정보 (info) · 정기다회 (events, full richness)
//
// Actions: listNotices | getNotice | createNotice | updateNotice | deleteNotice
//        | listInfo    | getInfo    | createInfo    | updateInfo    | deleteInfo
//        | listEvents  | getEvent   | createEvent    | updateEvent   | deleteEvent
//        | uploadImage
//
// Required env vars — same project secrets already configured for the
// `join` function, nothing new to set up:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD
//
// JWT verification must be OFF (public endpoint — Settings → API → Edge
// Functions), same as `join`.
//
// Run supabase/migrations/2026-08-30_content_tables.sql once in the SQL
// editor before deploying this, and create a public "content-images"
// Storage bucket (see that migration's comment) for uploadImage to work.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── helpers ───────────────────────────────────────────────────────────────

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

const STORAGE_BUCKET = "content-images";

// deno-lint-ignore no-explicit-any
function mapNotice(r: any) {
  return {
    id: r.id,
    title: r.title,
    titleEn: r.title_en ?? null,
    date: r.date,
    excerpt: r.excerpt ?? null,
    excerptEn: r.excerpt_en ?? null,
    bodyHtml: r.body_html ?? "",
    bodyHtmlEn: r.body_html_en ?? null,
    pinned: !!r.pinned,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? null,
  };
}

// deno-lint-ignore no-explicit-any
function mapInfo(r: any) {
  return mapNotice(r); // identical shape
}

// deno-lint-ignore no-explicit-any
function mapEvent(r: any) {
  return {
    id: r.id,
    date: r.date,
    endDate: r.end_date ?? null,
    time: r.time ?? null,
    title: r.title,
    titleEn: r.title_en ?? null,
    category: r.category ?? "regulars",
    location: r.location ?? null,
    mapLink: r.map_link ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    fee: r.fee ?? null,
    capacity: r.capacity ?? null,
    heroImageUrl: r.hero_image_url ?? null,
    introTitle: r.intro_title ?? null,
    introTitleEn: r.intro_title_en ?? null,
    introBody: r.intro_body ?? null,
    introBodyEn: r.intro_body_en ?? null,
    teas: Array.isArray(r.teas) ? r.teas : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? null,
  };
}

// ── main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";

  function checkAdmin(pw: unknown): boolean {
    return ADMIN_PASSWORD !== "" && pw === ADMIN_PASSWORD;
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════════════════════
    // 공지사항 (notices)
    // ═══════════════════════════════════════════════════════════════════

    if (action === "listNotices") {
      const isAdmin = checkAdmin(body.adminPassword);
      let q = supabase.from("content_notices").select("*");
      if (!isAdmin) q = q.is("deleted_at", null);
      q = q.order("pinned", { ascending: false }).order("date", { ascending: false });
      const { data, error } = await q;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, notices: (data ?? []).map(mapNotice) });
    }

    if (action === "getNotice") {
      const { id } = body;
      const { data, error } = await supabase
        .from("content_notices").select("*").eq("id", id).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 글이에요." }, 404);
      return json({ ok: true, notice: mapNotice(data) });
    }

    if (action === "createNotice" || action === "updateNotice") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);

      const title = String(body.title || "").trim();
      const date = String(body.date || "").trim();
      if (!title || !date)
        return json({ ok: false, error: "제목과 날짜는 필수예요." }, 400);

      const row = {
        title,
        title_en: body.titleEn ? String(body.titleEn) : null,
        date,
        excerpt: body.excerpt ? String(body.excerpt) : null,
        excerpt_en: body.excerptEn ? String(body.excerptEn) : null,
        body_html: String(body.bodyHtml || ""),
        body_html_en: body.bodyHtmlEn ? String(body.bodyHtmlEn) : null,
        pinned: !!body.pinned,
        updated_at: new Date().toISOString(),
      };

      if (action === "createNotice") {
        const { data, error } = await supabase
          .from("content_notices").insert(row).select().single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, notice: mapNotice(data) });
      } else {
        const { id } = body;
        if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
        const { data, error } = await supabase
          .from("content_notices").update(row).eq("id", id).select().maybeSingle();
        if (error) return json({ ok: false, error: error.message }, 500);
        if (!data) return json({ ok: false, error: "존재하지 않는 글이에요." }, 404);
        return json({ ok: true, notice: mapNotice(data) });
      }
    }

    if (action === "deleteNotice") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id } = body;
      const { error } = await supabase
        .from("content_notices").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 정보 (info) — identical shape/behavior to notices, separate table
    // ═══════════════════════════════════════════════════════════════════

    if (action === "listInfo") {
      const isAdmin = checkAdmin(body.adminPassword);
      let q = supabase.from("content_info").select("*");
      if (!isAdmin) q = q.is("deleted_at", null);
      q = q.order("pinned", { ascending: false }).order("date", { ascending: false });
      const { data, error } = await q;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, info: (data ?? []).map(mapInfo) });
    }

    if (action === "getInfo") {
      const { id } = body;
      const { data, error } = await supabase
        .from("content_info").select("*").eq("id", id).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 글이에요." }, 404);
      return json({ ok: true, info: mapInfo(data) });
    }

    if (action === "createInfo" || action === "updateInfo") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);

      const title = String(body.title || "").trim();
      const date = String(body.date || "").trim();
      if (!title || !date)
        return json({ ok: false, error: "제목과 날짜는 필수예요." }, 400);

      const row = {
        title,
        title_en: body.titleEn ? String(body.titleEn) : null,
        date,
        excerpt: body.excerpt ? String(body.excerpt) : null,
        excerpt_en: body.excerptEn ? String(body.excerptEn) : null,
        body_html: String(body.bodyHtml || ""),
        body_html_en: body.bodyHtmlEn ? String(body.bodyHtmlEn) : null,
        pinned: !!body.pinned,
        updated_at: new Date().toISOString(),
      };

      if (action === "createInfo") {
        const { data, error } = await supabase
          .from("content_info").insert(row).select().single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, info: mapInfo(data) });
      } else {
        const { id } = body;
        if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
        const { data, error } = await supabase
          .from("content_info").update(row).eq("id", id).select().maybeSingle();
        if (error) return json({ ok: false, error: error.message }, 500);
        if (!data) return json({ ok: false, error: "존재하지 않는 글이에요." }, 404);
        return json({ ok: true, info: mapInfo(data) });
      }
    }

    if (action === "deleteInfo") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id } = body;
      const { error } = await supabase
        .from("content_info").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 정기다회 (events) — full richness: hero + intro + N tea sections
    // ═══════════════════════════════════════════════════════════════════

    if (action === "listEvents") {
      const isAdmin = checkAdmin(body.adminPassword);
      let q = supabase.from("content_events").select("*");
      if (!isAdmin) q = q.is("deleted_at", null);
      q = q.order("date", { ascending: false });
      const { data, error } = await q;
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, events: (data ?? []).map(mapEvent) });
    }

    if (action === "getEvent") {
      const { id } = body;
      const { data, error } = await supabase
        .from("content_events").select("*").eq("id", id).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 행사예요." }, 404);
      return json({ ok: true, event: mapEvent(data) });
    }

    if (action === "createEvent" || action === "updateEvent") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);

      const title = String(body.title || "").trim();
      const date = String(body.date || "").trim();
      const time = String(body.time || "").trim();
      const location = String(body.location || "").trim();
      const hasCapacity = typeof body.capacity === "number" && Number.isFinite(body.capacity);
      if (!title || !date || !time || !location || !hasCapacity)
        return json({ ok: false, error: "제목, 날짜, 시간, 장소, 인원은 필수예요." }, 400);

      const teas = Array.isArray(body.teas) ? body.teas : [];

      const row = {
        date,
        end_date: null, // 종료일 입력은 admin UI에서 제거됨 — 컬럼은 남겨두되 항상 비워둠
        time,
        title,
        title_en: body.titleEn ? String(body.titleEn) : null,
        category: body.category === "specialTea" ? "specialTea" : "regulars",
        location,
        map_link: body.mapLink ? String(body.mapLink) : null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        fee: body.fee ? String(body.fee) : null,
        capacity: body.capacity,
        hero_image_url: body.heroImageUrl ? String(body.heroImageUrl) : null,
        intro_title: body.introTitle ? String(body.introTitle) : null,
        intro_title_en: body.introTitleEn ? String(body.introTitleEn) : null,
        intro_body: body.introBody ? String(body.introBody) : null,
        intro_body_en: body.introBodyEn ? String(body.introBodyEn) : null,
        teas,
        updated_at: new Date().toISOString(),
      };

      if (action === "createEvent") {
        const { data, error } = await supabase
          .from("content_events").insert(row).select().single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, event: mapEvent(data) });
      } else {
        const { id } = body;
        if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
        const { data, error } = await supabase
          .from("content_events").update(row).eq("id", id).select().maybeSingle();
        if (error) return json({ ok: false, error: error.message }, 500);
        if (!data) return json({ ok: false, error: "존재하지 않는 행사예요." }, 404);
        return json({ ok: true, event: mapEvent(data) });
      }
    }

    if (action === "deleteEvent") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id } = body;
      const { error } = await supabase
        .from("content_events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Image upload — used for event hero photos + per-tea photos.
    // Client sends the file as base64; we upload with the service-role
    // key (bypasses Storage policies) so the bucket itself needs no
    // public-write policy, only public *read*.
    // ═══════════════════════════════════════════════════════════════════

    if (action === "uploadImage") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);

      const { fileName, contentType, dataBase64 } = body;
      if (!fileName || !contentType || !dataBase64)
        return json({ ok: false, error: "파일 정보가 올바르지 않아요." }, 400);

      // decode base64 → bytes
      const binary = atob(dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      // namespace by day + random suffix to avoid collisions
      const ext = String(fileName).split(".").pop()?.toLowerCase() || "jpg";
      const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(key, bytes, { contentType, upsert: false });
      if (upErr) return json({ ok: false, error: upErr.message }, 500);

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
      return json({ ok: true, url: pub.publicUrl });
    }

    return json({ ok: false, error: "알 수 없는 요청이에요." }, 400);
  } catch (e) {
    // Surface Postgrest/Storage error details instead of a generic 500 —
    // same reasoning as the fix applied to the `join` function's catch
    // block: PostgrestError doesn't extend Error, so message/details/hint
    // need to be read off explicitly or they silently disappear.
    // deno-lint-ignore no-explicit-any
    const err = e as any;
    const message = err?.message || err?.error_description || String(err);
    return json({ ok: false, error: "서버 오류가 발생했습니다.", detail: message }, 500);
  }
});

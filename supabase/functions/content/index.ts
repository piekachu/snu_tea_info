// Supabase Edge Function — admin-authored content backend.
// Covers three content types the admin page can create/edit/delete:
//   공지사항 (notices) · 정보 (info) · 정기다회 (events, full richness)
// Plus two admin-tracking features, unrelated to the content types above:
//   소모임 지원금 신청 (support-fund applications) · 회비 관리 (dues)
//
// Actions: listNotices | getNotice | createNotice | updateNotice | deleteNotice
//        | listInfo    | getInfo    | createInfo    | updateInfo    | deleteInfo
//        | listEvents  | getEvent   | createEvent    | updateEvent   | deleteEvent
//        | uploadImage
//        | submitSupportFund | uploadSupportFundImage | getSupportFundStatus
//        | listSupportFund   | updateSupportFundStatus
//        | listDuesEvents | createDuesEvent | deleteDuesEvent
//        | listDues | createDuesMember | createDuesMembersBulk
//        | updateDuesMemberStatus | deleteDuesMember
//
// Required env vars — same project secrets already configured for the
// `join` function, nothing new to set up:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD
//
// JWT verification must be OFF (public endpoint — Settings → API → Edge
// Functions), same as `join`.
//
// Run supabase/migrations/2026-08-30_content_tables.sql,
// 2026-10-10_support_fund_and_dues.sql, and
// 2026-10-11_dues_events_and_status.sql once in the SQL editor before
// deploying this, and create a public "content-images" Storage bucket (see
// the first migration's comment) for uploadImage/uploadSupportFundImage to
// work.

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
    venueName: r.venue_name ?? null,
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

// deno-lint-ignore no-explicit-any
function mapSupportFund(r: any) {
  return {
    id: r.id,
    meetupDate: r.meetup_date,
    meetupTime: r.meetup_time ?? null,
    tastingNoteUrl: r.tasting_note_url,
    bankName: r.bank_name ?? null,
    accountHolder: r.account_holder ?? null,
    accountNumber: r.account_number,
    participants: Array.isArray(r.participants) ? r.participants : [],
    applicantName: r.applicant_name ?? null,
    applicantContact: r.applicant_contact ?? null,
    status: r.status,
    adminNote: r.admin_note ?? null,
    approvedAt: r.approved_at ?? null,
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at,
  };
}

// deno-lint-ignore no-explicit-any
function mapDuesEvent(r: any) {
  return {
    id: r.id,
    name: r.name,
    amount: r.amount,
    createdAt: r.created_at,
  };
}

// deno-lint-ignore no-explicit-any
function mapDuesMember(r: any) {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
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
      const venueName = String(body.venueName || "").trim();
      const hasCapacity = typeof body.capacity === "number" && Number.isFinite(body.capacity);
      if (!title || !date || !time || !venueName || !hasCapacity)
        return json({ ok: false, error: "제목, 날짜, 시간, 장소, 인원은 필수예요." }, 400);

      const teas = Array.isArray(body.teas) ? body.teas : [];

      const row = {
        date,
        end_date: null, // 종료일 입력은 admin UI에서 제거됨 — 컬럼은 남겨두되 항상 비워둠
        time,
        title,
        title_en: body.titleEn ? String(body.titleEn) : null,
        category: body.category === "specialTea" ? "specialTea" : "regulars",
        venue_name: venueName,
        // 실제 주소 — 좌표 자동 검색에만 쓰이고 방문자에게는 보이지 않음 (선택)
        location: body.location ? String(body.location).trim() : null,
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

    // ═══════════════════════════════════════════════════════════════════
    // 소모임 지원금 신청 (support-fund applications)
    //   submit/upload: public, no password — anyone with the link can apply
    //   list/updateStatus: admin-only, so accounting can track + approve
    // ═══════════════════════════════════════════════════════════════════

    if (action === "uploadSupportFundImage") {
      const { fileName, contentType, dataBase64 } = body;
      if (!fileName || !contentType || !dataBase64)
        return json({ ok: false, error: "파일 정보가 올바르지 않아요." }, 400);
      if (!String(contentType).startsWith("image/"))
        return json({ ok: false, error: "이미지 파일만 업로드할 수 있어요." }, 400);

      const binary = atob(dataBase64);
      // 8MB cap — this path has no password gate, so keep uploads bounded
      if (binary.length > 8 * 1024 * 1024)
        return json({ ok: false, error: "이미지 용량은 8MB 이하여야 해요." }, 400);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const ext = String(fileName).split(".").pop()?.toLowerCase() || "jpg";
      const key = `support-fund/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(key, bytes, { contentType, upsert: false });
      if (upErr) return json({ ok: false, error: upErr.message }, 500);

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
      return json({ ok: true, url: pub.publicUrl });
    }

    if (action === "submitSupportFund") {
      const meetupDate = String(body.meetupDate || "").trim();
      const accountNumber = String(body.accountNumber || "").trim();
      const tastingNoteUrl = String(body.tastingNoteUrl || "").trim();
      const participants = Array.isArray(body.participants)
        ? body.participants.map((p: unknown) => String(p).trim()).filter(Boolean)
        : [];

      if (!meetupDate) return json({ ok: false, error: "소모임 날짜를 선택해주세요." }, 400);
      if (!tastingNoteUrl) return json({ ok: false, error: "시음기 이미지를 첨부해주세요." }, 400);
      if (!accountNumber) return json({ ok: false, error: "계좌번호를 입력해주세요." }, 400);
      if (participants.length === 0)
        return json({ ok: false, error: "함께한 사람의 명단을 입력해주세요." }, 400);

      const row = {
        meetup_date: meetupDate,
        meetup_time: body.meetupTime ? String(body.meetupTime).trim() : null,
        tasting_note_url: tastingNoteUrl,
        bank_name: body.bankName ? String(body.bankName).trim() : null,
        account_holder: body.accountHolder ? String(body.accountHolder).trim() : null,
        account_number: accountNumber,
        participants,
        applicant_name: body.applicantName ? String(body.applicantName).trim() : null,
        applicant_contact: body.applicantContact ? String(body.applicantContact).trim() : null,
        status: "submitted",
      };

      const { data, error } = await supabase
        .from("support_fund_applications").insert(row).select().single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, application: mapSupportFund(data) });
    }

    // Public, no password — lets an applicant check their own application's
    // status using the id shown back to them right after they submitted
    // (same "possession of an unguessable UUID = proof it's yours" pattern
    // as join's editToken). Deliberately omits bank_name/account_holder/
    // account_number even though it's their own data, to keep what an
    // unauthenticated endpoint echoes back minimal.
    if (action === "getSupportFundStatus") {
      const { id } = body;
      if (!id) return json({ ok: false, error: "신청 번호가 필요해요." }, 400);
      const { data, error } = await supabase
        .from("support_fund_applications")
        .select("id, meetup_date, meetup_time, participants, status, admin_note, created_at, approved_at, paid_at")
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 신청 번호예요." }, 404);
      return json({
        ok: true,
        application: {
          id: data.id,
          meetupDate: data.meetup_date,
          meetupTime: data.meetup_time ?? null,
          participants: Array.isArray(data.participants) ? data.participants : [],
          status: data.status,
          adminNote: data.admin_note ?? null,
          createdAt: data.created_at,
          approvedAt: data.approved_at ?? null,
          paidAt: data.paid_at ?? null,
        },
      });
    }

    if (action === "listSupportFund") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { data, error } = await supabase
        .from("support_fund_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, applications: (data ?? []).map(mapSupportFund) });
    }

    if (action === "updateSupportFundStatus") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id, status } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
      if (!["submitted", "approved", "paid", "rejected"].includes(String(status)))
        return json({ ok: false, error: "status 값이 올바르지 않아요." }, 400);

      const row: Record<string, unknown> = { status };
      if (status === "approved") row.approved_at = new Date().toISOString();
      if (status === "paid") row.paid_at = new Date().toISOString();
      if (body.adminNote !== undefined) row.admin_note = body.adminNote ? String(body.adminNote) : null;

      const { data, error } = await supabase
        .from("support_fund_applications").update(row).eq("id", id).select().maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 신청이에요." }, 404);
      return json({ ok: true, application: mapSupportFund(data) });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 회비 관리 (dues) — admin-only, invisible on the public site.
    // Upgraded/shared replacement for the standalone Tkinter
    // soeldayeon_money.py tool. An event (name + amount) is created once
    // in dues_events, then *selected* — never retyped — when adding
    // participants, so a typo in a repeated event name can't silently
    // split one group into two. status replaces the old paid boolean:
    // 'unpaid' | 'paid' | 'canceled' | 'noshow_charged' | 'noshow_paid'.
    // ═══════════════════════════════════════════════════════════════════

    const DUES_STATUSES = ["unpaid", "paid", "canceled", "noshow_charged", "noshow_paid"];

    if (action === "listDuesEvents") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { data, error } = await supabase
        .from("dues_events").select("*").order("created_at", { ascending: false });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, events: (data ?? []).map(mapDuesEvent) });
    }

    if (action === "createDuesEvent") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const name = String(body.name || "").trim();
      const amount = Number(body.amount);
      if (!name) return json({ ok: false, error: "행사명을 입력해주세요." }, 400);
      if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount))
        return json({ ok: false, error: "금액은 숫자로만 입력해주세요." }, 400);

      const { data, error } = await supabase
        .from("dues_events").insert({ name, amount }).select().single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, event: mapDuesEvent(data) });
    }

    if (action === "deleteDuesEvent") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { eventId } = body;
      if (!eventId) return json({ ok: false, error: "eventId가 필요해요." }, 400);
      // dues_members.event_id is ON DELETE CASCADE, so this also removes
      // every participant row for the event.
      const { error } = await supabase.from("dues_events").delete().eq("id", eventId);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "listDues") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { data, error } = await supabase
        .from("dues_members").select("*").order("created_at", { ascending: true });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, members: (data ?? []).map(mapDuesMember) });
    }

    if (action === "createDuesMember") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { eventId } = body;
      const name = String(body.name || "").trim();
      if (!eventId) return json({ ok: false, error: "행사를 먼저 선택해주세요." }, 400);
      if (!name) return json({ ok: false, error: "이름을 입력해주세요." }, 400);

      const { data, error } = await supabase
        .from("dues_members")
        .insert({ event_id: eventId, name, status: "unpaid" })
        .select().single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, member: mapDuesMember(data) });
    }

    // batch add — the "convenient" bulk entry path: one selected event,
    // many names at once (e.g. pasted one-per-line from a group chat)
    if (action === "createDuesMembersBulk") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { eventId } = body;
      const names = Array.isArray(body.names)
        ? body.names.map((n: unknown) => String(n).trim()).filter(Boolean)
        : [];
      if (!eventId) return json({ ok: false, error: "행사를 먼저 선택해주세요." }, 400);
      if (names.length === 0) return json({ ok: false, error: "추가할 이름이 없어요." }, 400);

      const rows = names.map((name: string) => ({ event_id: eventId, name, status: "unpaid" }));
      const { data, error } = await supabase.from("dues_members").insert(rows).select();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, members: (data ?? []).map(mapDuesMember) });
    }

    if (action === "updateDuesMemberStatus") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id, status } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
      if (!DUES_STATUSES.includes(String(status)))
        return json({ ok: false, error: "status 값이 올바르지 않아요." }, 400);
      const { data, error } = await supabase
        .from("dues_members").update({ status }).eq("id", id).select().maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!data) return json({ ok: false, error: "존재하지 않는 사람이에요." }, 404);
      return json({ ok: true, member: mapDuesMember(data) });
    }

    if (action === "deleteDuesMember") {
      if (!checkAdmin(body.adminPassword))
        return json({ ok: false, error: "관리자 비밀번호가 올바르지 않습니다." }, 403);
      const { id } = body;
      if (!id) return json({ ok: false, error: "id가 필요해요." }, 400);
      const { error } = await supabase.from("dues_members").delete().eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
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

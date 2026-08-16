/**
 * 소모임 신청 (Join) page backend — Google Apps Script Web App.
 *
 * Bind this script to a Google Sheet: Extensions > Apps Script, paste this
 * whole file in, run `setup` once, then deploy as a Web App. Full walkthrough
 * in SETUP.md next to this file.
 *
 * Data model: two sheet tabs.
 *   Events:  id | date | time | title | location | mapLink | capacity | host | description | password | hostSignupId | createdAt | editToken
 *   Signups: id | eventId | name | realName | contact | createdAt | editToken
 *
 * `realName` is a signup's legal/real name, collected so the club admin (and
 * the event host) can confirm who's actually attending; it is NEVER included
 * in the public `list` response — only nicknames (`name`) are public. It rides
 * alongside `contact` in the ownership-gated eventParticipants response.
 *
 * All reads map columns by HEADER NAME (see sheetRows_), and — importantly —
 * all writes now do too (see writeRowByHeader_/setRowFieldsByHeader_). Earlier
 * versions wrote by fixed column position, so if a sheet's columns were ever
 * reordered or a column added, writes landed in the wrong columns while reads
 * (by name) read the right ones — surfacing as e.g. 주최자 showing the capacity
 * or 소개 showing the host's nickname. Writing by name keeps the two in sync no
 * matter the column order, and setup()/ensureSheet_ backfills any missing column.
 *
 * editToken is a random id handed back to whoever created a row (once, in
 * the response) so their browser can prove ownership later without
 * retyping anything. `password` is a second, explicit path to that same
 * ownership — set by the creator at creation time — so they can still
 * edit/delete their own event from a different browser or device, not just
 * the one they created it in. Either one alone is enough to prove
 * ownership; an admin override (see getAdminPassword_) is a third path that
 * works regardless of who created the event.
 *
 * `password` is never included in list responses, same as editToken;
 * `contact` (a signup's phone/kakao/etc.) is only ever visible to whoever
 * owns this spreadsheet directly — the public list only exposes names.
 *
 * Every event's capacity counts the creator as one of the spots (see
 * createEvent_) — an auto-created Signups row using the host's name,
 * tracked by the event's `hostSignupId`. That auto-signup's own editToken
 * is never handed to any client, so nobody can cancel it independently via
 * cancelSignup — removing the creator's attendance means deleting (or
 * editing) the event itself.
 */

const EVENTS_SHEET = "Events";
const SIGNUPS_SHEET = "Signups";

const EVENTS_HEADERS = ["id", "date", "time", "title", "location", "mapLink", "capacity", "host", "description", "password", "hostSignupId", "createdAt", "editToken"];
const SIGNUPS_HEADERS = ["id", "eventId", "name", "realName", "contact", "createdAt", "editToken", "canceledAt"];

/** Run this once from the Apps Script editor (select "setup" > Run) before deploying. */
function setup() {
  const events = ensureSheet_(EVENTS_SHEET, EVENTS_HEADERS);
  // force plain-text on date/time columns so Sheets doesn't silently
  // reinterpret "2026-08-05" or "18:30" as a Date/Time value
  events.getRange("B:C").setNumberFormat("@");
  ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS);
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }
  // sheet already has a header row — backfill any header this version expects
  // but that isn't present yet (e.g. a newly-added `realName`), appended at the
  // end so existing columns/data are untouched. Because every read and write
  // maps by header NAME, the appended-at-the-end position doesn't matter.
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = headers.filter((h) => existing.indexOf(h) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// {headerName: 1-based column index} from a sheet's header row. First
// occurrence wins if a name is somehow duplicated.
function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    const key = String(h);
    if (key !== "" && !(key in map)) map[key] = i + 1;
  });
  return map;
}

// dates/times must stay plain text so Sheets doesn't reinterpret "2026-08-05"
// or "18:30" as a Date/Time value (which then round-trips through a timezone
// shift). These header names get their cell forced to "@" before writing.
const TEXT_COLUMNS_ = ["date", "time"];

// append a new row built from an object keyed by header name — each value
// lands in its own named column regardless of the sheet's column order, and
// any column the object doesn't mention is left blank. Returns the row number.
function writeRowByHeader_(sheet, obj) {
  const hmap = headerMap_(sheet);
  // width must be at least as wide as the last header column, not just
  // getLastColumn() (which only counts columns with existing data)
  const headerCount = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].length;
  const maxHeaderCol = Math.max(...Object.values(hmap));
  const width = Math.max(headerCount, maxHeaderCol);
  const row = sheet.getLastRow() + 1;
  TEXT_COLUMNS_.forEach((h) => {
    if (hmap[h] && h in obj) sheet.getRange(row, hmap[h]).setNumberFormat("@");
  });
  const arr = new Array(width).fill("");
  Object.keys(obj).forEach((k) => {
    if (hmap[k]) arr[hmap[k] - 1] = obj[k];
  });
  sheet.getRange(row, 1, 1, width).setValues([arr]);
  return row;
}

// overwrite only the named fields of an existing row, each by its header
// column — leaves every other column (id, password, editToken, …) untouched.
function setRowFieldsByHeader_(sheet, rowNumber, obj) {
  const hmap = headerMap_(sheet);
  Object.keys(obj).forEach((k) => {
    if (!hmap[k]) return;
    if (TEXT_COLUMNS_.indexOf(k) !== -1) sheet.getRange(rowNumber, hmap[k]).setNumberFormat("@");
    sheet.getRange(rowNumber, hmap[k]).setValue(obj[k]);
  });
}

// Everything — reads AND writes — goes through doGet (query-string
// parameters), not doPost. Browsers route a fetch() POST to a Web App
// through a cross-origin redirect that CORS blocks before the browser can
// read the response, so a real POST body never reliably makes it back to
// the page; GET does not hit that redirect-CORS problem. doPost is kept
// only so a non-browser caller (curl, another script) still has a normal
// POST option.
function doGet(e) {
  return jsonOutput_(handleAction_(e.parameter.action, e.parameter));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ ok: false, error: "invalid request body" });
  }
  return jsonOutput_(handleAction_(body.action, body));
}

function handleAction_(action, params) {
  if (action === "list") {
    return { ok: true, events: publicEvents_(), signups: publicSignups_() };
  }
  // read-only, but returns the private `contact` field, so it's gated by
  // event ownership (editToken/password) or admin — see eventParticipants_
  if (action === "eventParticipants") {
    return eventParticipants_(params);
  }

  const writeActions = {
    createEvent: createEvent_,
    updateEvent: updateEvent_,
    signup: signUp_,
    cancelSignup: cancelSignup_,
    deleteEvent: deleteEvent_,
  };
  const handler = writeActions[action];
  if (!handler) return { ok: false, error: "unknown action" };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return handler(params);
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// reads a sheet's rows into plain objects keyed by header name; each row
// also carries `_row` (1-indexed sheet row number) for later update/delete
function sheetRows_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return values.map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => (obj[h] = row[j]));
    obj._row = i + 2;
    return obj;
  });
}

// Sheets sometimes hands back a cell as a real Date object instead of the
// plain text we wrote (see the comment in createEvent_) — whether from a
// manual edit in the UI or some other formatting quirk. Coerce defensively
// on the way out too, rather than trusting the stored type, so a
// contaminated row heals itself instead of silently breaking date grouping.
function asDateString_(value) {
  if (!(value instanceof Date)) return value;
  return Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd");
}
function asTimeString_(value) {
  if (!(value instanceof Date)) return value;
  return Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "HH:mm");
}

function publicEvents_() {
  return sheetRows_(EVENTS_SHEET).map((ev) => ({
    id: ev.id,
    date: asDateString_(ev.date),
    time: asTimeString_(ev.time),
    title: ev.title,
    location: ev.location,
    mapLink: ev.mapLink,
    capacity: ev.capacity,
    host: ev.host,
    description: ev.description,
    hostSignupId: ev.hostSignupId,
    createdAt: ev.createdAt,
    // password and editToken deliberately omitted — private
  }));
}

function publicSignups_() {
  // deliberately omits `contact` and `editToken` — only names are public;
  // canceled signups are excluded (soft-delete) so they don't count toward
  // capacity or appear in the public participant list
  return sheetRows_(SIGNUPS_SHEET)
    .filter((s) => !s.canceledAt)
    .map((s) => ({
      id: s.id,
      eventId: s.eventId,
      name: s.name,
      createdAt: s.createdAt,
    }));
}

// shared validation for the fields createEvent_/updateEvent_ both take;
// returns either {error: "..."} or the cleaned-up field values
function validateEventFields_(body, existingSignupCount) {
  const title = String(body.title || "").trim();
  const date = String(body.date || "").trim();
  const host = String(body.host || "").trim();
  if (!title || !date || !host) {
    return { error: "제목, 날짜, 주최자 이름은 필수예요." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "날짜 형식이 올바르지 않아요." };
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

function createEvent_(body) {
  const password = String(body.password || "");
  if (!password) return { ok: false, error: "비밀번호를 설정해주세요. 나중에 수정/삭제할 때 필요해요." };

  const fields = validateEventFields_(body, null);
  if (fields.error) return { ok: false, error: fields.error };
  const { title, date, host, capacity, time, location, mapLink, description } = fields;

  // the host is a participant too, so they give a real name like everyone else
  const hostRealName = String(body.hostRealName || "").trim();
  if (!hostRealName) return { ok: false, error: "주최자 실명을 입력해주세요." };

  const id = Utilities.getUuid();
  const editToken = Utilities.getUuid();
  const now = new Date().toISOString();

  // the creator counts toward their own capacity — auto-signup them so the
  // headcount starts at 1/N instead of 0/N (their real name rides on this row)
  const hostSignupId = Utilities.getUuid();
  const hostSignupToken = Utilities.getUuid();
  writeRowByHeader_(ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS), {
    id: hostSignupId,
    eventId: id,
    name: host,
    realName: hostRealName,
    contact: "",
    createdAt: now,
    editToken: hostSignupToken,
  });

  writeRowByHeader_(ensureSheet_(EVENTS_SHEET, EVENTS_HEADERS), {
    id,
    date,
    time,
    title,
    location,
    mapLink,
    capacity,
    host,
    description,
    password,
    hostSignupId,
    createdAt: now,
    editToken,
  });

  return {
    ok: true,
    event: { id, date, time, title, location, mapLink, capacity, host, description, hostSignupId, createdAt: now },
    editToken,
  };
}

// The admin password lives in this project's Script Properties (Project
// Settings > Script Properties > ADMIN_PASSWORD in the Apps Script editor),
// never in this file — so it isn't visible to anyone reading the source or
// this repo. Leaving it unset (the default) means the admin override is
// simply never available to anyone, including a blank submitted password.
function getAdminPassword_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || "";
}

// true if this request proves ownership of `target` — either its editToken
// (same browser that created it) or its password (set at creation, works
// from anywhere)
function isEventOwner_(target, body) {
  const editToken = String(body.editToken || "");
  const password = String(body.password || "");
  return (editToken !== "" && String(target.editToken) === editToken) || (password !== "" && String(target.password) === password);
}
function isAdminRequest_(body) {
  const adminSecret = getAdminPassword_();
  const adminPassword = String(body.adminPassword || "");
  return adminSecret !== "" && adminPassword === adminSecret;
}

// full participant list INCLUDING each signup's private `contact`, for the
// host (or admin) only — the public list action never exposes contacts.
// Same ownership proof as edit/delete: editToken, password, or admin.
function eventParticipants_(body) {
  const id = String(body.id || "");
  const target = sheetRows_(EVENTS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 소모임이에요." };

  if (!isEventOwner_(target, body) && !isAdminRequest_(body)) {
    return { ok: false, error: "권한이 없어요. 비밀번호를 확인해주세요." };
  }

  // host/admin sees ALL signups including canceled, so they can track who
  // originally registered and then withdrew
  const participants = sheetRows_(SIGNUPS_SHEET)
    .filter((s) => s.eventId === id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      realName: s.realName,
      contact: s.contact,
      isHost: s.id === target.hostSignupId,
      createdAt: s.createdAt,
      canceledAt: s.canceledAt || null,
    }));
  return { ok: true, participants };
}

function updateEvent_(body) {
  const id = String(body.id || "");
  const target = sheetRows_(EVENTS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 소모임이에요." };

  if (!isEventOwner_(target, body) && !isAdminRequest_(body)) {
    return { ok: false, error: "수정 권한이 없어요. 비밀번호를 확인해주세요." };
  }

  const currentSignupCount = sheetRows_(SIGNUPS_SHEET).filter((s) => s.eventId === id && !s.canceledAt).length;
  const fields = validateEventFields_(body, currentSignupCount);
  if (fields.error) return { ok: false, error: fields.error };
  const { title, date, host, capacity, time, location, mapLink, description } = fields;

  const sheet = ensureSheet_(EVENTS_SHEET, EVENTS_HEADERS);
  // write each field to its own named column (never a fixed position) so
  // capacity/host/description can't cross even if the sheet's columns drifted
  setRowFieldsByHeader_(sheet, target._row, { date, time, title, location, mapLink, capacity, host, description });

  // keep the host's own auto-signup's displayed name in sync if it changed
  if (target.hostSignupId && String(target.host) !== host) {
    const signupSheet = ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS);
    const hostSignup = sheetRows_(SIGNUPS_SHEET).find((s) => s.id === target.hostSignupId);
    if (hostSignup) setRowFieldsByHeader_(signupSheet, hostSignup._row, { name: host });
  }

  return {
    ok: true,
    event: { id, date, time, title, location, mapLink, capacity, host, description, hostSignupId: target.hostSignupId, createdAt: target.createdAt },
  };
}

function deleteEvent_(body) {
  const id = String(body.id || "");
  const target = sheetRows_(EVENTS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 소모임이에요." };

  const isAdmin = isAdminRequest_(body);
  if (!isEventOwner_(target, body) && !isAdmin) {
    return { ok: false, error: "삭제 권한이 없어요. 비밀번호를 확인해주세요." };
  }

  const allSignups = sheetRows_(SIGNUPS_SHEET).filter((s) => s.eventId === id);
  // only active (non-canceled) signups block the host from deleting the event
  const otherSignups = allSignups.filter((s) => s.id !== target.hostSignupId && !s.canceledAt);
  if (otherSignups.length > 0 && !isAdmin) {
    return { ok: false, error: "다른 참가자가 있어 삭제할 수 없어요." };
  }

  // safe to clear every signup tied to this event now — either it's just
  // the creator's own auto-signup, or an admin is force-clearing everything
  if (allSignups.length > 0) {
    const signupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SIGNUPS_SHEET);
    allSignups
      .map((s) => s._row)
      .sort((a, b) => b - a) // delete bottom-up so earlier row indices stay valid
      .forEach((row) => signupSheet.deleteRow(row));
  }

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET).deleteRow(target._row);
  return { ok: true };
}

// signups close this long before the event's start
const SIGNUP_CLOSE_BEFORE_MS = 24 * 60 * 60 * 1000;
// signups can't be withdrawn this close to the event
const CANCEL_DEADLINE_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;

// true once we're within 24h of the event start. Both "now" and the stored
// event date/time are compared in the spreadsheet's own timezone (the club's
// local time) — nowStr and the event string are each parsed as if UTC, so
// the shared offset cancels and only the wall-clock gap matters. Unknown/
// unparseable dates never block (returns false), so a bad row can't lock
// everyone out.
function signupsClosed_(event) {
  const date = String(asDateString_(event.date) || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = String(asTimeString_(event.time) || "").trim() || "00:00";

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const nowMs = new Date(Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss") + "Z").getTime();
  const startMs = new Date(date + "T" + time + ":00Z").getTime();
  if (isNaN(startMs)) return false;
  return nowMs >= startMs - SIGNUP_CLOSE_BEFORE_MS;
}

// returns true if the event is still more than 2 days away (withdrawal allowed).
// Unknown/unparseable dates return true so a bad row never permanently locks
// someone in.
function canWithdrawSignup_(event) {
  const date = String(asDateString_(event.date) || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
  const time = String(asTimeString_(event.time) || "").trim() || "00:00";
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const nowMs = new Date(Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss") + "Z").getTime();
  const startMs = new Date(date + "T" + time + ":00Z").getTime();
  if (isNaN(startMs)) return true;
  return nowMs < startMs - CANCEL_DEADLINE_BEFORE_MS;
}

function signUp_(body) {
  const eventId = String(body.eventId || "");
  const name = String(body.name || "").trim();
  if (!eventId || !name) return { ok: false, error: "이름을 입력해주세요." };
  const realName = String(body.realName || "").trim();
  if (!realName) return { ok: false, error: "실명을 입력해주세요." };

  const event = sheetRows_(EVENTS_SHEET).find((r) => r.id === eventId);
  if (!event) return { ok: false, error: "존재하지 않는 소모임이에요." };

  if (signupsClosed_(event)) return { ok: false, error: "신청이 마감되었어요. (행사 24시간 전 마감)" };

  // only count active (non-canceled) signups toward capacity and name-uniqueness
  const existingSignups = sheetRows_(SIGNUPS_SHEET).filter((s) => s.eventId === eventId && !s.canceledAt);
  if (event.capacity !== "" && existingSignups.length >= Number(event.capacity)) {
    return { ok: false, error: "정원이 찼어요." };
  }
  if (existingSignups.some((s) => String(s.name).trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "이미 같은 이름으로 신청되어 있어요." };
  }

  const id = Utilities.getUuid();
  const editToken = Utilities.getUuid();
  const now = new Date().toISOString();
  const contact = String(body.contact || "").trim();

  writeRowByHeader_(ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS), { id, eventId, name, realName, contact, createdAt: now, editToken });

  return { ok: true, signup: { id, eventId, name, createdAt: now }, editToken };
}

function cancelSignup_(body) {
  const id = String(body.id || "");
  const editToken = String(body.editToken || "");
  const target = sheetRows_(SIGNUPS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 신청이에요." };
  if (String(target.editToken) !== editToken) return { ok: false, error: "취소 권한이 없어요." };
  if (target.canceledAt) return { ok: false, error: "이미 취소된 신청이에요." };

  // enforce the 2-day withdrawal deadline
  const event = sheetRows_(EVENTS_SHEET).find((e) => e.id === target.eventId);
  if (event && !canWithdrawSignup_(event)) {
    return { ok: false, error: "행사 2일 전부터는 신청을 취소할 수 없어요." };
  }

  // soft-delete: stamp canceledAt so the cancellation is tracked in the sheet;
  // the row stays so the host can see who originally signed up and withdrew
  const sheet = ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS);
  setRowFieldsByHeader_(sheet, target._row, { canceledAt: new Date().toISOString() });
  return { ok: true };
}

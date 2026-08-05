/**
 * 소모임 신청 (Join) page backend — Google Apps Script Web App.
 *
 * Bind this script to a Google Sheet: Extensions > Apps Script, paste this
 * whole file in, run `setup` once, then deploy as a Web App. Full walkthrough
 * in SETUP.md next to this file.
 *
 * Data model: two sheet tabs.
 *   Events:  id | date | time | title | location | capacity | host | description | createdAt | editToken
 *   Signups: id | eventId | name | contact | createdAt | editToken
 *
 * editToken is a random id handed back to whoever created a row (once, in
 * the POST response) so their browser can prove ownership later to cancel a
 * signup or delete an event. It is never included in list responses, and
 * `contact` (a signup's phone/kakao/etc.) is only ever visible to whoever
 * owns this spreadsheet directly — the public list only exposes names.
 */

const EVENTS_SHEET = "Events";
const SIGNUPS_SHEET = "Signups";

const EVENTS_HEADERS = ["id", "date", "time", "title", "location", "capacity", "host", "description", "createdAt", "editToken"];
const SIGNUPS_HEADERS = ["id", "eventId", "name", "contact", "createdAt", "editToken"];

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
  }
  return sheet;
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

  const writeActions = { createEvent: createEvent_, signup: signUp_, cancelSignup: cancelSignup_, deleteEvent: deleteEvent_ };
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
    capacity: ev.capacity,
    host: ev.host,
    description: ev.description,
    createdAt: ev.createdAt,
  }));
}

function publicSignups_() {
  // deliberately omits `contact` and `editToken` — only names are public
  return sheetRows_(SIGNUPS_SHEET).map((s) => ({
    id: s.id,
    eventId: s.eventId,
    name: s.name,
    createdAt: s.createdAt,
  }));
}

function createEvent_(body) {
  const title = String(body.title || "").trim();
  const date = String(body.date || "").trim();
  const host = String(body.host || "").trim();
  if (!title || !date || !host) {
    return { ok: false, error: "제목, 날짜, 주최자 이름은 필수예요." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "날짜 형식이 올바르지 않아요." };
  }
  if (body.capacity !== "" && body.capacity != null && (!Number.isFinite(Number(body.capacity)) || Number(body.capacity) < 1)) {
    return { ok: false, error: "정원은 1 이상의 숫자여야 해요." };
  }

  const id = Utilities.getUuid();
  const editToken = Utilities.getUuid();
  const now = new Date().toISOString();
  const time = String(body.time || "").trim();
  const location = String(body.location || "").trim();
  const description = String(body.description || "").trim();
  const capacity = body.capacity === "" || body.capacity == null ? "" : Number(body.capacity);

  const sheet = ensureSheet_(EVENTS_SHEET, EVENTS_HEADERS);
  // appendRow() alone isn't enough to keep "2026-08-05" as text — Sheets can
  // still auto-convert it to a real Date (which then round-trips through a
  // timezone shift, e.g. becomes "2026-08-04T15:00:00.000Z"). Forcing plain
  // text on this exact row's date/time cells right before writing avoids that.
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 2, 1, 2).setNumberFormat("@");
  sheet.getRange(row, 1, 1, EVENTS_HEADERS.length).setValues([[id, date, time, title, location, capacity, host, description, now, editToken]]);

  return {
    ok: true,
    event: { id, date, time, title, location, capacity, host, description, createdAt: now },
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

function deleteEvent_(body) {
  const id = String(body.id || "");
  const editToken = String(body.editToken || "");
  const adminPassword = String(body.adminPassword || "");

  const target = sheetRows_(EVENTS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 소모임이에요." };

  const isOwner = editToken !== "" && String(target.editToken) === editToken;
  const adminSecret = getAdminPassword_();
  const isAdmin = adminSecret !== "" && adminPassword === adminSecret;
  if (!isOwner && !isAdmin) return { ok: false, error: "삭제 권한이 없어요." };

  const signups = sheetRows_(SIGNUPS_SHEET).filter((s) => s.eventId === id);
  if (signups.length > 0 && !isAdmin) {
    return { ok: false, error: "신청자가 있어 삭제할 수 없어요." };
  }

  // the creator can only remove an empty event (checked above), but an
  // admin clearing out a problem event (spam, etc.) needs to take its
  // signups down with it rather than leave them pointing at nothing
  if (isAdmin && signups.length > 0) {
    const signupSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SIGNUPS_SHEET);
    signups
      .map((s) => s._row)
      .sort((a, b) => b - a) // delete bottom-up so earlier row indices stay valid
      .forEach((row) => signupSheet.deleteRow(row));
  }

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET).deleteRow(target._row);
  return { ok: true };
}

function signUp_(body) {
  const eventId = String(body.eventId || "");
  const name = String(body.name || "").trim();
  if (!eventId || !name) return { ok: false, error: "이름을 입력해주세요." };

  const event = sheetRows_(EVENTS_SHEET).find((r) => r.id === eventId);
  if (!event) return { ok: false, error: "존재하지 않는 소모임이에요." };

  const existingSignups = sheetRows_(SIGNUPS_SHEET).filter((s) => s.eventId === eventId);
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

  ensureSheet_(SIGNUPS_SHEET, SIGNUPS_HEADERS).appendRow([id, eventId, name, contact, now, editToken]);

  return { ok: true, signup: { id, eventId, name, createdAt: now }, editToken };
}

function cancelSignup_(body) {
  const id = String(body.id || "");
  const editToken = String(body.editToken || "");
  const target = sheetRows_(SIGNUPS_SHEET).find((r) => r.id === id);
  if (!target) return { ok: false, error: "존재하지 않는 신청이에요." };
  if (String(target.editToken) !== editToken) return { ok: false, error: "취소 권한이 없어요." };

  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SIGNUPS_SHEET).deleteRow(target._row);
  return { ok: true };
}

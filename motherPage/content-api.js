// Thin client for the `content` Edge Function (공지사항/정보/정기다회).
// Requires content-config.js (window.CONTENT_API_URL) to be loaded first.
//
// Read actions (list*/get*) need no password and work on any public page.
// Write actions (create*/update*/delete*, uploadImage) require adminPassword
// — pass it explicitly; the admin page reads it from its own sessionStorage
// (see admin/index.html's STORAGE_KEY) rather than this module owning that.
//
// Every call resolves to the raw `{ ok, ... }` response body — callers check
// `.ok` themselves, same convention as join.js.
(function () {
    "use strict";

    async function call(action, payload) {
        if (!window.CONTENT_API_URL) {
            return { ok: false, error: "CONTENT_API_URL이 설정되지 않았어요." };
        }
        try {
            const res = await fetch(window.CONTENT_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...payload }),
            });
            return await res.json();
        } catch (e) {
            return { ok: false, error: "네트워크 오류가 발생했어요." };
        }
    }

    // reads a File as a data URL and splits off the base64 payload, for
    // the uploadImage action's dataBase64 field
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || "");
                const comma = result.indexOf(",");
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    window.ContentAPI = {
        // ── notices ──────────────────────────────────────────────────
        listNotices: (adminPassword) => call("listNotices", adminPassword ? { adminPassword } : {}),
        getNotice: (id) => call("getNotice", { id }),
        createNotice: (fields, adminPassword) => call("createNotice", { ...fields, adminPassword }),
        updateNotice: (id, fields, adminPassword) => call("updateNotice", { id, ...fields, adminPassword }),
        deleteNotice: (id, adminPassword) => call("deleteNotice", { id, adminPassword }),

        // ── info ─────────────────────────────────────────────────────
        listInfo: (adminPassword) => call("listInfo", adminPassword ? { adminPassword } : {}),
        getInfo: (id) => call("getInfo", { id }),
        createInfo: (fields, adminPassword) => call("createInfo", { ...fields, adminPassword }),
        updateInfo: (id, fields, adminPassword) => call("updateInfo", { id, ...fields, adminPassword }),
        deleteInfo: (id, adminPassword) => call("deleteInfo", { id, adminPassword }),

        // ── events (정기다회) ────────────────────────────────────────
        listEvents: (adminPassword) => call("listEvents", adminPassword ? { adminPassword } : {}),
        getEvent: (id) => call("getEvent", { id }),
        createEvent: (fields, adminPassword) => call("createEvent", { ...fields, adminPassword }),
        updateEvent: (id, fields, adminPassword) => call("updateEvent", { id, ...fields, adminPassword }),
        deleteEvent: (id, adminPassword) => call("deleteEvent", { id, adminPassword }),

        // ── images ───────────────────────────────────────────────────
        // `file` is a File/Blob from an <input type="file">; resolves to
        // { ok, url } on success.
        uploadImage: async (file, adminPassword) => {
            const dataBase64 = await readFileAsBase64(file);
            return call("uploadImage", {
                fileName: file.name,
                contentType: file.type || "image/jpeg",
                dataBase64,
                adminPassword,
            });
        },
    };
})();

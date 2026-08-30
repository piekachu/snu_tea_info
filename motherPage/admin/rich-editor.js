// Rich-text editor for admin-authored body content (공지사항/정보).
// A toolbar sitting above a contenteditable area, with two kinds of buttons:
//   - inline formatting (bold/italic/heading/paragraph/list/link/clear),
//     via document.execCommand — deprecated but still broadly supported,
//     and appropriate for a feature this small.
//   - "insert block" buttons that drop in one of the same reusable visual
//     blocks the hand-authored OT/manual pages already use (section
//     dividers, numbered step lists, amber "!" callouts, photos) — via
//     execCommand("insertHTML", …). Every class name below already has
//     matching CSS in notice.css, and every page that can render admin
//     content (notice/view.html, info/view.html) already loads that
//     stylesheet, so a block pasted here renders identically once saved.
//
// Usage:
//   const editor = RichEditor.create(container, initialHtml, {
//       getAdminPassword: () => "...",  // needed only for the image button
//   });
//   editor.getHTML()        // → current innerHTML
//   editor.setHTML(html)    // → replace content
//
// containerEl gets the toolbar + editable area appended into it (so give it
// an empty wrapper <div>, not existing content).
(function () {
    "use strict";

    const INLINE_BUTTONS = [
        { cmd: "bold", label: "B", title: "굵게", style: "font-weight:700;" },
        { cmd: "italic", label: "I", title: "기울임", style: "font-style:italic;" },
        { cmd: "formatBlock", arg: "H4", label: "H", title: "소제목" },
        { cmd: "formatBlock", arg: "P", label: "P", title: "본문 문단" },
        { cmd: "insertUnorderedList", label: "•", title: "글머리 기호 목록" },
        { cmd: "createLink", label: "🔗", title: "링크 삽입", needsPrompt: true },
        { cmd: "removeFormat", label: "✕", title: "서식 지우기" },
    ];

    // placeholder text the admin clicks into and overwrites, matching how
    // the hand-authored pages read before their real copy was filled in
    const BLOCKS = {
        section: () =>
            '<div class="ot_section_head">' +
            '<span class="ot_section_head_label">구분</span>' +
            '<h4 class="ot_section_head_title">섹션 제목</h4>' +
            '</div>',
        note: () =>
            '<p class="man_note">여기에 강조할 안내 문구를 입력하세요.</p>',
        steps: () =>
            '<ol class="man_steps">' +
            ['첫 번째 단계를 설명해주세요.', '두 번째 단계를 설명해주세요.', '세 번째 단계를 설명해주세요.']
                .map((body) =>
                    '<li class="man_step"><h5 class="man_step_title">단계 제목</h5>' +
                    '<p class="man_step_body">' + body + '</p></li>'
                ).join("") +
            '</ol>',
    };

    // block-insert buttons — appended after INLINE_BUTTONS with a visual
    // divider; `insert` returns the HTML string, `needsImage: true` routes
    // through the upload flow instead
    const BLOCK_BUTTONS = [
        { label: "§", title: "섹션 제목 삽입", insert: BLOCKS.section },
        { label: "!", title: "강조 박스(느낌표) 삽입", insert: BLOCKS.note },
        { label: "①", title: "번호 목록(단계별 안내) 삽입 — 항목은 복사해서 추가할 수 있어요", insert: BLOCKS.steps },
        { label: "🖼", title: "이미지 삽입", needsImage: true },
    ];

    function create(container, initialHtml, options) {
        options = options || {};
        container.innerHTML = "";
        container.classList.add("rte");

        const toolbar = document.createElement("div");
        toolbar.className = "rte_toolbar";

        const area = document.createElement("div");
        area.className = "rte_area";
        area.contentEditable = "true";
        area.innerHTML = initialHtml || "";

        // keeps the last selection inside `area` so a click on a toolbar
        // button (which itself steals focus) still inserts at the right spot
        let savedRange = null;
        function saveSelection() {
            const sel = window.getSelection();
            if (sel && sel.rangeCount && area.contains(sel.anchorNode)) {
                savedRange = sel.getRangeAt(0).cloneRange();
            }
        }
        function restoreSelection() {
            area.focus();
            if (!savedRange) return;
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
        area.addEventListener("keyup", saveSelection);
        area.addEventListener("mouseup", saveSelection);

        // appends a trailing empty paragraph after an inserted block so the
        // admin always has a plain place to keep typing next
        function insertBlockHTML(html) {
            restoreSelection();
            document.execCommand("insertHTML", false, html + "<p><br></p>");
        }

        function makeButton(label, title, style) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "rte_btn";
            btn.textContent = label;
            btn.title = title;
            btn.style.cssText = style || "";
            btn.addEventListener("mousedown", (e) => {
                // prevent the editable area from losing selection focus
                e.preventDefault();
            });
            return btn;
        }

        INLINE_BUTTONS.forEach((b) => {
            const btn = makeButton(b.label, b.title, b.style);
            btn.addEventListener("click", () => {
                area.focus();
                if (b.needsPrompt) {
                    const url = window.prompt("링크 주소를 입력해주세요 (https://…)");
                    if (!url) return;
                    document.execCommand(b.cmd, false, url);
                } else {
                    document.execCommand(b.cmd, false, b.arg || undefined);
                }
            });
            toolbar.appendChild(btn);
        });

        const divider = document.createElement("span");
        divider.className = "rte_divider";
        toolbar.appendChild(divider);

        BLOCK_BUTTONS.forEach((b) => {
            const btn = makeButton(b.label, b.title, "font-weight:700;");
            btn.classList.add("rte_btn_block");
            btn.addEventListener("click", async () => {
                if (b.needsImage) {
                    await insertImage();
                    return;
                }
                insertBlockHTML(b.insert());
            });
            toolbar.appendChild(btn);
        });

        // ── image insert: file picker → ContentAPI.uploadImage → <figure> ──
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        container.appendChild(fileInput);

        function insertImage() {
            return new Promise((resolve) => {
                if (typeof ContentAPI === "undefined") {
                    window.alert("이미지 업로드 기능을 사용할 수 없어요.");
                    resolve();
                    return;
                }
                const pw = options.getAdminPassword ? options.getAdminPassword() : "";
                if (!pw) {
                    window.alert("관리자 비밀번호가 필요해요. 페이지 상단에서 잠금을 먼저 해제해주세요.");
                    resolve();
                    return;
                }
                fileInput.value = "";
                fileInput.onchange = async () => {
                    const file = fileInput.files && fileInput.files[0];
                    if (!file) { resolve(); return; }
                    const blockBtn = toolbar.querySelector(".rte_btn_block:last-child");
                    if (blockBtn) { blockBtn.disabled = true; blockBtn.textContent = "…"; }
                    try {
                        const res = await ContentAPI.uploadImage(file, pw);
                        if (!res.ok) {
                            window.alert(res.error || "이미지를 업로드하지 못했어요.");
                            return;
                        }
                        const alt = file.name.replace(/\.[a-z0-9]+$/i, "");
                        insertBlockHTML(
                            '<figure class="cnt_figure">' +
                            '<img class="ot_split_image" src="' + res.url + '" alt="' + alt + '">' +
                            '<figcaption class="ot_split_caption">사진 설명을 입력하세요</figcaption>' +
                            '</figure>'
                        );
                    } catch (e) {
                        window.alert("이미지를 업로드하지 못했어요.");
                    } finally {
                        if (blockBtn) { blockBtn.disabled = false; blockBtn.textContent = "🖼"; }
                        resolve();
                    }
                };
                fileInput.click();
            });
        }

        container.appendChild(toolbar);
        container.appendChild(area);

        return {
            el: area,
            getHTML: () => area.innerHTML.trim(),
            setHTML: (html) => { area.innerHTML = html || ""; },
        };
    }

    window.RichEditor = { create };
})();

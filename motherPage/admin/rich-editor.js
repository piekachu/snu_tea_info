// Minimal rich-text editor for admin-authored body content (공지사항/정보).
// A small toolbar (bold/italic/link/heading/paragraph/bullet list) sitting
// above a contenteditable area. Uses document.execCommand — deprecated but
// still broadly supported, and appropriate for a feature this small (a full
// editor library would be overkill for "officers write a notice").
//
// Usage:
//   const editor = RichEditor.create(containerEl, initialHtml);
//   editor.getHTML()        // → current innerHTML
//   editor.setHTML(html)    // → replace content
//
// containerEl gets the toolbar + editable area appended into it (so give it
// an empty wrapper <div>, not existing content).
(function () {
    "use strict";

    const BUTTONS = [
        { cmd: "bold", label: "B", title: "굵게", style: "font-weight:700;" },
        { cmd: "italic", label: "I", title: "기울임", style: "font-style:italic;" },
        { cmd: "formatBlock", arg: "H4", label: "H", title: "소제목" },
        { cmd: "formatBlock", arg: "P", label: "P", title: "본문 문단" },
        { cmd: "insertUnorderedList", label: "•", title: "글머리 기호 목록" },
        { cmd: "createLink", label: "🔗", title: "링크 삽입", needsPrompt: true },
        { cmd: "removeFormat", label: "✕", title: "서식 지우기" },
    ];

    function create(container, initialHtml) {
        container.innerHTML = "";
        container.classList.add("rte");

        const toolbar = document.createElement("div");
        toolbar.className = "rte_toolbar";

        const area = document.createElement("div");
        area.className = "rte_area";
        area.contentEditable = "true";
        area.innerHTML = initialHtml || "";

        BUTTONS.forEach((b) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "rte_btn";
            btn.textContent = b.label;
            btn.title = b.title;
            btn.style.cssText = b.style || "";
            btn.addEventListener("mousedown", (e) => {
                // prevent the editable area from losing selection focus
                e.preventDefault();
            });
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

#!/usr/bin/env python3
"""Copy selected event page(s) plus their shared dependencies into publish/,
so they can be deployed independently while the rest of the site is still a
work in progress.

What it does:
  - copies the shared root assets (common.css, subpage.css, subpage.js,
    main_images/) that every event page relies on via "../" paths
  - copies the subset of events/*.js that an event subpage actually loads
    (events-data.js, events-nav.js, events-meta.js, events-map.js) — NOT
    calendar.js/events-carousel.js, which only the main events list page uses
  - trims the copied events-data.js down to just the published event(s), so
    the sidebar (built by events-nav.js from that file) doesn't list
    unfinished events
  - copies each requested event folder as-is, except a raw .png source photo
    is skipped when a compressed .jpg/.jpeg sibling with the same name
    exists (that sibling is what the page actually references)
  - disables the Home / Events / Tea Info sidebar links and the header logo
    link in the copied pages, since those destination pages aren't part of
    this publish
  - removes the header's hamburger nav-toggle button AND the #mySidebar
    panel entirely in the copied pages — the original page is never touched
  - hides the 신청하기 (apply) button in the copied pages, since signup
    isn't wired up for an early, separately-published preview

What it does NOT do (do this yourself afterwards):
  - actually deploy publish/motherPage/ anywhere — point a separate static
    host (a different GitHub Pages repo/branch, Netlify, etc.) at that
    folder once it's generated
  - register the publish target's domain for the embedded Naver Map: the
    NCP key in events-map.js is domain-restricted, so the map will silently
    fail to load on a new domain until it's added in the NCP console

Usage:
    python3 scripts/publish_events.py <event-folder> [more-event-folders...]
    python3 scripts/publish_events.py 2026julyRegulars17
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOTHER = ROOT / "motherPage"
OUT = ROOT / "publish" / "motherPage"

SHARED_ROOT_FILES = ["common.css", "subpage.css", "subpage.js"]
SHARED_EVENT_FILES = ["events-data.js", "events-nav.js", "events-meta.js", "events-map.js"]

# nav links that point at pages this publish doesn't include — disabled
# in the copied HTML instead of being left as dead links
DISABLED_NAV_HREFS = ["../index.html", "../events/index.html", "../teaInfo/index.html"]


def filter_events_data(src: Path, dst: Path, keep_folders: list) -> None:
    text = src.read_text(encoding="utf-8")
    marker = "const teaClubEvents = ["
    start = text.index(marker) + len(marker)
    end = text.index("\n];", start) + 1  # up to (not including) the "];" line
    body = text[start:end]

    # every event entry is a flat { key: value, ... } object with no nested
    # braces, so a non-nested brace match reliably captures one entry each
    objects = re.findall(r"\{[^{}]*\}", body, flags=re.DOTALL)

    kept = []
    found_folders = set()
    for obj in objects:
        for folder in keep_folders:
            if f'path: "{folder}/' in obj:
                kept.append(obj)
                found_folders.add(folder)
                break

    missing = set(keep_folders) - found_folders
    if missing:
        print(f"warning: no events-data.js entry found for: {', '.join(sorted(missing))}", file=sys.stderr)

    new_body = "\n" + ",\n".join(kept) + "\n"
    new_text = text[:start] + new_body + text[end:]
    dst.write_text(new_text, encoding="utf-8")


def disable_dead_nav(html_path: Path) -> None:
    text = html_path.read_text(encoding="utf-8")
    for href in DISABLED_NAV_HREFS:
        text = text.replace(f'href="{href}"', 'href="#" aria-disabled="true" tabindex="-1"')
    html_path.write_text(text, encoding="utf-8")


# the header's hamburger button just opens the sidebar — both are stripped
# entirely from the copy (the original page keeps them)
HEADER_TOGGLE_RE = re.compile(
    r'[ \t]*<button id="menuToggle"[^>]*>.*?</button>\n?', re.DOTALL
)
SIDEBAR_RE = re.compile(
    r'[ \t]*<div id="mySidebar"[^>]*>.*?\n    </div>\n?', re.DOTALL
)
# signup isn't wired up yet for an early, separately-published preview —
# hidden (not removed) so the markup/structure stays intact
EVENT_APPLY_RE = re.compile(r'<div class="event_apply">')


def remove_header_and_sidebar_nav(html_path: Path) -> None:
    text = html_path.read_text(encoding="utf-8")
    text = HEADER_TOGGLE_RE.sub("", text)
    text = SIDEBAR_RE.sub("", text)
    html_path.write_text(text, encoding="utf-8")


def hide_apply_button(html_path: Path) -> None:
    text = html_path.read_text(encoding="utf-8")
    text = EVENT_APPLY_RE.sub('<div class="event_apply" style="display: none;">', text)
    html_path.write_text(text, encoding="utf-8")


def main() -> None:
    folders = sys.argv[1:]
    if not folders:
        print(__doc__)
        sys.exit(1)

    for folder in folders:
        if not (MOTHER / folder).is_dir():
            print(f"error: motherPage/{folder} does not exist", file=sys.stderr)
            sys.exit(1)

    if OUT.parent.exists():
        shutil.rmtree(OUT.parent)
    OUT.mkdir(parents=True)

    for name in SHARED_ROOT_FILES:
        shutil.copy2(MOTHER / name, OUT / name)
    shutil.copytree(MOTHER / "main_images", OUT / "main_images")

    (OUT / "events").mkdir()
    for name in SHARED_EVENT_FILES:
        if name == "events-data.js":
            filter_events_data(MOTHER / "events" / name, OUT / "events" / name, folders)
        else:
            shutil.copy2(MOTHER / "events" / name, OUT / "events" / name)

    for folder in folders:
        src_dir = MOTHER / folder
        dest = OUT / folder
        # skip a raw .png source photo when a compressed .jpg/.jpeg sibling
        # with the same stem exists (that sibling is the one actually
        # referenced by the page) — keeps oversized originals out of a
        # separately-hosted publish
        raw_originals = {
            p.name for p in src_dir.glob("*.png")
            if (p.with_suffix(".jpg").exists() or p.with_suffix(".jpeg").exists())
        }
        shutil.copytree(src_dir, dest, ignore=lambda _, names: raw_originals & set(names))
        for html in dest.glob("*.html"):
            disable_dead_nav(html)
            remove_header_and_sidebar_nav(html)
            hide_apply_button(html)

    print(f"Published {len(folders)} event page(s) to {OUT.parent.relative_to(ROOT)}/")
    for folder in folders:
        print(f"  - motherPage/{folder}/")
    print()
    print("Next steps (not done by this script):")
    print("  - point a separate static host at publish/motherPage/ to actually deploy it")
    print("  - register that host's domain for the Naver Maps key in NCP if any published")
    print("    event has an embedded map (events-map.js), or the map won't load")


if __name__ == "__main__":
    main()

"""Smoke test for the static site: every page exists, has the right lang/dir,
an OpenBiz title, and every relative link/asset resolves to a file.

Run: python3 tests/smoke.py
"""
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent.parent

PAGES = {
    "index.html": ("he", "rtl"),
    "en/index.html": ("en", "ltr"),
    "privacy/index.html": ("he", "rtl"),
    "en/privacy/index.html": ("en", "ltr"),
    "terms/index.html": ("he", "rtl"),
    "en/terms/index.html": ("en", "ltr"),
    "404.html": ("he", "rtl"),
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = self.dir = None
        self.title = ""
        self._in_title = False
        self.refs = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang, self.dir = a.get("lang"), a.get("dir")
        if tag == "title":
            self._in_title = True
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if key in a and not (tag == "link" and a.get("rel") in ("canonical", "alternate")):
                self.refs.append(a[key])

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def resolve(page_rel: str, ref: str) -> Path | None:
    """Map a link to a file on disk; None for links that are not local files."""
    parts = urlsplit(ref)
    if parts.scheme or ref.startswith("#") or ref.startswith("mailto:"):
        return None
    path = unquote(parts.path)
    base = ROOT if path.startswith("/") else (ROOT / page_rel).parent
    target = (base / path.lstrip("/")).resolve()
    if path.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


def main() -> int:
    errors = []
    for rel, (lang, direction) in PAGES.items():
        f = ROOT / rel
        if not f.is_file():
            errors.append(f"{rel}: missing")
            continue
        p = Page()
        p.feed(f.read_text(encoding="utf-8"))
        if (p.lang, p.dir) != (lang, direction):
            errors.append(f"{rel}: lang/dir is {p.lang}/{p.dir}, expected {lang}/{direction}")
        if "OpenBiz" not in p.title:
            errors.append(f"{rel}: title {p.title!r} lacks OpenBiz")
        for ref in p.refs:
            target = resolve(rel, ref)
            if target is not None and not target.is_file():
                errors.append(f"{rel}: broken link {ref} -> {target.relative_to(ROOT) if ROOT in target.parents else target}")
    for rel in ("index.html", "en/index.html"):
        html = (ROOT / rel).read_text(encoding="utf-8")
        for needle in ('id="lead-form"', 'name="website"', 'name="consent"', 'id="lead-status"',
                       'id="chat"', 'class="chat-log"', "data-open-chat", "data-wa-link", "data-api=", "site.js"):
            if needle not in html:
                errors.append(f"{rel}: v2 markup missing {needle}")
    for rel in PAGES:
        if "static.cloudflareinsights.com/beacon.min.js" not in (ROOT / rel).read_text(encoding="utf-8"):
            errors.append(f"{rel}: no Cloudflare Web Analytics beacon")
    for rel in ("privacy/index.html", "en/privacy/index.html"):
        if 'id="data-deletion"' not in (ROOT / rel).read_text(encoding="utf-8"):
            errors.append(f"{rel}: no #data-deletion anchor (Meta data-deletion URL)")
    for e in errors:
        print("FAIL", e)
    print(f"{len(PAGES)} pages checked, {len(errors)} problems")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

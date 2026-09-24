#!/usr/bin/env python3
"""
make-sitemap.py — generate sitemap.xml from posts.json + known pages.

Order and priorities mirror the hand-maintained file this replaces:
home, blog archive, lab pages, then posts newest-first. lastmod comes from
posts.json dates (posts, home, archive) and git history (lab pages); when git
has no date (fresh file, shallow clone) the tag is omitted rather than guessed,
because a wrong lastmod is worse than none for crawlers.

Usage:
    python3 tools/make-sitemap.py            # rewrite sitemap.xml when dirty
    python3 tools/make-sitemap.py --check    # exit 1 when sitemap.xml is stale
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_JSON = ROOT / "posts.json"
SITEMAP = ROOT / "sitemap.xml"
SITE = "https://mehdiaskari.ir"

STATIC = [
    ("/", "weekly", "1.0", None),
    ("/blog/all/", "weekly", "0.8", None),
    ("/lab/", "weekly", "0.8", "lab/index.html"),
    ("/lab/evm/", "weekly", "0.8", "lab/evm/index.html"),
    ("/lab/weight-factor/", "monthly", "0.8", "lab/weight-factor/index.html"),
]

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def git_date(rel: str):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cd", "--date=short", "--", rel],
            cwd=str(ROOT), capture_output=True, text=True, timeout=15)
        d = out.stdout.strip()
        return d if DATE_RE.match(d) else None
    except Exception:
        return None


def build() -> str:
    data = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    posts = data.get("posts", [])
    for p in posts:
        if not DATE_RE.match(p.get("date", "")):
            raise SystemExit(f"posts.json: bad date for {p.get('slug')}")
    newest = max(p["date"] for p in posts)

    urls = []
    for path, freq, prio, src in STATIC:
        if src is None:
            lastmod = newest
        else:
            lastmod = git_date(src) or newest
        urls.append((path, lastmod, freq, prio))
    for p in sorted(posts, key=lambda x: x["date"], reverse=True):
        urls.append((f"/blog/{p['slug']}/", p["date"], "monthly", "0.7"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, lastmod, freq, prio in urls:
        lines += ["  <url>",
                  f"    <loc>{SITE}{path}</loc>",
                  f"    <lastmod>{lastmod}</lastmod>",
                  f"    <changefreq>{freq}</changefreq>",
                  f"    <priority>{prio}</priority>",
                  "  </url>"]
    return "\n".join(lines) + "\n"


def main():
    want = build()
    have = SITEMAP.read_text(encoding="utf-8") if SITEMAP.exists() else ""
    if "--check" in sys.argv:
        if have != want:
            print("sitemap.xml is stale — run: python3 tools/make-sitemap.py")
            return 1
        print("sitemap.xml matches posts.json + pages")
        return 0
    if have != want:
        SITEMAP.write_text(want, encoding="utf-8")
        print("wrote sitemap.xml")
    else:
        print("sitemap.xml already current")
    return 0


if __name__ == "__main__":
    sys.exit(main())

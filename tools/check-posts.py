#!/usr/bin/env python3
"""
check-posts.py — keep posts.json and the blog/ folder in sync.

Guards the failure modes that actually bite on a hand-maintained blog:
  * a post page exists but is not registered in posts.json (invisible in the
    archive, RSS and sitemap)
  * posts.json references a slug with no page (404 card)
  * missing / empty fields, malformed dates, sloppy slugs
  * a post page whose canonical / og:url does not match its slug
  * posts out of date order (the archive renders them as-is)

Usage:
    python3 tools/check-posts.py
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "blog"
POSTS = ROOT / "posts.json"

REQUIRED = ('slug', 'title', 'titleEn', 'date', 'dateFa', 'excerpt', 'excerptEn', 'tags')
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]*$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SKIP_DIRS = {'all', '_template'}


def main():
    errors, warnings = [], []

    if not POSTS.exists():
        print("posts.json is missing")
        return 1
    try:
        data = json.loads(POSTS.read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        print(f"posts.json is not valid JSON: {exc}")
        return 1

    posts = data.get('posts') if isinstance(data, dict) else data
    if not isinstance(posts, list) or not posts:
        print("posts.json must contain a non-empty 'posts' list")
        return 1

    on_disk = {p.parent.name for p in BLOG.glob('*/index.html') if p.parent.name not in SKIP_DIRS}
    declared = []

    for i, post in enumerate(posts):
        slug = (post.get('slug') or '').strip()
        label = slug or f"#{i}"
        declared.append(slug)

        if not slug:
            errors.append(f"post #{i}: missing slug")
            continue
        if not SLUG_RE.match(slug):
            errors.append(f"{slug}: slug should be lowercase latin/digits/hyphens")

        for field in REQUIRED:
            if field == 'slug':
                continue
            val = post.get(field)
            if val in (None, '', []):
                errors.append(f"{slug}: missing/empty '{field}'")

        d = post.get('date') or ''
        if d and not DATE_RE.match(d):
            errors.append(f"{slug}: date '{d}' should be YYYY-MM-DD")
        elif d:
            try:
                date.fromisoformat(d)
            except ValueError:
                errors.append(f"{slug}: date '{d}' is not a real calendar date")

        tags = post.get('tags')
        if tags is not None and (not isinstance(tags, list) or any(not str(t).strip() for t in tags)):
            errors.append(f"{slug}: tags must be a list of non-empty strings")

        page = BLOG / slug / "index.html"
        if not page.exists():
            errors.append(f"{slug}: registered in posts.json but blog/{slug}/index.html does not exist")
            continue

        html = page.read_text(encoding='utf-8')
        for attr in ('canonical', 'og:url'):
            m = re.search(rf'<(?:link rel="{attr}"|meta property="article:{attr}"|meta property="{attr}")[^>]*content="([^"]+)"', html) \
                or re.search(rf'<link rel="{attr}" href="([^"]+)"', html)
            if m and slug not in m.group(1):
                errors.append(f"{slug}: {attr} points at '{m.group(1)}'")

        title = (post.get('title') or '').strip()
        if title and title not in html:
            warnings.append(f"{slug}: posts.json title not found verbatim in the page <h1>")

    missing = sorted(on_disk - set(declared))
    for slug in missing:
        errors.append(f"blog/{slug}/index.html exists but is not registered in posts.json")

    dupes = {s for s in declared if declared.count(s) > 1}
    for slug in sorted(dupes):
        errors.append(f"{slug}: duplicated in posts.json")

    dates = [p.get('date') for p in posts if p.get('date')]
    if dates != sorted(dates, reverse=True):
        warnings.append("posts.json is not sorted newest-first")

    for e in errors:
        print(f"ERROR   {e}")
    for w in warnings:
        print(f"WARN    {w}")

    print(f"\n{len(posts)} post(s) declared, {len(on_disk)} page(s) on disk, "
          f"{len(errors)} error(s), {len(warnings)} warning(s).")
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())

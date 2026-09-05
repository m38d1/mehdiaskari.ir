#!/usr/bin/env python3
"""
check-schema.py — every JSON-LD block on the site must parse and agree with posts.json.

Structured data is invisible, so it rots silently: a renamed title or a moved slug
leaves a schema that Google happily keeps serving. This pins the blocks to the single
source of truth the rest of the site already reads.

Usage:
    python3 tools/check-schema.py            # exit 1 on any problem
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://mehdiaskari.ir'
BLOCK = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
ARTICLE = re.compile(r'data-entity="article"')

problems = []
checked = 0


def fail(path, msg):
    problems.append(f'{path}: {msg}')


def blocks(path):
    html = path.read_text(encoding='utf-8')
    return [(m.group(0), m.group(1)) for m in BLOCK.finditer(html)]


def nodes(raw):
    """Yield schema nodes, unwrapping @graph."""
    data = json.loads(raw.replace('\\u003c', '<'))
    graph = data.get('@graph')
    return graph if isinstance(graph, list) else [data]


def type_of(node):
    t = node.get('@type')
    return t if isinstance(t, str) else (t[0] if isinstance(t, list) and t else '')


# ---------------------------------------------------------------- whole site
for page in sorted(ROOT.rglob('*.html')):
    if '.git' in page.parts or page.parts[0] == 'tools':
        continue
    for whole, raw in blocks(page):
        checked += 1
        try:
            json.loads(raw.replace('\\u003c', '<'))
        except Exception as exc:
            fail(page, f'JSON-LD does not parse — {exc}')
            continue
        if '</script' in raw:
            fail(page, 'JSON-LD contains a literal </script — it must be \\u003c escaped')

# ---------------------------------------------------------------- posts.json <-> pages
posts = json.loads((ROOT / 'posts.json').read_text(encoding='utf-8'))
posts = posts if isinstance(posts, list) else posts.get('posts', [])
by_slug = {p.get('slug'): p for p in posts if isinstance(p, dict)}

for slug, post in sorted(by_slug.items()):
    page = ROOT / 'blog' / slug / 'index.html'
    if not page.exists():
        continue                                   # check-posts.py owns that failure
    art = [raw for _w, raw in blocks(page) if ARTICLE.search(_w)]
    if not art:
        fail(page, 'no BlogPosting schema — run: python3 tools/sync-post-ui.py')
        continue
    if len(art) > 1:
        fail(page, f'{len(art)} article schema blocks, expected 1')
    node = next((n for n in nodes(art[0]) if type_of(n) == 'BlogPosting'), None)
    if not node:
        fail(page, 'article block has no BlogPosting node')
        continue
    want_head = (post.get('title') or '')[:110]
    if node.get('headline') != want_head:
        fail(page, f"headline {node.get('headline')!r} != posts.json {want_head!r}")
    if node.get('datePublished') != post.get('date'):
        fail(page, f"datePublished {node.get('datePublished')!r} != posts.json {post.get('date')!r}")
    if node.get('url') != f'{SITE}/blog/{slug}/':
        fail(page, f"url {node.get('url')!r} does not match the slug")
    pub = node.get('publisher') or {}
    if not pub.get('logo'):
        fail(page, 'BlogPosting without a publisher logo — rich results want one')

# ---------------------------------------------------------------- the archive
archive = ROOT / 'blog' / 'all' / 'index.html'
if archive.exists():
    blog = None
    for _w, raw in blocks(archive):
        for n in nodes(raw):
            if type_of(n) == 'Blog':
                blog = n
    if blog is None:
        fail(archive, 'no Blog schema — run: python3 tools/sync-post-ui.py')
    else:
        listed = {u.get('url') for u in (blog.get('blogPost') or [])}
        for slug in by_slug:
            if f'{SITE}/blog/{slug}/' not in listed:
                fail(archive, f'Blog.blogPost is missing {slug}')

if not problems:
    print(f'ok      {checked} JSON-LD block(s) parse, {len(by_slug)} post(s) cross-checked')
for p in problems:
    print('FAIL   ', p)
print(f'\n{len(problems)} problem(s).')
sys.exit(1 if problems else 0)

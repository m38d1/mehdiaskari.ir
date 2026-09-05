#!/usr/bin/env python3
"""
make-rss.py — regenerate blog/rss.xml with the FULL text of every post.

The feed used to be hand-maintained and carried only the short excerpts, so
RSS readers showed a snippet and nothing else. This script rebuilds the whole
file from the two places the site already keeps as truth:

  * posts.json            -> item order, title, link, guid, pubDate,
                             description, categories
  * blog/<slug>/index.html -> <content:encoded>: the article body, wrapped in
                             CDATA after a small feed-safety pass:
                               - <script> elements removed
                               - root-relative src/href made absolute
                               - reveal-animation classes (fu, d1..) stripped
                                 from the article's TOP-LEVEL children only
                                 (no JS in a reader; .fu animates from opacity:0)
                               - hidden tab-panels flattened: every panel's
                                 content is kept, preceded by an <h3> carrying
                                 its tab's label; same for acc-body and
                                 dialog-backdrop wrappers
                               - "]]>" split so the CDATA cannot break

Channel metadata (title / link / description / language) is read back from the
current blog/rss.xml so hand-tuned wording survives regeneration; the atom:link
self-reference and the newest-first item order are preserved.

Usage:
    python3 tools/make-rss.py --out /tmp/rss-preview.xml   # preview to a file
    python3 tools/make-rss.py                              # preview to stdout
    python3 tools/make-rss.py --write                      # rewrite blog/rss.xml
    python3 tools/make-rss.py --check                      # CI: exit 1 if rss.xml is stale
"""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "blog"
POSTS = ROOT / "posts.json"
FEED = BLOG / "rss.xml"
SITE = "https://mehdiaskari.ir"
FEED_URL = SITE + "/blog/rss.xml"

# Fallbacks only — the live values are read from the current rss.xml.
DEFAULT_CHANNEL = {
    'title': 'وبلاگ مهدی عسکری',
    'link': SITE + '/blog/',
    'description': 'یادداشت‌های مهدی عسکری درباره برنامه‌ریزی و کنترل پروژه، توسعه وب، شبکه و هوش مصنوعی',
    'language': 'fa',
}

# RFC 822 day/month names, fixed so the output never depends on locale.
DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')

ARTICLE_RE = re.compile(r'<article class="prose[^"]*">(.*?)</article>', re.S)
TAG_RE = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)(/?)>')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'}
# blog.css: .fu{animation:fadeUp ... both} .fu.d1/.d2/.d3 add a delay.
REVEAL_RE = re.compile(r'\b(?:fu|d[1-9])\b')


# ------------------------------------------------------------------ helpers
def esc(text):
    """XML-escape text content; leave Persian/ZWNJ bytes alone."""
    return (str(text).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def tag_attrs(raw):
    """class / data-panel / data-tab of one start tag."""
    def attr(name):
        m = re.search(rf'{name}="([^"]*)"', raw)
        return m.group(1) if m else ''
    return attr('class'), attr('data-panel'), attr('data-tab')


def element_end(html, start, tagname):
    """Index just past the </tagname> that closes the element opening at start."""
    depth = 0
    for m in TAG_RE.finditer(html, start):
        name = m.group(2).lower()
        if name in VOID or m.group(4) == '/':
            continue
        if name != tagname:
            continue
        depth += -1 if m.group(1) == '/' else 1
        if depth == 0:
            return m.end()
    return -1


def iter_elements(html, tagname, class_re):
    """Yield (start, end, starttag_match) for <tagname class~class_re> elements."""
    pos = 0
    while True:
        m = re.search(rf'<{tagname}\b[^>]*>', html[pos:], re.I)
        if not m:
            return
        start = pos + m.start()
        cls, _, _ = tag_attrs(m.group(0))
        if re.search(class_re, cls):
            end = element_end(html, start, tagname)
            if end > 0:
                yield start, end, m
                pos = end
                continue
        pos = pos + m.end()  # not a hit: resume after this tag

def inner_of(html, start, end):
    """Markup strictly between the element's start and end tags."""
    open_end = html.index('>', start) + 1
    close_start = html.rindex('<', start, end)
    return html[open_end:close_start]


def text_of(fragment):
    """Plain text of a snippet, tags stripped and entities decoded."""
    text = re.sub(r'<[^>]+>', '', fragment)
    return re.sub(r'\s+', ' ', text).strip()


# ------------------------------------------------------------------ feed body
def flatten_tabs(html):
    """Every .tabs group: keep the tab buttons, but give each panel its own
    <h3> heading so content hidden behind an inactive tab is not lost."""
    groups = list(iter_elements(html, 'div', r'\btabs\b'))
    for g_start, g_end, _ in reversed(groups):
        group = html[g_start:g_end]
        labels = {}
        for m in re.finditer(r'<button\b[^>]*\bdata-tab="([^"]*)"[^>]*>(.*?)</button>',
                             group, re.S):
            labels[m.group(1)] = text_of(m.group(2))
        for p_start, p_end, _ in reversed(list(iter_elements(group, 'div', r'\btab-panel\b'))):
            _, panel_id, _ = tag_attrs(group[p_start:group.index('>', p_start) + 1])
            inner = inner_of(group, p_start, p_end).strip()
            label = esc(labels.get(panel_id, panel_id))
            group = (group[:p_start] + f'<h3>{label}</h3>\n{inner}\n' + group[p_end:])
        html = html[:g_start] + group + html[g_end:]
    return html


def unwrap_class(html, class_re, keep_heading=None):
    """Replace <div class~class_re>INNER</div> with INNER (wrapper is CSS-only)."""
    for start, end, _ in reversed(list(iter_elements(html, 'div', class_re))):
        inner = inner_of(html, start, end).strip()
        html = html[:start] + inner + html[end:]
    return html


def strip_reveal_classes(html):
    """Drop fu/d1/... from the article's top-level children only; deeper
    elements keep their classes (callout, tab-panel, ... carry meaning)."""
    out, pos, depth = [], 0, 0
    spans = []  # (tag_start, tag_end) of top-level start tags to rewrite
    while True:
        m = TAG_RE.search(html, pos)
        if not m:
            break
        name = m.group(2).lower()
        if m.group(1) == '/':
            depth -= 1
            pos = m.end()
            continue
        if depth == 0 and name not in VOID and m.group(4) != '/':
            spans.append((m.start(), m.end()))
        if name not in VOID and m.group(4) != '/':
            depth += 1
        pos = m.end()
    for start, end in reversed(spans):
        tag = html[start:end]
        m = re.search(r'class="([^"]*)"', tag)
        if not m or not REVEAL_RE.search(m.group(1)):
            continue
        left = ' '.join(REVEAL_RE.sub(' ', m.group(1)).split())
        if left:
            tag = tag[:m.start(1)] + left + tag[m.end(1):]
        else:  # drop the attribute together with its preceding space
            cut = m.start()
            while cut > 0 and tag[cut - 1] in ' \t':
                cut -= 1
            tag = tag[:cut] + tag[m.end():]
        html = html[:start] + tag + html[end:]
    return html


def absolutize(html):
    """Root-relative src/href -> absolute, so links work inside a reader."""
    return re.sub(r'\b(src|href)=["\'](/[^"\']*)["\']',
                  lambda m: f'{m.group(1)}="{SITE}{m.group(2)}"', html)


def feed_body(page_html):
    """Transformed article inner HTML, ready for CDATA."""
    m = ARTICLE_RE.search(page_html)
    if not m:
        return None
    html = re.sub(r'<script\b.*?</script>', '', m.group(1), flags=re.S | re.I)
    html = flatten_tabs(html)
    html = unwrap_class(html, r'\bacc-body\b')
    # dialogs are hidden until clicked too; the card carries its own <h3>,
    # so dropping just the backdrop/card wrappers loses nothing.
    html = unwrap_class(html, r'\bdialog-backdrop\b')
    html = unwrap_class(html, r'\bdialog-card\b')
    html = strip_reveal_classes(html)
    html = absolutize(html)
    return html.strip().replace(']]>', ']]]]><![CDATA[>')


def pub_date(iso):
    d = date.fromisoformat(iso)
    return f'{DAYS[d.weekday()]}, {d.day:02d} {MONTHS[d.month - 1]} {d.year} 00:00:00 +0330'


# ------------------------------------------------------------------ assembly
def channel_meta():
    """Reuse the wording already in blog/rss.xml (channel block, before items)."""
    meta = dict(DEFAULT_CHANNEL)
    if FEED.exists():
        head = FEED.read_text(encoding='utf-8').split('<item>', 1)[0]
        for key in meta:
            m = re.search(rf'<{key}>(.*?)</{key}>', head, re.S)
            if m:
                meta[key] = m.group(1)
    return meta


def build_item(post, body):
    url = f'{SITE}/blog/{post["slug"]}/'
    lines = [
        '  <item>',
        f'    <title>{esc(post.get("title", ""))}</title>',
        f'    <link>{url}</link>',
        f'    <guid isPermaLink="true">{url}</guid>',
        f'    <pubDate>{pub_date(post.get("date") or "")}</pubDate>',
        f'    <description>{esc(post.get("excerpt", ""))}</description>',
        f'    <content:encoded><![CDATA[\n{body}\n]]></content:encoded>',
    ]
    for tag in post.get('tags') or []:
        if str(tag).strip():
            lines.append(f'    <category>{esc(tag)}</category>')
    lines.append('  </item>')
    return '\n'.join(lines)


def build_feed():
    """Return (xml_text, n_items, n_skipped, n_failed)."""
    data = json.loads(POSTS.read_text(encoding='utf-8'))
    posts = data if isinstance(data, list) else data.get('posts', [])

    meta = channel_meta()
    items, skipped, failed = [], 0, 0
    for post in posts:
        slug = (post.get('slug') or '').strip()
        page = BLOG / slug / 'index.html'
        if not slug or not page.exists():
            print(f'warn    {slug or post}: blog/{slug}/index.html missing -> skipped')
            skipped += 1
            continue
        body = feed_body(page.read_text(encoding='utf-8'))
        if body is None:
            print(f'FAIL    {slug}: no <article class="prose ..."> in the page')
            failed += 1
            continue
        try:
            items.append(build_item(post, body))
        except ValueError as exc:  # bad date field
            print(f'FAIL    {slug}: {exc}')
            failed += 1
            continue
        print(f'ok      {page.relative_to(ROOT)}  -> {len(body) / 1024:.1f} KB feed body')

    head = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"'
        ' xmlns:content="http://purl.org/rss/1.0/modules/content/">\n'
        '<channel>\n'
        f'  <title>{esc(meta["title"])}</title>\n'
        f'  <link>{esc(meta["link"])}</link>\n'
        f'  <description>{esc(meta["description"])}</description>\n'
        f'  <language>{esc(meta["language"])}</language>\n'
        f'  <atom:link href="{FEED_URL}" rel="self" type="application/rss+xml"/>\n'
    )
    xml = head + '\n'.join(items) + '\n</channel>\n</rss>\n'
    return xml, len(items), skipped, failed


def check_against_disk(xml_text):
    """--check: compare generated feed with the committed one."""
    if not FEED.exists():
        print('FAIL  blog/rss.xml does not exist; run: python3 tools/make-rss.py --write')
        return 1
    on_disk = FEED.read_text(encoding='utf-8')
    if on_disk == xml_text:
        print('ok    blog/rss.xml matches posts.json + article bodies')
        return 0
    a, b = on_disk.splitlines(), xml_text.splitlines()
    diff = [i for i in range(max(len(a), len(b)))
            if (a[i] if i < len(a) else None) != (b[i] if i < len(b) else None)]
    print(f'FAIL  blog/rss.xml is stale ({len(diff)} of {max(len(a), len(b))} lines differ)')
    for i in diff[:5]:
        print(f'  line {i + 1}:')
        print(f'    on-disk:   {a[i][:100] if i < len(a) else "<missing>"}')
        print(f'    generated: {b[i][:100] if i < len(b) else "<missing>"}')
    if len(diff) > 5:
        print(f'  ... {len(diff) - 5} more differing lines')
    print('  fix with: python3 tools/make-rss.py --write')
    return 1


def main():
    ap = argparse.ArgumentParser(description='regenerate blog/rss.xml with full article text')
    group = ap.add_mutually_exclusive_group()
    group.add_argument('--write', action='store_true', help='overwrite blog/rss.xml')
    group.add_argument('--out', metavar='PATH', help='write the feed to PATH instead')
    group.add_argument('--check', action='store_true', help='fail if blog/rss.xml is not up to date')
    args = ap.parse_args()

    if not POSTS.exists():
        print('FAIL  posts.json is missing')
        return 1

    xml_text, n_items, n_skipped, n_failed = build_feed()

    if args.check:
        rc = check_against_disk(xml_text)
    elif args.write:
        FEED.write_text(xml_text, encoding='utf-8')
        print(f'ok    wrote {FEED.relative_to(ROOT)}')
        rc = 0
    elif args.out:
        Path(args.out).write_text(xml_text, encoding='utf-8')
        print(f'ok    wrote {args.out}')
        rc = 0
    else:
        sys.stdout.write(xml_text)
        rc = 0

    print(f'\n{n_items} item(s) in feed, {n_skipped} skipped, {n_failed} failed.')
    return 1 if (rc or n_failed) else 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
sync-post-ui.py — keep every blog post on the shared modern UI baseline.

All the behaviour lives in /components.css + /components.js, so a post only has
to carry the two tags plus the shared header markup. This script makes that true
for every post under blog/, and it is idempotent — run it as often as you like.

Usage:
    python3 tools/sync-post-ui.py                 # patch every existing post
    python3 tools/sync-post-ui.py --check         # report only, write nothing (exit 1 if off-baseline)
    python3 tools/sync-post-ui.py --add <slug>    # create a new post from the template
    python3 tools/sync-post-ui.py --template      # rebuild tools/post-template.html
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "blog"
TOOLS = ROOT / "tools"
TEMPLATE = TOOLS / "post-template.html"
REF_POST = BLOG / "weight-factor-excel-msp" / "index.html"
POSTS_JSON = ROOT / "posts.json"
ARCHIVE = BLOG / "all" / "index.html"
SITE = "https://mehdiaskari.ir"

# ------------------------------------------------------------------ patches
CSS_ANCHOR = '<link rel="stylesheet" href="/blog.css">'
JS_ANCHOR = '<script src="/cover.js" defer></script>'
CSS_LINK = '\n<link rel="stylesheet" href="/components.css">'
JS_TAG = '\n<script src="/components.js" defer></script>'
GLOW = '<div class="cursor-glow" aria-hidden="true"></div>'

NAV_SKILLS = '          <li><a href="/#skills" data-en="Skills">'
NAV_EDU = ('          <li><a href="/#education" data-en="Education">تحصیلات</a></li>\n'
           '          <li><a href="/#skills" data-en="Skills">')
MENU_SKILLS = '    <a href="/#skills" data-en="Skills">'
MENU_EDU = ('    <a href="/#education" data-en="Education">تحصیلات</a>\n'
            '    <a href="/#skills" data-en="Skills">')

# "Lab" sits between Skills and Blog on every page. The nav needle is
# '<li><a href="/lab/"' and the mobile one is '    <a href="/lab/"' — the four
# spaces never match inside the nav line (it has '<li>' there), so the two
# insertions cannot short-circuit each other.
NAV_BLOG = '          <li><a href="/blog/all/" data-en="Blog">'
NAV_LAB = ('          <li><a href="/lab/" data-en="Lab">آزمایشگاه</a></li>\n'
           '          <li><a href="/blog/all/" data-en="Blog">')
# The site had no chart glyph at all, which is odd for a dashboard person.
SPRITE_ANCHOR = '<symbol id="i-tools" viewBox="0 0 24 24">'
SPRITE_ICON = ('<symbol id="i-chart" viewBox="0 0 24 24">'
               '<path d="M4 20V4M4 20h16"/>'
               '<path d="M7.5 16.5V12M11.5 16.5V8.5M15.5 16.5V13.5M19.5 16.5V6"/></symbol>')

MENU_BLOG = '    <a href="/blog/all/" data-en="Blog">'
MENU_LAB = ('    <a href="/lab/" data-en="Lab">آزمایشگاه</a>\n'
            '    <a href="/blog/all/" data-en="Blog">')

THEME_ANCHOR = 'class="theme-toggle" role="group"'
LANG_BLOCK = (
    'class="lang-toggle" role="group" aria-label="زبان / Language">\n'
    '        <button class="lang-opt" data-lang="fa">فا</button>\n'
    '        <button class="lang-opt" data-lang="en">EN</button>\n'
    '      </div>\n'
    '      <button class="cmdk-hint" id="cmdk-hint" aria-label="پالت فرمان" '
    "data-en='<span>⌘</span><kbd>K</kbd>'><span>Ctrl</span><kbd>K</kbd></button>\n"
    '      <div ' + THEME_ANCHOR
)

CMDK_OVERLAY = """<div class="cmdk-overlay" id="cmdk-overlay">
  <div class="cmdk-modal" role="dialog" aria-modal="true" aria-label="Command palette">
    <div class="cmdk-input-row">
      <svg viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/></svg>
      <input type="text" class="cmdk-input" id="cmdk-input" placeholder="جستجو یا اجرای دستور… (مثلاً «تماس» یا «تم»)">
      <span class="cmdk-esc">Esc</span>
    </div>
    <div class="cmdk-list" id="cmdk-list"></div>
  </div>
</div>"""

CHECKS = {
    'components.css': '/components.css',
    'components.js': '/components.js',
    'cursor glow': 'cursor-glow',
    'Education (nav)': '<li><a href="/#education"',
    'Education (menu)': '    <a href="/#education"',
    'Lab (nav)': '<li><a href="/lab/"',
    'Lab (menu)': '    <a href="/lab/"',
    'chart icon': '<symbol id="i-chart"',
    'lang toggle': 'class="lang-toggle"',
    'cmdk hint': 'class="cmdk-hint"',
    'cmdk overlay': 'id="cmdk-overlay"',
    'social meta': '<meta property="og:image"',
}

# ---------------------------------------------------------------- structured data
# Regenerated from posts.json on every run, so editing a title or date there
# propagates into the schema instead of leaving a stale block behind.
LD_OPEN = '<script type="application/ld+json" data-entity="article">'
LD_RE = re.compile(r'<script type="application/ld\+json" data-entity="article">.*?</script>', re.S)


def load_posts():
    """slug -> metadata, from the same file the blog cards already read."""
    if not POSTS_JSON.exists():
        return {}
    data = json.loads(POSTS_JSON.read_text(encoding='utf-8'))
    items = data if isinstance(data, list) else data.get('posts', [])
    return {p['slug']: p for p in items if isinstance(p, dict) and p.get('slug')}


def word_count(html):
    m = re.search(r'<article\b.*?</article>', html, re.S)
    if not m:
        return None
    text = re.sub(r'<[^>]+>', ' ', m.group(0))
    text = re.sub(r'&[a-z#0-9]+;', ' ', text, flags=re.I)
    words = [w for w in re.split(r'[\s\u200c]+', text) if w.strip()]
    return len(words) or None


def last_touched(path):
    """Real dateModified from git, not a guess — Google compares it to datePublished."""
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%cd', '--date=short', '--', str(path)],
            cwd=str(ROOT), capture_output=True, text=True, timeout=15)
        d = out.stdout.strip()
        return d if re.fullmatch(r'\d{4}-\d{2}-\d{2}', d) else None
    except Exception:
        return None


def build_ld(post, html, path=None):
    published = post.get('date')
    modified = max(x for x in [published, last_touched(path) if path else None] if x)
    url = f"{SITE}/blog/{post['slug']}/"
    tags = [t for t in (post.get('tags') or []) if t]

    article = {
        '@type': 'BlogPosting',
        '@id': url + '#article',
        'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
        'headline': (post.get('title') or '')[:110],
        'description': post.get('excerpt') or '',
        'inLanguage': 'fa-IR',
        'isAccessibleForFree': True,
        'url': url,
        'image': [f'{SITE}/og-image.png'],
        'author': {'@type': 'Person', 'name': 'Mehdi Askari',
                   'alternateName': 'مهدی عسکری', 'url': SITE + '/'},
        'publisher': {'@type': 'Organization', 'name': 'Mehdi Askari', 'url': SITE + '/',
                      'logo': {'@type': 'ImageObject', 'url': SITE + '/icon.svg'}},
    }
    if published:
        article['datePublished'] = published
    if modified:
        article['dateModified'] = modified
    if tags:
        article['keywords'] = ', '.join(tags)
    wc = word_count(html)
    if wc:
        article['wordCount'] = wc

    crumbs = {
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'خانه', 'item': SITE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'وبلاگ', 'item': SITE + '/blog/all/'},
            {'@type': 'ListItem', 'position': 3, 'name': post.get('title') or '', 'item': url},
        ],
    }

    body = json.dumps({'@context': 'https://schema.org',
                       '@graph': [article, crumbs]}, ensure_ascii=False, indent=1)
    # a literal "</script>" inside a JSON string would close the block early
    return LD_OPEN + body.replace('<', '\\u003c') + '</script>'


def refresh_ld(html, slug, meta, path):
    """Return (html, changed). No-op when the post is not declared in posts.json."""
    post = meta.get(slug)
    if not post:
        return html, False
    want = build_ld(post, html, path)
    found = LD_RE.search(html)
    if found and found.group(0) == want:
        return html, False
    html = LD_RE.sub('', html)
    html = re.sub(r'\n[ \t]*\n(</head>)', r'\n\1', html, count=1)
    return html.replace('</head>', want + '\n</head>', 1), True


BLOG_LD_OPEN = '<script type="application/ld+json" data-entity="blog">'
BLOG_LD_RE = re.compile(r'<script type="application/ld\+json" data-entity="blog">.*?</script>', re.S)


def esc_attr(text):
    """Escape text for use inside a double-quoted HTML attribute."""
    return (str(text).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def refresh_social(html, slug, meta):
    """Return (html, changed).

    Social cards (WhatsApp/Telegram/X/LinkedIn) only render an image and a
    title when og:image/og:site_name/og:locale and the twitter:* twins are
    present. Every post gets them right after og:url, derived from posts.json
    so the card text can never drift from the card data.
    """
    if '<meta property="og:image"' in html:
        return html, False
    post = meta.get(slug) or {}
    title = esc_attr(post.get('title') or 'مهدی عسکری')
    desc = esc_attr(post.get('excerpt') or '')
    block = (
        '<meta property="og:site_name" content="مهدی عسکری">\n'
        '<meta property="og:locale" content="fa_IR">\n'
        '<meta property="og:image" content="' + SITE + '/og-image.png">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        '<meta name="twitter:title" content="' + title + '">\n'
        '<meta name="twitter:description" content="' + desc + '">\n'
        '<meta name="twitter:image" content="' + SITE + '/og-image.png">'
    )
    anchor = '<meta property="og:url" content="' + SITE + '/blog/' + slug + '/">'
    if anchor not in html:
        return html, False
    return html.replace(anchor, anchor + '\n' + block, 1), True


def build_blog_ld(meta):
    """The archive page is a Blog, so Google can bind the six postings to one series."""
    url = SITE + '/blog/all/'
    order = sorted(meta.values(), key=lambda p: p.get('date') or '', reverse=True)
    blog = {
        '@type': 'Blog',
        '@id': url + '#blog',
        'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
        'name': 'یادداشت‌ها و نوشته‌ها',
        'alternateName': 'Notes & Articles',
        'description': 'نوشته‌های مهدی عسکری دربارهٔ کنترل پروژه، اکسل، Primavera P6، '
                       'Microsoft Project و شبکهٔ صنعتی.',
        'inLanguage': 'fa-IR',
        'isAccessibleForFree': True,
        'url': url,
        'image': [f'{SITE}/og-image.png'],
        'author': {'@type': 'Person', 'name': 'Mehdi Askari',
                   'alternateName': 'مهدی عسکری', 'url': SITE + '/'},
        'publisher': {'@type': 'Organization', 'name': 'Mehdi Askari', 'url': SITE + '/',
                      'logo': {'@type': 'ImageObject', 'url': SITE + '/icon.svg'}},
        'blogPost': [{
            '@type': 'BlogPosting',
            '@id': f"{SITE}/blog/{p['slug']}/#article",
            'headline': (p.get('title') or '')[:110],
            'url': f"{SITE}/blog/{p['slug']}/",
            'datePublished': p.get('date'),
        } for p in order if p.get('slug')],
    }
    crumbs = {
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'خانه', 'item': SITE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'وبلاگ', 'item': url},
        ],
    }
    body = json.dumps({'@context': 'https://schema.org',
                       '@graph': [blog, crumbs]}, ensure_ascii=False, indent=1)
    return BLOG_LD_OPEN + body.replace('<', '\\u003c') + '</script>'


def refresh_blog_ld(html, meta):
    want = build_blog_ld(meta)
    found = BLOG_LD_RE.search(html)
    if found and found.group(0) == want:
        return html, False
    html = BLOG_LD_RE.sub('', html)
    html = re.sub(r'\n[ \t]*\n(</head>)', r'\n\1', html, count=1)
    return html.replace('</head>', want + '\n</head>', 1), True


def patch(html: str):
    """Return (new_html, [changes applied])."""
    changes = []

    def sub(anchor, replacement, needle, label):
        nonlocal html
        if needle in html or anchor not in html:
            return
        html = html.replace(anchor, replacement, 1)
        changes.append(label)

    sub(CSS_ANCHOR, CSS_ANCHOR + CSS_LINK, '/components.css', 'components.css link')
    sub(JS_ANCHOR, JS_ANCHOR + JS_TAG, '/components.js', 'components.js tag')
    sub('<body>\n', '<body>\n' + GLOW + '\n', 'cursor-glow', 'cursor glow')
    sub(NAV_SKILLS, NAV_EDU, '<li><a href="/#education"', 'Education (nav)')
    sub(MENU_SKILLS, MENU_EDU, '    <a href="/#education"', 'Education (menu)')
    sub(NAV_BLOG, NAV_LAB, '<li><a href="/lab/"', 'Lab (nav)')
    sub(MENU_BLOG, MENU_LAB, '    <a href="/lab/"', 'Lab (menu)')
    sub(THEME_ANCHOR, LANG_BLOCK, 'class="lang-toggle"', 'lang toggle + cmdk hint')
    sub(SPRITE_ANCHOR, SPRITE_ICON + SPRITE_ANCHOR, '<symbol id="i-chart"', 'chart icon')
    sub('</footer>', '</footer>\n\n' + CMDK_OVERLAY + '\n', 'id="cmdk-overlay"', 'cmdk overlay')
    return html, changes


def missing(html: str):
    return [name for name, needle in CHECKS.items() if needle not in html]


# ---------------------------------------------------------------- template
SKELETON = '''
    <p class="lead">مقدمه‌ی کوتاه: مسئله چیست و خواننده در پایان این نوشته به چه جوابی می‌رسد.</p>

    <h2>بخش اول</h2>
    <p>متن بخش. برای اشاره به یک اصطلاح می‌توانید از <span data-tip="توضیح کوتاه اصطلاح"> tooltip </span> استفاده کنید.</p>

    <h3>زیربخش</h3>
    <p>بلوک‌های کد خودکار شماره‌خط، هایلایت و دکمه‌ی کپی می‌گیرند:</p>
    <pre dir="ltr" data-lang="EXCEL">=SUMIF($H$2:$H$6, H2, $C$2:$C$6) / SUM($C$2:$C$6)</pre>

    <h2>بخش دوم</h2>
    <div class="callout">
      <span class="callout-ic">i</span>
      <div><strong>نکته:</strong> این یک جعبه‌ی توجه است.</div>
    </div>

    <div class="tabs" data-single>
      <div class="tab-list" role="tablist">
        <button class="tab" data-tab="a" aria-selected="true">زبانه‌ی اول</button>
        <button class="tab" data-tab="b" aria-selected="false">زبانه‌ی دوم</button>
      </div>
      <div class="tab-panel is-active" data-panel="a"><p>محتوای زبانه‌ی اول.</p></div>
      <div class="tab-panel" data-panel="b"><p>محتوای زبانه‌ی دوم.</p></div>
    </div>

    <div class="accordion" data-single>
      <div class="acc-item">
        <button class="acc-head">سؤال پرتکرار؟ <svg class="chev" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="acc-body"><div>پاسخ کوتاه و مفید.</div></div>
      </div>
    </div>

    <h2>جمع‌بندی</h2>
    <p>خلاصه‌ی سه‌خطی + قدم بعدی برای خواننده.</p>
'''


def build_template():
    """Derive tools/post-template.html from a real, already-synced post."""
    if not REF_POST.exists():
        print(f"reference post not found: {REF_POST}")
        return 1
    html = REF_POST.read_text(encoding='utf-8')
    gaps = missing(html)
    if gaps:
        print("reference post is not synced yet; run sync first. missing: " + ", ".join(gaps))
        return 1

    def rep(pattern, repl, flags=re.S):
        nonlocal html
        html = re.sub(pattern, lambda _m: repl, html, count=1, flags=flags)

    rep(r'<title>.*?</title>', '<title>{{TITLE}} | مهدی عسکری</title>')
    rep(r'<meta name="description" content="[^"]*"',
        '<meta name="description" content="{{DESCRIPTION}}"')
    rep(r'<meta property="og:title" content="[^"]*"',
        '<meta property="og:title" content="{{TITLE}}"')
    rep(r'<meta property="og:description" content="[^"]*"',
        '<meta property="og:description" content="{{DESCRIPTION}}"')
    rep(r'<meta property="article:published_time" content="[^"]*"',
        '<meta property="article:published_time" content="{{DATE_ISO}}"')
    html = html.replace('https://mehdiaskari.ir/blog/weight-factor-excel-msp/',
                        'https://mehdiaskari.ir/blog/{{SLUG}}/')
    rep(r'<div class="post-meta">.*?</div>',
        '<div class="post-meta"><span class="pdate">{{DATE_FA}}</span>'
        '<span class="badge teal">برچسب ۱</span><span class="badge teal">برچسب ۲</span></div>')
    rep(r'<h1>.*?</h1>', '<h1>{{TITLE}}</h1>')
    html = html.replace('data-cover="weight-factor-excel-msp"', 'data-cover="{{SLUG}}"')
    rep(r'<article class="prose[^"]*">.*?</article>',
        '<article class="prose fu d1">' + SKELETON + '  </article>')

    TEMPLATE.write_text(html, encoding='utf-8')
    print(f"wrote {TEMPLATE.relative_to(ROOT)}")
    return 0


def add_post(slug: str):
    target = BLOG / slug / "index.html"
    if target.exists():
        print(f"already exists: {target.relative_to(ROOT)}")
        return 1
    if not TEMPLATE.exists():
        print("no tools/post-template.html — run: python3 tools/sync-post-ui.py --template")
        return 1
    html = (TEMPLATE.read_text(encoding='utf-8')
            .replace('{{SLUG}}', slug)
            .replace('{{TITLE}}', 'عنوان نوشته')
            .replace('{{DESCRIPTION}}', 'توضیح کوتاه نوشته (برای متا، RSS و کارت وبلاگ).')
            .replace('{{DATE_ISO}}', __import__('datetime').date.today().isoformat())
            .replace('{{DATE_FA}}', 'تاریخ'))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding='utf-8')
    print(f"created {target.relative_to(ROOT)}")
    print("next steps:")
    print(f"  1. write the content in {target.relative_to(ROOT)}")
    print("  2. add the post to posts.json (title, slug, date, tags, excerpt)")
    print("  3. python3 tools/sync-post-ui.py --check   # confirm it is on the baseline")
    return 0


def main():
    args = sys.argv[1:]
    if args and args[0] == '--template':
        return build_template()
    if args and args[0] == '--add':
        if len(args) < 2:
            print("usage: sync-post-ui.py --add <slug>")
            return 1
        return add_post(args[1])

    check_only = '--check' in args
    posts = sorted(p for p in BLOG.glob('*/index.html') if p.parent.name != 'all')
    if not posts:
        print('no posts found')
        return 1

    meta = load_posts()
    touched = 0
    for path in posts:
        rel = path.relative_to(ROOT)
        slug = path.parent.name
        original = path.read_text(encoding='utf-8')
        updated, changes = patch(original)
        updated, soc_changed = refresh_social(updated, slug, meta)
        if soc_changed:
            changes.append('social meta')
        updated, ld_changed = refresh_ld(updated, slug, meta, path)
        if ld_changed:
            changes.append('JSON-LD')
        if slug not in meta:
            print(f"warn     {rel}  — not declared in posts.json, schema skipped")
        if not changes:
            print(f"ok       {rel}")
            continue
        touched += 1
        print(f"{'check' if check_only else 'patch '}     {rel}  -> {', '.join(changes)}")
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    # the archive page carries a Blog schema that lists every declared post
    archive_dirty = False
    if ARCHIVE.exists() and meta:
        a_original = ARCHIVE.read_text(encoding='utf-8')
        a_updated, archive_dirty = refresh_blog_ld(a_original, meta)
        if archive_dirty:
            print(f"{'check' if check_only else 'patch '}     "
                  f"{ARCHIVE.relative_to(ROOT)}  -> Blog schema")
            if not check_only:
                ARCHIVE.write_text(a_updated, encoding='utf-8')

    print(f"\n{touched}/{len(posts)} post(s) "
          f"{'need patching' if check_only else 'updated'}.")
    if ARCHIVE.exists():
        print("archive: " + ("Blog schema needs refreshing" if archive_dirty
                             else "Blog schema up to date"))
    # In --check mode a dirty baseline is a failure, so CI can gate on it.
    return 1 if (check_only and (touched or archive_dirty)) else 0


if __name__ == '__main__':
    sys.exit(main())

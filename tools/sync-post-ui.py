#!/usr/bin/env python3
"""
sync-post-ui.py — keep every blog post on the shared modern UI baseline.

All the behaviour lives in /components.css + /components.js, so a post only has
to carry the two tags plus the shared header markup. This script makes that true
for every post under blog/, and it is idempotent — run it as often as you like.

Usage:
    python3 tools/sync-post-ui.py                 # patch every existing post
    python3 tools/sync-post-ui.py --check         # report only, write nothing
    python3 tools/sync-post-ui.py --add <slug>    # create a new post from the template
    python3 tools/sync-post-ui.py --template      # rebuild tools/post-template.html
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "blog"
TOOLS = ROOT / "tools"
TEMPLATE = TOOLS / "post-template.html"
REF_POST = BLOG / "weight-factor-excel-msp" / "index.html"

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
    'lang toggle': 'class="lang-toggle"',
    'cmdk hint': 'class="cmdk-hint"',
    'cmdk overlay': 'id="cmdk-overlay"',
}


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
    sub(THEME_ANCHOR, LANG_BLOCK, 'class="lang-toggle"', 'lang toggle + cmdk hint')
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

    touched = 0
    for path in posts:
        rel = path.relative_to(ROOT)
        original = path.read_text(encoding='utf-8')
        gaps = missing(original)
        if not gaps:
            print(f"ok       {rel}")
            continue
        updated, changes = patch(original)
        touched += 1
        print(f"{'check' if check_only else 'patch '}     {rel}  -> {', '.join(changes)}")
        if not check_only:
            path.write_text(updated, encoding='utf-8')

    print(f"\n{touched}/{len(posts)} post(s) "
          f"{'need patching' if check_only else 'updated'}.")
    return 0


if __name__ == '__main__':
    sys.exit(main())

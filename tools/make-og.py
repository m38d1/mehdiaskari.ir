#!/usr/bin/env python3
"""Generate the per-post Open Graph cards (1200x630 PNG).

Every post, the hub and the lab landing page get their own social card,
rendered from posts.json in the site's own dark/teal visual language:

    python3 tools/make-og.py                 # all cards
    python3 tools/make-og.py --only my-slug  # one card
    python3 tools/make-og.py --html-only     # just write the card HTML

Rendering needs one macOS-only dev step: tools/og-render.swift is compiled to
a tiny WKWebView screenshotter (no npm, no bundler — the site itself still has
no build step) and pointed at a local http.server serving the repo root, so
the real Vazirmatn woff2 files load and Persian shaping goes through WebKit's
text engine. Output lands in /og/<slug>.png and is committed as a static
asset; CI never runs this script.

After adding a post: python3 tools/make-og.py --only <slug>, commit the PNG,
then re-run sync-post-ui.py so the og:image URL follows the slug.
"""
import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://mehdiaskari.ir'
OUT_DIR = os.path.join(ROOT, 'og')
CARD_DIR = os.path.join(ROOT, 'tools', 'og-cards')
BIN = os.path.join(ROOT, '.og-build', 'og-render')
SWIFT = os.path.join(ROOT, 'tools', 'og-render.swift')

W, H = 1200, 630

# Cards that are not posts. Same layout, hand-written copy.
STATIC_CARDS = {
    'project-controls': {
        'title': 'مرکز کنترل پروژه',
        'title_en': 'Project Controls Hub — learning path, posts and tools',
        'tags': ['Primavera P6', 'MS Project', 'Power BI', 'EVM'],
        'kicker': 'مسیر یادگیری',
        'url': 'mehdiaskari.ir/project-controls',
    },
    'lab': {
        'title': 'آزمایشگاه کنترل پروژه',
        'title_en': 'The Lab — interactive project controls tools, in the browser',
        'tags': ['EVM', 'ضریب وزنی', 'P6', 'Progress'],
        'kicker': 'ابزار تعاملی',
        'url': 'mehdiaskari.ir/lab',
    },
    'lab-evm': {
        'title': 'داشبورد EVM — CPI، SPI، EAC و منحنی S',
        'title_en': 'Earned value dashboard — CV, SV, CPI, SPI, EAC, TCPI and the S-curve',
        'tags': ['EVM', 'CPI / SPI', 'EAC', 'S-Curve'],
        'kicker': 'ابزار تعاملی',
        'url': 'mehdiaskari.ir/lab/evm',
    },
    'lab-weight-factor': {
        'title': 'ماشین‌حساب ضریب وزن (W.F) — سهم از والد و سهم از کل',
        'title_en': 'Weight factor and weighted progress for a WBS — in the browser',
        'tags': ['WBS', 'ضریب وزنی', 'Weighted %', 'P6'],
        'kicker': 'ابزار تعاملی',
        'url': 'mehdiaskari.ir/lab/weight-factor',
    },
}

TEMPLATE = """<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../../fonts/fonts.css">
<style>
  *{{box-sizing:border-box; margin:0; padding:0}}
  html,body{{width:{w}px; height:{h}px; overflow:hidden}}
  body{{
    font-family:'Vazirmatn',sans-serif;
    color:#e8edf5;
    background:#0a0c10;
    background-image:
      radial-gradient(ellipse 760px 460px at 88% -8%, rgba(45,212,191,.20), transparent 62%),
      radial-gradient(ellipse 640px 420px at 6% 110%, rgba(96,165,250,.14), transparent 60%),
      radial-gradient(ellipse 520px 360px at 100% 108%, rgba(251,191,36,.10), transparent 62%),
      radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px);
    background-size:auto,auto,auto,26px 26px;
    position:relative;
  }}
  .bar{{position:absolute; inset-inline:0; top:0; height:4px;
    background:linear-gradient(90deg,#2dd4bf,#60a5fa,#fbbf24)}}
  .card{{position:absolute; inset:4px 0 0 0; display:flex; flex-direction:column;
    padding:56px 64px 46px; gap:24px}}
  header{{display:flex; align-items:center; justify-content:space-between; gap:24px}}
  .brand{{display:inline-flex; align-items:center; gap:10px;
    border:1px solid rgba(255,255,255,.14); border-radius:99px;
    padding:9px 18px; background:rgba(255,255,255,.035);
    font-family:'IBM Plex Mono',monospace; font-size:17px; color:#a9b6c8; direction:ltr}}
  .brand i{{width:8px; height:8px; border-radius:50%; background:#2dd4bf;
    box-shadow:0 0 12px rgba(45,212,191,.9); display:inline-block}}
  .crumb{{font-size:19px; color:#8b98ad}}
  .crumb b{{color:#c8d4e4; font-weight:600}}
  main{{flex:1; display:flex; flex-direction:column; justify-content:center; gap:16px}}
  h1{{font-size:{fs}px; line-height:1.42; font-weight:800; letter-spacing:-.01em;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3;
    overflow:hidden; text-wrap:balance}}
  .pill{{align-self:flex-start; font-size:17px; font-weight:600; color:#2dd4bf;
    border:1px solid rgba(45,212,191,.42); background:rgba(45,212,191,.10);
    border-radius:99px; padding:6px 16px; margin-bottom:6px}}
  .en{{font-size:21px; color:#8b98ad; direction:ltr; text-align:right;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis}}
  footer{{display:flex; align-items:flex-end; justify-content:space-between; gap:28px;
    border-top:1px solid rgba(255,255,255,.075); padding-top:22px}}
  .tags{{display:flex; flex-wrap:wrap; gap:10px; max-width:760px}}
  .tag{{font-size:17px; padding:7px 15px; border-radius:99px; font-weight:500}}
  .tag:nth-child(3n+1){{color:#5eead4; border:1px solid rgba(45,212,191,.36); background:rgba(45,212,191,.08)}}
  .tag:nth-child(3n+2){{color:#93c5fd; border:1px solid rgba(96,165,250,.36); background:rgba(96,165,250,.08)}}
  .tag:nth-child(3n+3){{color:#fcd34d; border:1px solid rgba(251,191,36,.36); background:rgba(251,191,36,.08)}}
  .who{{text-align:left; flex:none}}
  .who b{{display:block; font-size:21px; font-weight:700}}
  .who small{{display:block; font-size:15px; color:#8b98ad; margin-top:3px}}
  .url{{font-family:'IBM Plex Mono',monospace; font-size:15px; color:#647084;
    direction:ltr; margin-top:4px}}
</style>
</head>
<body>
  <div class="bar"></div>
  <div class="card">
    <header>
      <span class="brand"><i></i>{url}</span>
      <span class="crumb">{kicker}{date}</span>
    </header>
    <main>
      {pill}
      <h1>{title}</h1>
      <p class="en">{title_en}</p>
    </main>
    <footer>
      <div class="tags">{tags}</div>
      <div class="who"><b>مهدی عسکری</b><small>برنامه‌ریزی و کنترل پروژه</small>
        <div class="url">mehdiaskari.ir</div></div>
    </footer>
  </div>
</body>
</html>
"""


def title_size(title):
    n = len(title)
    if n <= 42:
        return 68
    if n <= 62:
        return 60
    if n <= 84:
        return 53
    if n <= 112:
        return 46
    return 41


def card_html(slug):
    posts = load_posts()
    spec = STATIC_CARDS.get(slug)
    if spec is None:
        post = posts.get(slug)
        if not post:
            raise SystemExit('unknown card: ' + slug)
        tags = [escape(t) for t in (post.get('tags') or [])[:4]]
        spec = {
            'title': post.get('title') or slug,
            'title_en': post.get('titleEn') or '',
            'tags': tags,
            'kicker': 'یادداشت',
            'date': ' · ' + (post.get('dateFa') or ''),
            'url': 'mehdiaskari.ir/blog',
            'pill': '',
        }
    else:
        spec.setdefault('kicker', '')
        spec.setdefault('date', '')
        spec.setdefault('pill', '')
    tags = ''.join('<span class="tag">%s</span>' % escape(t) for t in spec['tags'])
    pill = ('<span class="pill">%s</span>' % escape(spec['pill'])) if spec.get('pill') else ''
    return TEMPLATE.format(
        w=W, h=H,
        title=escape(spec['title']),
        title_en=escape(spec.get('title_en') or ''),
        fs=title_size(spec['title']),
        kicker=escape(spec.get('kicker') or ''),
        date=escape(spec.get('date') or ''),
        pill=pill,
        tags=tags,
        url=escape(spec.get('url') or 'mehdiaskari.ir'),
    )


def load_posts():
    with open(os.path.join(ROOT, 'posts.json'), encoding='utf-8') as f:
        data = json.load(f)
    return {p['slug']: p for p in data.get('posts', []) if p.get('slug')}


def escape(text):
    return html.escape(str(text), quote=True)


def ensure_renderer():
    if os.path.exists(BIN) and os.path.getmtime(BIN) > os.path.getmtime(SWIFT):
        return BIN
    os.makedirs(os.path.dirname(BIN), exist_ok=True)
    print('compiling og-render.swift …')
    try:
        subprocess.run(['swiftc', '-O', SWIFT, '-o', BIN], check=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        raise SystemExit('swiftc failed (%s) — macOS + Xcode CLT required' % e)
    return BIN


def render(slug, base):
    out = os.path.join(OUT_DIR, slug + '.png')
    url = base.rstrip('/') + '/tools/og-cards/' + slug + '.html'
    bin_ = ensure_renderer()
    subprocess.run([bin_, url, str(W), str(H), out], check=True)
    # WKWebView snapshots at the screen's 2x scale; Open Graph wants 1200x630.
    subprocess.run(['sips', '-z', str(H), str(W), out], check=True, capture_output=True)
    dims = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', out],
                          capture_output=True, text=True).stdout
    if 'pixelWidth: %d' % W not in dims or 'pixelHeight: %d' % H not in dims:
        raise SystemExit('rendered size mismatch for %s:\n%s' % (slug, dims))
    print('  og/%s.png  %d×%d' % (slug, W, H))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', action='append', default=[], help='slug (repeatable)')
    ap.add_argument('--base', default='http://localhost:8791',
                    help='local http.server root that serves the repo')
    ap.add_argument('--html-only', action='store_true')
    ap.add_argument('--keep-html', action='store_true')
    args = ap.parse_args()

    posts = load_posts()
    slugs = args.only or list(posts.keys()) + list(STATIC_CARDS.keys())

    os.makedirs(CARD_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    for slug in slugs:
        with open(os.path.join(CARD_DIR, slug + '.html'), 'w', encoding='utf-8') as f:
            f.write(card_html(slug))
    print('wrote %d card(s) -> tools/og-cards/' % len(slugs))

    if args.html_only:
        return

    # the renderer fetches over http, so the server has to be up
    try:
        urllib.request.urlopen(args.base.rstrip('/') + '/posts.json', timeout=3)
    except Exception:
        raise SystemExit('no server at %s — run: python3 -m http.server 8791' % args.base)

    for slug in slugs:
        render(slug, args.base)

    if not args.keep_html:
        shutil.rmtree(CARD_DIR, ignore_errors=True)
    print('done — %d PNG(s) in og/' % len(slugs))


if __name__ == '__main__':
    sys.exit(main())

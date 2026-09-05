#!/usr/bin/env python3
"""
make-lab-page.py — build an interactive tool page under /lab/ from the same
skeleton the blog uses, so the header, theme toggle, language toggle and
command palette can never drift from the rest of the site.

The page body comes from a "main part" file (everything between <main> and
</main>), which keeps the shared chrome machine-generated and the tool markup
hand-written.

Usage:
    python3 tools/make-lab-page.py weight-factor \
        --title "ماشین‌حساب ضریب وزن (W.F)" \
        --description "توضیح متا" \
        --main lab/weight-factor/_main.part

Re-running overwrites the page (idempotent for the chrome, the main part is
re-read each time).
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "tools" / "post-template.html"

CSS_ANCHOR = '<link rel="stylesheet" href="/components.css">'
JS_ANCHOR = '  <script src="/components.js" defer></script>'
COVER_JS = '<script src="/cover.js" defer></script>'
PUBLISHED = '<meta property="article:published_time" content="{{DATE_ISO}}">'

JSONLD = """<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "{title}",
  "url": "https://mehdiaskari.ir/lab/{slug}/",
  "description": "{desc}",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Any",
  "inLanguage": "fa",
  "browserRequirements": "Requires JavaScript",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "IRR" },
  "isPartOf": { "@type": "WebSite", "name": "Mehdi Askari", "url": "https://mehdiaskari.ir/" },
  "about": { "@type": "Article", "name": "محاسبه ضریب وزن (W.F) و پیشرفت وزنی",
             "url": "https://mehdiaskari.ir/blog/weight-factor-excel-msp/" }
}
</script>"""


def build(slug, title, description, main_path):
    tpl = TEMPLATE.read_text(encoding='utf-8')
    main = Path(main_path).read_text(encoding='utf-8').strip()

    head = tpl.split('<main>')[0]
    tail = '<footer' + tpl.split('<footer')[1]

    head = head.replace('https://mehdiaskari.ir/blog/{{SLUG}}/', f'https://mehdiaskari.ir/lab/{slug}/')
    head = head.replace('{{TITLE}}', title).replace('{{DESCRIPTION}}', description)
    head = head.replace('<meta property="og:type" content="article">',
                        '<meta property="og:type" content="website">')
    head = head.replace(PUBLISHED, '')
    head = head.replace(COVER_JS + '\n', '')

    if CSS_ANCHOR not in head or JS_ANCHOR not in head:
        sys.exit('template anchors changed — update tools/make-lab-page.py')

    head = head.replace(CSS_ANCHOR, CSS_ANCHOR + '\n  <link rel="stylesheet" href="/lab/lab.css">')
    scripts = (JS_ANCHOR +
               f'\n  <script src="/lab/wf-engine.js" defer></script>' +
               f'\n  <script src="/lab/{slug}/app.js" defer></script>')
    head = head.replace(JS_ANCHOR, scripts)

    ld = (JSONLD.replace('{title}', title)
                  .replace('{slug}', slug)
                  .replace('{desc}', description))
    head = head.replace('</head>', '  ' + ld + '\n</head>')

    out = head + main + '\n\n' + tail
    dest = ROOT / 'lab' / slug / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding='utf-8')
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--title', required=True)
    ap.add_argument('--description', required=True)
    ap.add_argument('--main', required=True)
    a = ap.parse_args()
    dest = build(a.slug, a.title, a.description, a.main)
    print(f'wrote {dest.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

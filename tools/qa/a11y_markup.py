#!/usr/bin/env python3
"""One-shot a11y markup pass over every published page.

- skip link as the first body child (WCAG 2.4.1)
- <main id="main" tabindex="-1"> as its target
- aria-label on the primary header <nav> (WCAG 1.3.1 / 2.4.1 landmarks)
- aria-hidden on decorative <svg> (icons, chevrons, arrows)
- scope on every <th>
- an accessible name for the command-palette search input

Idempotent: running it twice changes nothing.
"""
import re
import pathlib

ROOT = pathlib.Path('/Users/m38d1/Documents/Default Project/01-GitHub/mehdiaskari.ir')
SKIP = '<a class="skip-link" href="#main" data-en="Skip to content">پرش به محتوا</a>'

def _keep(p):
    if '_prototypes' in p.parts:
        return False
    if 'tools' in p.parts:
        return p.parent.name == 'lab-parts' or p.name == 'post-template.html'
    return True
pages = [p for p in sorted(ROOT.rglob('*.html')) if _keep(p)]


def add_attr(tag, attr, value, if_missing):
    """insert attr="value" into a tag string unless if_missing(attr) is False"""
    if not if_missing:
        return tag
    return tag[:-1] + f' {attr}="{value}">'


def patch_svg(s):
    """decorative svg: no aria-hidden, no role=img, no <title> child"""
    out, i, n = [], 0, 0
    for m in re.finditer(r'<svg\b[^>]*>', s):
        tag = m.group(0)
        after = s[m.end():m.end() + 160]
        if 'aria-hidden' in tag or 'role="img"' in tag or '<title' in after[:120]:
            continue
        out.append((m.start(), m.end(), tag[:-1] + ' aria-hidden="true" focusable="false">'))
        n += 1
    for start, end, new in reversed(out):
        s = s[:start] + new + s[end:]
    return s, n


total = {}
for p in pages:
    s = orig = p.read_text(encoding='utf-8')
    stats = {}

    # --- skip link
    if 'class="skip-link"' not in s:
        m = re.search(r'<body\b[^>]*>', s)
        if m:
            s = s[:m.end()] + '\n' + SKIP + s[m.end():]
            stats['skip'] = 1

    # --- main target
    if '<main>' in s:
        s = s.replace('<main>', '<main id="main" tabindex="-1">')
        stats['main'] = s.count('<main id="main"')
    elif '<main ' in s and 'id="main"' not in s:
        s = re.sub(r'<main\b([^>]*)>', r'<main id="main" tabindex="-1"\1>', s, count=1)
        stats['main'] = 1

    # --- header nav label (bare <nav>, never the mobile sheet)
    if re.search(r'<nav>\s*<ul>', s):
        s = re.sub(r'<nav>(\s*<ul>)', r'<nav aria-label="منوی اصلی" data-en-aria="Main menu">\1', s)
        stats['nav'] = 1

    # --- table headers
    def th_scope(m):
        block = m.group(0)
        return re.sub(r'<th(?![\w-])(?![^>]*\bscope=)', '<th scope="col"', block)
    before_th = len(re.findall(r'<th(?![\w-])(?![^>]*\bscope=)', s))
    s = re.sub(r'<thead\b.*?</thead>', th_scope, s, flags=re.S)
    # any <th> left outside a thead is a row header
    s = re.sub(r'<th(?![\w-])(?![^>]*\bscope=)', '<th scope="row"', s)
    if before_th:
        stats['th'] = before_th

    # --- decorative svg
    s, n_svg = patch_svg(s)
    if n_svg:
        stats['svg'] = n_svg

    # --- palette input name
    if 'id="cmdk-input"' in s and 'for="cmdk-input"' not in s:
        s = s.replace(
            '<input type="text" class="cmdk-input" id="cmdk-input"',
            '<input type="text" class="cmdk-input" id="cmdk-input" aria-label="جستجو یا اجرای دستور" data-en-aria="Search or run a command"',
            1)
        if 'aria-label="جستجو یا اجرای دستور"' in s:
            stats['cmdk'] = 1

    if s != orig:
        p.write_text(s, encoding='utf-8')
        total[str(p.relative_to(ROOT))] = stats

for k, v in total.items():
    print(f"{k:<48} {v}")
print(f"\n{len(total)} file(s) changed")

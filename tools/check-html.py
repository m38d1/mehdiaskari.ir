#!/usr/bin/env python3
"""
check-html.py — fail if any HTML file has unbalanced tags.

Catches the classic hand-edit mistakes: a stray </button>, an unclosed <div>,
a self-closing tag that actually needs a close. Void elements are ignored.

Usage:
    python3 tools/check-html.py            # check every .html in the repo
    python3 tools/check-html.py index.html # check specific files
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Elements that never take a closing tag.
VOID = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr',
    # SVG shapes used inline in this project
    'path', 'circle', 'rect', 'line', 'use', 'stop', 'polygon', 'ellipse', 'polyline',
}
# Elements whose children we do not track (they close themselves in our markup).
SELF_CLOSING_CONTAINERS = {'svg', 'symbol', 'defs'}


class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        # <svg> ... </svg> is tracked, but its shape children are void above.
        self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass  # <br/> style — nothing to track

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        line = self.getpos()[0]
        if not self.stack:
            self.errors.append(f"line {line}: stray </{tag}>")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                t, ln = self.stack.pop()
                self.errors.append(f"line {ln}: <{t}> never closed (hit </{tag}> at line {line})")
            if self.stack:
                self.stack.pop()
        else:
            self.errors.append(f"line {line}: </{tag}> with no matching opener")


def check(path: Path):
    parser = Checker()
    parser.feed(path.read_text(encoding='utf-8'))
    parser.close()
    for tag, ln in parser.stack:
        if tag in SELF_CLOSING_CONTAINERS:
            continue
        parser.errors.append(f"line {ln}: <{tag}> left open at end of file")
    return parser.errors


CHROME = 'tools/post-template.html'

def check_collisions():
    """A tool page that queries document.querySelectorAll('[data-x]') unscoped
    will also match the shared header's own elements whenever the chrome happens
    to use the same attribute name. The EVM dashboard did exactly that with
    data-mode, which the theme switch owns -- clicking dark/light silently reset
    the tool's input shape. Nothing in the DOM warns you.
    """
    chrome = ROOT / CHROME
    if not chrome.exists():
        return []
    used = set(re.findall(r'\b(data-[a-z-]+)=', chrome.read_text(encoding='utf-8')))
    problems = []
    for js in sorted(ROOT.glob('lab/*/app.js')):
        src = js.read_text(encoding='utf-8')
        for attr in set(re.findall(r"document\.querySelectorAll\('\[(data-[a-z-]+)\]", src)):
            if attr in used:
                problems.append(f"{js.relative_to(ROOT)}: unscoped [{attr}] also matches the "
                                f"shared chrome in {CHROME} -- scope it to the tool's own panel")
    return problems


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if args:
        files = [Path(a).resolve() for a in args]
    else:
        files = sorted(p for p in ROOT.rglob('*.html') if '.git' not in p.parts)

    failed = 0
    for f in files:
        rel = f.relative_to(ROOT) if f.is_relative_to(ROOT) else f
        errs = check(f)
        if errs:
            failed += 1
            print(f"FAIL  {rel}")
            for e in errs[:12]:
                print(f"        {e}")
            if len(errs) > 12:
                print(f"        ... {len(errs) - 12} more")
        else:
            print(f"ok    {rel}")

    print(f"\n{len(files) - failed}/{len(files)} file(s) balanced.")
    collisions = check_collisions()
    for c in collisions:
        print(f'FAIL  {c}')
    if not collisions:
        print('ok    no tool selector collides with the shared chrome')
    return 1 if (failed or collisions) else 0


if __name__ == '__main__':
    sys.exit(main())

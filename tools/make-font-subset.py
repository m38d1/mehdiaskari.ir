#!/usr/bin/env python3
"""
make-font-subset.py — rebuild the site font subsets (the Oct 2026 slimming).

The shipped woff2 files are subsets: ASCII + Latin-1 + general punctuation +
the whole Arabic block + every codepoint the pages can render stay; the
supplementary-plane Arabic ranges and other dead glyphs go. Full Latin-1 and
the full Arabic block are kept on purpose so future Persian/English content
never hits a missing glyph.

Requires fonttools + brotli (not needed to build the site — only to re-subset):

    python3 -m venv /tmp/fontenv
    /tmp/fontenv/bin/pip install fonttools brotli
    /tmp/fontenv/bin/python3 tools/make-font-subset.py [source-dir]

source-dir holds the FULL upstream fonts named like fonts/README.md
(Vazirmatn variable + IBM Plex 400/600). With no source-dir the script just
re-subsets what is already in fonts/ (idempotent) and prints the sizes.

After any change to fonts/*.woff2 bump the CACHE version in sw.js.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PYFT = 'pyftsubset'  # resolved from PATH / the venv the script runs in

def site_chars():
    used = set()
    for p in ROOT.rglob('*'):
        if '.git' in p.parts or '_prototypes' in p.parts or 'tools/qa' in str(p):
            continue
        if p.suffix in {'.html', '.js', '.json'} and not p.name.endswith('.part.html'):
            try:
                used |= set(p.read_text(encoding='utf-8'))
            except Exception:
                pass
    return {c for c in used if ord(c) >= 0x20}

R = range

LATIN_SAFETY = set(R(0x20, 0xFF)) | {0x131, 0x152, 0x153, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC} \
    | set(R(0x2000, 0x206F)) | {0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xFEFF, 0xFFFD}
ARABIC_SAFETY = set(R(0x600, 0x6FF)) | set(R(0x750, 0x77F)) | set(R(0xFB50, 0xFDFF)) \
    | set(R(0xFE70, 0xFEFC)) | {0x200C, 0x200D, 0x200E, 0x200F, 0x2010, 0x2011, 0x204F, 0x2E41}

ARABIC_FEATURES = 'kern,liga,rlig,ccmp,init,medi,fina,isol,mark,mkmk'
LATIN_FEATURES = 'kern,liga'

FACES = {
    'vazirmatn-arabic': ARABIC_SAFETY,
    'vazirmatn-latin': LATIN_SAFETY,
    'ibm-plex-mono-400': LATIN_SAFETY,
    'ibm-plex-mono-600': LATIN_SAFETY,
}

def main():
    src_dir = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
    site = site_chars()
    syms = {ord(c) for c in site if 0x2100 <= ord(c) <= 0x2BFF}
    total_before = total_after = 0
    for name, safety in FACES.items():
        # site chars inside the arabic ranges may reach anywhere in persian
        # text; anything else (incl. basic latin) belongs to the latin face.
        # keep full parity with the original Google subset: basic latin lives
        # in BOTH faces so mixed fa/en runs never hit a fallback mid-word.
        in_arabic = {ord(c) for c in site if ord(c) <= 0xFFFF and (
            0x600 <= ord(c) <= 0x8FF or 0xFB50 <= ord(c) <= 0xFEFC)}
        chars = (safety | syms | in_arabic | set(R(0x20, 0x7E))) if name.startswith('vazirmatn-arabic') else (safety | syms)
        feats = ARABIC_FEATURES if name.startswith('vazirmatn-arabic') else LATIN_FEATURES
        src = (src_dir or ROOT / 'fonts') / f'{name}.woff2'
        dst = ROOT / 'fonts' / f'{name}.woff2'
        tmp = dst.with_suffix('.tmp.woff2')
        before = dst.stat().st_size if dst.exists() else 0
        text = ''.join(chr(c) for c in sorted(chars) if c <= 0xFFFF)
        subprocess.run([PYFT, str(src), f'--text={text}',
                        f'--output-file={tmp}', '--flavor=woff2',
                        f'--layout-features={feats}', '--desubroutinize'], check=True)
        tmp.replace(dst)
        after = dst.stat().st_size
        total_before += before
        total_after += after
        print(f'{name}: {before/1024:.1f}KB -> {after/1024:.1f}KB')
    print(f'total: {total_before/1024:.1f}KB -> {total_after/1024:.1f}KB')
    print('remember: bump CACHE in sw.js after replacing fonts/*.woff2')

if __name__ == '__main__':
    main()

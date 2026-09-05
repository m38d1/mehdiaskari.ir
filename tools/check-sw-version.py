#!/usr/bin/env python3
"""
check-sw-version.py — remind you to bump the service-worker cache version.

/components.css, /components.js, /blog.css, /cover.js, /posts.json and the
precached shell are served cache-first by sw.js. Editing them without bumping
`CACHE` in sw.js means returning visitors keep the old copy. This step fails
when a watched file changed but sw.js did not.

Usage:
    python3 tools/check-sw-version.py [base-ref]   # base defaults to CI auto-detect
"""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files served cache-first (or precached) by sw.js.
WATCHED = {
    'components.css',
    'components.js',
    'blog.css',
    'cover.js',
    'index.html',
    'posts.json',
    'manifest.webmanifest',
    'icon.svg',
}
SW = 'sw.js'


def git(*args):
    try:
        out = subprocess.run(('git',) + args, cwd=ROOT, capture_output=True, text=True)
        return out.stdout.strip() if out.returncode == 0 else None
    except OSError:
        return None


def detect_base():
    base_ref = os.environ.get('GITHUB_BASE_REF')
    if base_ref:
        cand = f"origin/{base_ref}"
        if git('rev-parse', '--verify', '--quiet', cand) or git('merge-base', cand, 'HEAD'):
            return cand
    head = git('rev-parse', '--verify', '--quiet', 'HEAD')
    if not head:
        return None
    parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split()
    return parents[1] if len(parents) > 1 else None


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else detect_base()
    if not base:
        print("SKIP    no comparable base revision (shallow history or first commit)")
        return 0
    if git('merge-base', base, 'HEAD') is None:
        print(f"SKIP    {base} is not an ancestor of HEAD (shallow clone?)")
        return 0

    changed = {line.strip() for line in (git('diff', '--name-only', base, 'HEAD') or '').splitlines() if line.strip()}
    touched = sorted(p for p in changed
                     if p in WATCHED or p.startswith('fonts/'))

    if not touched:
        print(f"ok      no cache-sensitive files changed ({len(changed)} file(s) in diff)")
        return 0

    if SW in changed:
        print(f"ok      {len(touched)} cache-sensitive file(s) changed and {SW} was updated")
        return 0

    sw_text = (ROOT / SW).read_text(encoding='utf-8') if (ROOT / SW).exists() else ''
    version = re.search(r"const\s+CACHE\s*=\s*'([^']+)'", sw_text)
    print(f"FAIL    cache-sensitive file(s) changed but {SW} was not touched:")
    for p in touched:
        print(f"          - {p}")
    print(f"          current CACHE = {version.group(1) if version else 'unknown'}")
    print(f"          fix: bump CACHE in {SW} (e.g. ...-v(N+1)) so visitors drop the stale copy.")
    return 1


if __name__ == '__main__':
    sys.exit(main())

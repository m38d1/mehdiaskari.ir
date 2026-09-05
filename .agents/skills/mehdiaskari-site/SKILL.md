---
name: mehdiaskari-site
description: Conventions for the mehdiaskari.ir static site — pure HTML/CSS/vanilla JS, RTL Persian, shared component library, blog post and /lab/ tool workflows, service-worker cache bumps. Use when editing any file in this repo, adding a blog post or tool, or touching components.css, components.js, sw.js, posts.json or tools/.
---

## Non-negotiables

- No build step, no dependencies, no framework. Never add `package.json` or a bundler.
- Persian is the source language; English comes from `data-en` attributes swapped by `setLang()`.
- RTL-safe CSS only: `padding-inline-start`, `margin-inline-end`, `inset-inline-start`. Never `left`/`right`.
- Colour only from the `html[data-theme]` tokens: `--glass`, `--glass-2`, `--border`, `--border-soft`, `--text`, `--text-muted`, `--text-dim`, `--teal`, `--teal-2`, `--amber`, `--card-shadow`. Never hard-code a hex value into a new rule.

## Shared layer

`components.css` + `components.js` load on every page **after** `blog.css`, so their rules win.
Modules: tabs, accordion, dialog, code (copy + highlight + line numbers), reading bar, TOC,
reading time, counters, blog search, cursor glow, lang toggle, command palette. Each is
idempotent via a `__ready` / `__*Bound` guard and re-runs on injected nodes through a
`MutationObserver`.

`index.html` owns a richer inline palette and sets `window.__siteHasPalette = true` so the
shared lang/cmdk modules stand down there. Never remove that flag — it is what prevents
double bindings.

## Adding a blog post

```bash
python3 tools/sync-post-ui.py --add <slug>
```

Scaffolds the page on the shared baseline. Then register it in `posts.json` (all eight keys
required: `slug`, `title`, `titleEn`, `date`, `dateFa`, `excerpt`, `excerptEn`, `tags`) and add
the URL to `sitemap.xml`.

## Adding a tool under /lab/

```bash
python3 tools/make-lab-page.py <slug> --title "…" --description "…" \
    --main tools/lab-parts/<slug>.part.html
```

Only the `<main>` block in `tools/lab-parts/` is hand-written; the chrome is generated from
`tools/post-template.html` so headers cannot drift from the site. Use `--no-js --no-jsonld` for
the `/lab/` landing page (`slug = index`).

## Editing math

`lab/wf-engine.js` is dependency-free and loadable in Node. Change it only with
`node tools/test-wf-engine.js` green — those assertions **are** the worked examples published in
`/blog/weight-factor-excel-msp/`.

## Before every commit

```bash
python3 tools/sync-post-ui.py --check && python3 tools/check-html.py && \
python3 tools/check-posts.py && python3 tools/check-sw-version.py && \
node tools/test-wf-engine.js
```

CI (`.github/workflows/site-checks.yml`) runs the same set on every push and PR. It reports;
branch protection is not enabled, so it does not block.

## Service worker

Navigations are network-first; same-origin assets are cache-first. Bump `const CACHE` in `sw.js`
whenever `components.css`, `components.js`, `blog.css`, `cover.js`, `index.html`, `posts.json` or
anything under `fonts/` changes — `check-sw-version.py` fails the build otherwise. New pages and
assets also need a `PRECACHE` entry.

## Gotchas

- **GitHub Pages runs classic Jekyll** (there is no `.nojekyll`). `{{ … }}` in any published file
  is eaten as Liquid. That is why `tools/` is excluded via `_config.yml` and the post template
  lives there.
- Files and directories starting with `.` or `_` are skipped by Jekyll, so `.claude/`,
  `.agents/` and `tools/` are never published. Verify with a 404 after deploying.
- `blog/index.html` is only a redirect stub to `/blog/all/` — intentionally not patched.
- The home page's nav uses `href="#education"` (same-page fragment) while every other page uses
  `href="/#education"`. Anchors in `tools/sync-post-ui.py` assume the absolute form; do not run
  that patcher against `index.html`.
- **Never put Persian text in a search/replace anchor.** Persian normalises differently between
  an edit request and the file on disk, so the match silently fails. Anchor on ASCII substrings
  and put Persian only in what you insert.
- Anchor uniqueness matters: `rss.xml` appears both in a `<head>` `<link rel="alternate">` and in
  the visible footer link. Grep for the count before assuming an anchor is unique.

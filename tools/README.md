# Blog tooling

## Continuous integration

`.github/workflows/site-checks.yml` runs on every push to `main`, every pull
request, and manually. It is the thing that keeps the baseline from drifting:

| Step | Catches |
|---|---|
| `sync-post-ui.py --check` | a post missing the shared UI baseline |
| `check-html.py` | stray `</button>`, unclosed `<div>`, malformed hand edits |
| `check-posts.py` | a post page not registered in `posts.json` (or the reverse), empty fields, bad dates/slugs, wrong `canonical`/`og:url` |
| `check-sw-version.py` | editing `components.*` / `blog.css` / `cover.js` without bumping `CACHE` in `sw.js` — returning visitors would keep the stale copy |
| `node --check` | JS syntax errors in `components.js`, `cover.js`, `sw.js` |
| JSON parse | broken `posts.json` / `manifest.webmanifest` |

Run everything locally the same way CI does:

```bash
python3 tools/sync-post-ui.py --check && \
python3 tools/check-html.py && \
python3 tools/check-posts.py && \
python3 tools/check-sw-version.py
```

`--check` and the other checkers exit non-zero on a problem, so they gate CI.

## `sync-post-ui.py` — keep every post on the shared UI baseline

All modern UI behaviour (code copy + highlight + line numbers, reading progress
bar, table of contents, reading time, cursor glow, language switch, `Ctrl/Cmd+K`
command palette) lives in **`/components.css`** and **`/components.js`**.
A post only has to carry those two tags plus the shared header markup — this
script guarantees that for every post, and it is **idempotent** (safe to re-run).

```bash
python3 tools/sync-post-ui.py            # patch every post under blog/
python3 tools/sync-post-ui.py --check    # report what is missing, write nothing
python3 tools/sync-post-ui.py --template # rebuild tools/post-template.html
python3 tools/sync-post-ui.py --add my-new-post   # scaffold blog/my-new-post/
```

### Writing a new post

```bash
python3 tools/sync-post-ui.py --add my-new-post
# 1. edit blog/my-new-post/index.html  (title, meta, article body)
# 2. add the entry to posts.json       (title, slug, date, tags, excerpt)
# 3. python3 tools/sync-post-ui.py --check   # confirm the baseline
```

A post created with `--add` is on the baseline from the first commit — no manual
copying of header markup or script tags.

### Adding a component to every future post

1. Put the styles in `components.css` and the behaviour in `components.js`
   (guard each module with a `__ready` flag so re-runs are cheap).
2. If it needs markup, add it to `blog/weight-factor-excel-msp/index.html`
   (the reference post) and run `python3 tools/sync-post-ui.py --template`
   to refresh the template.
3. Run `python3 tools/sync-post-ui.py` to push it to existing posts.
4. Bump `CACHE` in `sw.js` so visitors get the new `components.*`.

### Notes

- `blog/index.html` is only a redirect stub to `/blog/all/` — intentionally not
  patched.
- The command palette on post/archive pages is driven by `components.js` and
  builds its entries from the current page's nav. The homepage keeps its own
  richer palette and sets `window.__siteHasPalette = true` so the shared module
  stands down there (no double bindings).
- `tools/post-template.html` is deliberately outside `blog/` so it is never
  published as a page.

## Interactive tools under `/lab/`

A lab page is generated from the same skeleton as a blog post, so its header,
theme toggle, language toggle and command palette cannot drift.

```bash
python3 tools/make-lab-page.py <slug> \
  --title "…" --description "…" \
  --main tools/lab-parts/<slug>.part.html
```

- `tools/lab-parts/<slug>.part.html` holds everything between `<main>` and
  `</main>` — the only hand-written part.
- `tools/make-lab-page.py` supplies the chrome, swaps `og:type` to `website`,
  drops the article-only `published_time` and cover script, adds `/lab/lab.css`,
  the engine + app scripts, and a `WebApplication` JSON-LD block.
- Shared styles: `lab/lab.css`. Shared math: `lab/wf-engine.js` (dependency-free,
  also loadable in Node).
- After regenerating: add the URL to `sitemap.xml` and `PRECACHE` in `sw.js`,
  then bump `CACHE`.

### `test-wf-engine.js` — the math is pinned to the article

`node tools/test-wf-engine.js` asserts the engine reproduces both worked
examples published in `/blog/weight-factor-excel-msp/` (W.F = 0.20/0.30/0.15/
0.25/0.10 and 41% weighted progress; W.F↑ = 0.30/0.20/0.50 with project weights
0.18/0.12/0.30), plus the structural guards: orphan parents, self-parenting,
cycles, all-zero basis, duplicate codes and headerless TSV. CI runs it, so a
change to `lab/wf-engine.js` that breaks the published numbers fails the build.

# Blog tooling

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

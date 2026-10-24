# tools/qa — measurement harness

Local-only QA tooling (never served, dev-only):

- `probe.swift` — WKWebView CLI: `swiftc probe.swift -o probe && ./probe <url> <w> <h> <js|-> [settle]`
- `audit4_dark.js` / `audit4_light.js` — contrast + structure + perf audit for one theme
- `audit4.js` — earlier combined audit
- `a11y_markup.py` — idempotent patcher: skip link, main#main, nav labels,
  th scope, svg aria-hidden, cmdk aria-label (run from anywhere; ROOT is absolute)
- `showstruct.py` — pretty-printer for audit output

Audit over HTTP (works in any automated Chromium too):

```sh
python3 -m http.server 8791            # repo root
# then in a browser console / evaluate:
#   eval(await (await fetch('/tools/qa/audit4_dark.js')).text())
```

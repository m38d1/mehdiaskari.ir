# Fonts

Self-hosted fonts used by mehdiaskari.ir — both licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org/), which permits
bundling and redistribution with websites and software.

- `vazirmatn-arabic.woff2`, `vazirmatn-latin.woff2`
  Vazirmatn variable font (weight 400–900), © The Vazirmatn Project Authors
  Source: https://github.com/rastikerdar/vazirmatn

- `ibm-plex-mono-400.woff2`, `ibm-plex-mono-600.woff2`
  IBM Plex Mono, © IBM Corp.
  Source: https://github.com/IBM/plex

Files originally served by Google Fonts; downloaded from
https://fonts.gstatic.com on 2026-09-01.

Every file above is a site subset (Oct 2026, 110KB -> 83KB total): ASCII +
Latin-1 + the Arabic block + everything the pages can render are kept;
supplementary-plane Arabic ranges and the never-used mono 500 face were
dropped. Regenerate with tools/make-font-subset.py (fonttools + brotli in a
venv); after any regeneration bump the sw.js cache version.

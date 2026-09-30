# openbiz-site

Static bilingual (Hebrew/English) website for [openbiz.co.il](https://openbiz.co.il), served by GitHub Pages.

- No build step: plain HTML + `assets/style.css`.
- Hebrew at `/`, English at `/en/`.
- Smoke test: `python3 tests/smoke.py`
- Local preview: `python3 -m http.server 8765`

# Testing evidence and limitations

Date: 2026-11-04

## Automated JavaScript checks

Run `node --test tests/*.test.js` from this folder using Node.js 20+.

**21 passing checks (13 original plus 8 additional parser/statistics checks):** baseline auditing, duplicate removal, median imputation, original source preservation, no-op preview, restricted identifier filling, categorical mode filling, CSV escaping and formula guard, original passport metrics, cleaned passport metrics, absence of raw records from exports, HTML escaping, empty dataset handling, and non-certification of AI readiness.

## Browser smoke check

Chromium was used to exercise an in-memory copy of the page (the test environment blocks direct `file://` navigation):

- Uploaded `demo.csv` and observed a valid dataset report.
- Original passport: completeness **90.0%** and uniqueness **83.3%**.
- Cleaning preview passport: completeness **92.0%** and uniqueness **100.0%**.
- Unchecking **Fill blanks** changed the cleaned completeness to **88.0%**, rechecking it restored **92.0%**.
- Downloaded JSON and HTML reports through browser controls.
- Page raised no JavaScript exceptions in these flows.
- At 390px mobile viewport, the document did not overflow horizontally.

## Not yet completed

- Manual keyboard screen-reader testing and independent real-browser screenshot review by the project owner.
- A systematic test matrix covering malformed CSVs, different encodings, empty records, huge/high-dimensional datasets, extremely large numeric values and cross-browser differences.
- Full end-to-end automated tests integrated into GitHub Actions.

Do not claim this project is production-ready, a certified privacy tool, or a trained AI system.

## v1.0.0 release verification

Ran `npm run check` successfully: **21 of 21 Node tests passed**. Additional cases cover quoted commas, escaped quotes, multiline CSV, CRLF, BOM, malformed quotes, exact-string duplicate semantics, numeric quartiles, inferred date/category/empty types and zero-IQR behavior.

Rendered the release in Chromium by injecting local HTML/CSS/JS into an in-memory page because direct `file://` navigation was blocked by the test environment. Tested at **1280px desktop** and **390px mobile** width:

- Clicked **Try a sample dataset** and verified 6 rows / 5 columns / 3 missing cells / 1 duplicate.
- Confirmed default cleaning: 5 rows, 2 missing cells, 0 duplicate rows.
- Switched Dataset Passport to the cleaning-preview version and confirmed 92% completeness.
- Downloaded cleaned CSV, Passport JSON, and printable HTML from actual browser controls.
- Confirmed exported JSON showed 5 rows and 2 missing cells and omitted individual names.
- No page errors or horizontal document overflow at the two tested viewport widths.
- Screenshots saved under `assets/`.

This is still a focused smoke test, not a complete security, cross-browser, accessibility or production readiness audit.

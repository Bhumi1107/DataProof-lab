# Changelog

## v1.0.0 — GitHub portfolio release (2026-11-04)

- Added an instant **Try a sample dataset** flow that works offline and on GitHub Pages.
- Improved keyboard focus styling, project footer and public-facing labeling.
- Added 8 parser/statistics tests, bringing the Node suite to **21 passing tests**.
- Added an automated GitHub Actions quality-check workflow, architecture notes, case study and publishing guide.
- Verified sample analysis, cleaning, Passport views, three download types and responsive 1280px/390px layouts in Chromium; saved real screenshots.
- Kept existing data-quality and report behavior; no backend or database added.

## Milestone 6 — Dataset Passport (2026-11-04)

- Added `passport.js`: aggregate-only passport containing original/cleaned metadata, column summaries, transparent severity-ranked findings and practical next steps.
- Added original versus simulated cleaning preview selector.
- Added JSON and offline print-friendly HTML reports; user rows are not included in either format.
- Added HTML escaping to prevent dataset-controlled strings from being interpreted as markup in the exported report.
- Added source-specific limitations, audit-method explanations, privacy notices and a small-sample warning.
- Added six Passport-specific automated tests; combined suite has 13 tests.
- Completed Chromium interaction smoke tests for upload, version switching, cleaning controls, report downloads and mobile layout.

## Milestone 5 — Data Cleaning Studio (2026-11-04)

- Added non-destructive duplicate-removal and median/mode-filling previews.
- Added before/after quality statistics and cleaned CSV export.
- Added tests for imputation and original-data preservation.

## Milestone 4 — Statistical Intelligence (2026-11-04)

- Added numeric profiling, IQR review and interactive distributions.

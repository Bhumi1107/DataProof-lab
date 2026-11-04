# Technical architecture

DataProof Lab is **static client-side software**; every analysis executes in the browser. There is no API backend, data upload endpoint, Python runtime, or database.

```text
CSV upload or built-in fictional sample
      │
      ▼
parser.js ──► array of rows (all values are initially strings)
      │
      ├── audit.js ──► missing cells, duplicate rows, uniqueness, completeness
      │
      ├── statistics.js ──► heuristic types, mean/median/quartiles, IQR outlier flags
      │
      ├── app.js ──► accessible text tables and compact distribution charts
      │
      ├── cleaning.js ──► copy of rows, duplicate removal, one-column imputation
      │                        └──► downloadable cleaned CSV, original preserved
      │
      └── passport.js ──► aggregate-only quality findings and next steps
                               └──► JSON report or standalone HTML report
```

## The processing pipeline

1. **Input validation**: reject non-CSV extensions, CSVs above 5 MiB, duplicate/blank headers and non-rectangular records.
2. **CSV parser**: strict quoted-field handling with quoted commas, escaped quotes and multiline fields. Records are not inferred as numeric during parsing.
3. **Profiling**: completeness = filled cells / all cells; exact duplicates compare original string cells.
4. **Statistical analysis**: type inference is heuristic. Quartiles use linear interpolation at index `(n-1)*p`; outliers use the 1.5×IQR fences only when at least four values exist and IQR is nonzero.
5. **Cleaning preview**: duplicate removal then median/mode imputation of at most one suitable column, performed on copied arrays; identifier-like columns are excluded from automatic imputation.
6. **Passport**: original or simulated rows are summarized into evidence-backed checks and aggregate numeric statistics; report exports omit row records.

## Important tradeoffs

- No backend means low operating cost and no file upload, but no persistent shared dataset, logins, or collaboration.
- Parsed CSVs occupy memory; a 5 MiB file may use much more RAM than 5 MiB during analysis. This is not a solution for huge datasets.
- Type inference may classify IDs as numbers; in the Passport, identifier-looking headers are excluded from outlier warning summaries.
- Exact row equality is not entity resolution: "Anaya" and " anaya " are different values.
- IQR flags are *not* data errors. Review context, measurement units and sources before cleaning.
- No target variable or model is trained; this project does **not** certify ML readiness.
- The Passport omits raw rows, but summary statistics, column names and file names may still be sensitive.

## Privacy and security

The current code has no external network calls or third-party analytics scripts. It does not store rows in `localStorage`. Downloads are generated with browser Blob URLs. CSVs downloaded for spreadsheet use protect against common formula prefixes where possible; this is not a guarantee against every spreadsheet interpretation.

Treat the project as an educational browser demonstration, not a controlled processing environment for regulated, medical or financial data.

# DataProof Lab — portfolio case study

## Problem

CSV files appear structured, yet may hide empty cells, duplicates, numeric anomalies, misclassified fields and assumptions that affect downstream analysis. DataProof Lab creates a small, transparent workbench for exploring these concerns without a Python environment.

## Audience

Students practicing exploratory data analysis, beginner analysts preparing small datasets, and portfolio visitors who want to inspect the implementation. The app is not a production data-governance system.

## Design choices

- **Browser-only**: visitors can try the built-in sample instantly; uploaded files are not sent to a backend.
- **Separate computations and presentation**: parser, audit, statistics, cleaning, and reporting remain in distinct JavaScript files.
- **Explainability over fake scores**: there is no opaque universal "data quality 97%" score. Instead, the Passport gives measured metrics and explicit rules.
- **Non-destructive exploration**: cleaning is applied to copies and shown side-by-side with the original.
- **Realistic caveats**: an IQR flag is only a statistical signal, and imputation changes the data. Generated reports omit individual records but still require review before sharing.

## Example exercise

The fictional sample has 6 records with 1 exact duplicate and 3 blank cells. Duplicate removal plus median filling in the `score` column produces 5 records with 2 blanks and 92% completeness. This gives a small reproducible example to demonstrate algorithms and user interactions.

## Verifiable evidence

- Node test suite for parsing, statistics, cleaning, export escaping and Passport generation.
- Browser checks at desktop and mobile viewport sizes, including downloads.
- Actual browser screenshots in `assets/`.
- `TESTING.md` separates completed checks from remaining verification.

## Current limitations / future work

CSV is limited to 5 MiB. Type inference is heuristic. Outliers use one specific quartile method and do not establish errors. The app cannot detect population bias, target leakage or clinical/business validity. See the public GitHub Issues for future features when the repository is published.

## How to explain the project in an interview

> DataProof Lab is a client-side data-quality workbench. I implemented CSV parsing, structural profiling, statistical summaries, a preview-only cleaning pipeline and an aggregate Dataset Passport. The key engineering decision was to keep transformations non-destructive and show evidence rather than claim that a dataset is ready for AI. I can demonstrate the algorithms, the tests and known limitations.

Only claim authorship for work that you actually understand and can explain; practice tracing the code before presenting it as independent work.

# DataProof X — architecture and staged engineering roadmap

> Proposal, not a claim that every planned feature is already implemented. v1.0 remains published from main. The v2.1 Validation Studio is developed on feature/validation-studio-v2 and requires review/merge.

## Product thesis

DataProof X is a privacy-conscious workbench that connects four decisions: **what qualifies as valid data**, **what cleaning changes**, **whether a newer dataset differs**, and **how preprocessing affects a legitimate held-out ML evaluation**.

Target audiences: data science students, analysts, business/finance practitioners and ML engineers. These audiences have different requirements; a generic quality percentage cannot replace domain rules or model validation.

## Architectural decision

The primary deployment stays static on GitHub Pages. HTML/CSS + modular JavaScript perform local analysis of selected CSV files. There are no accounts, database uploads or external analytics endpoints.

A **separate, optional backend** can be considered only for large-file processing, enterprise storage, authentication or expensive computation. GitHub Pages itself cannot execute a Python/Flask service. Before any server option, explicitly design consent, retention, encryption, access control, audit logging and operational cost. Avoid collecting confidential customer, financial or health data in the portfolio prototype.

For future computation-heavy modules, prefer Web Workers to keep the interface responsive. For genuine browser-based ML, consider carefully version-pinned TensorFlow.js or simple transparent baseline models; do not advertise machine learning until a trainable, evaluated model exists.

## Milestones / definitions of done

### v2.1 — Custom Validation Studio (first implementation)

- User chooses a dataset column and creates one of four check types: required, unique, numeric range, or allowed categories.
- Engine checks the current **original** CSV without modifying it and reports failures with CSV row numbers.
- Blank cells are ignored by optional checks; required rules handle blankness.
- Duplicate column values are compared case-sensitively after whitespace trimming.
- Rule counts and row references are downloadable as JSON, without individual cell values.
- New dataset resets the transient rule configuration. Up to 25 rules are allowed.
- Node tests cover rules, invalid configurations, count accuracy and non-mutation.
- **Not included**: persistent saved rules, distributed schema validation, rule formula editor, Excel support, server-side enforcement or assessing the cleaned-preview variant.

### v2.2 — Cleaning Decision Lab (planned)

- Compare explicit alternative operations side-by-side: remove rows vs mean/median/mode imputation; optionally columnwise transformations.
- Present information loss and changes in count/distribution; never promise that a higher completeness score means better data.
- Treat identifier-like columns as non-imputable by default, with a clearly documented override design.
- Test zero-variance, all-blank, skewed and missing-not-at-random examples.
- Keep transformations non-destructive and generate a reproducible decision log.

### v2.3 — Dataset Drift Investigator (planned)

- User provides reference CSV and current CSV with an explicit column alignment UI.
- Report schema additions/removals, missingness shift, categorical new/unseen groups and numeric distribution changes.
- Compare numeric fields using carefully specified, tested methods such as KS statistics or binned PSI; categorical fields with PSI/JS divergence, with transparent smoothing and thresholds.
- Distinguish **distance** from **statistical significance**, show sample sizes, warn on small groups, and avoid blanket “model failure” conclusions.
- Save no uploaded datasets on a server.

### v2.4 — ML Readiness Investigator (planned)

- Select target column and task type (classification or regression); detect missing labels and class imbalance.
- Flag suspicious target-like identifiers and possible leakage **heuristically**, not as a proof.
- Separate data preprocessing from model evaluation and document important dataset splitting choices.

### v3.0 — Actual ML Experiment Lab (planned)

- Start with transparent, reproducible baselines: majority-class/dummy model, then trainable logistic regression or a small decision tree for classification; mean baseline then regression model for suitable numeric targets.
- Seeded train/test split, and train-only preprocessing to prevent leakage.
- Evaluate balanced accuracy, precision, recall, F1, confusion matrix for classification; MAE/RMSE for regression; show class support and limitations.
- Compare original/cleaning scenarios with **identical split** and no test-set peeking.
- Avoid training on sensitive or small datasets and do not claim that evaluation establishes real-world validity.

### v3.1 — Product quality and reproducibility (planned)

- Extract core logic into independently tested modules and run automated CI checks.
- Accessible control labels, keyboard focus, screen-reader summaries, desktop/mobile smoke tests.
- Web Worker processing for larger files and visible cancel/progress/error states.
- Versioned report format and experiment reproducibility manifest.
- Inspect performance/memory on real hardware before changing file-size limits.

## Engineering guardrails

- Protect the current main branch: new capability goes onto a feature branch and through a pull request.
- File parsing and rule checks must not execute CSV text as JavaScript or inject it with innerHTML.
- Filenames, column names and aggregate counts can disclose business context: remind users to review exports.
- Avoid unsafe fake contribution history and inflated AI claims. Commits should correspond to real changes and verifiable tests.
- Keep project source readable enough for the owner to explain in an interview.

## Suggested demonstration datasets

- **Education**: fictional student grades, missing contact, and repeated student identifiers.
- **Finance**: *synthetic* loan applications with target imbalance, suspicious ID-like fields and deliberate missingness.
- **E-commerce**: synthetic product catalog snapshots from two periods for drift analysis.

Never commit real medical, financial or customer records.

## Release process

1. Run \`npm run check\` (Node 20+, no installation).
2. Review the PR diff and test results.
3. Verify the validation form in Chrome and Edge, including mobile width and keyboard operation.
4. Merge only when acceptance criteria are satisfied.
5. Recheck GitHub Pages deployment and README screenshots.

Status labels:
- **Implemented** = code exists on the feature branch.
- **Automated checks passed** = a CI run completed successfully.
- **Published** = merged to main and GitHub Pages completed deployment.

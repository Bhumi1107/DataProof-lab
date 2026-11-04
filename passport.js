/* DataProof Lab · Milestone 6: transparent Dataset Passport.
   Static/browser-only, no network calls. Export summary statistics, not dataset rows.
   Aggregate metadata can still be sensitive; users must review before sharing. */
(function () {
  'use strict';
  let source = null;
  let currentPassport = null;
  const $ = id => document.getElementById(id);

  const toPercent = (n, decimals = 1) => Number(n).toFixed(decimals) + '%';
  const round = n => n === null || n === undefined || !Number.isFinite(n)
    ? null : Math.round(n * 10000) / 10000;
  const check = (severity, title, evidence, explanation, recommendation) =>
    ({ severity, title, evidence, explanation, recommendation });

  function createDatasetPassport({ filename, headers, rows, variant = 'original', cleaning = null, generatedAt = new Date().toISOString() }) {
    if (!Array.isArray(headers) || !Array.isArray(rows) || !headers.length) {
      throw new Error('A parsed CSV dataset is required.');
    }
    const audit = analyzeDataset(headers, rows);
    const profiles = profileColumns(headers, rows);
    const missingPct = audit.totalCells ? 100 * audit.missingValues / audit.totalCells : null;
    const duplicatePct = audit.totalRows ? 100 * audit.duplicateRows / audit.totalRows : null;
    const findings = [];
    if (!rows.length) {
      findings.push(check('high', 'No data records', '0 data rows',
        'Quality percentages cannot be assessed without observations.', 'Upload a CSV containing at least one data row.'));
    }
    const empty = profiles.filter(p => p.type === 'empty');
    if (empty.length) findings.push(check('high', 'Entirely empty columns',
      `${empty.length} column(s) have no nonblank values`, 'An empty feature cannot be learned from as-is.',
      'Confirm whether these columns are needed and investigate their source.'));
    if (audit.missingValues) findings.push(check(missingPct > 20 ? 'high' : 'review',
      'Missing values present', `${audit.missingValues} blank cells (${toPercent(missingPct)})`,
      'Blank values can affect statistics and model preparation.',
      'Review missingness by column. If you impute, document the method and validate its impact.'));
    if (audit.duplicateRows) findings.push(check(duplicatePct > 10 ? 'high' : 'review',
      'Exact duplicate rows', `${audit.duplicateRows} repeated rows (${toPercent(duplicatePct)})`,
      'Duplicates can overweight repeated observations. Some repeats may be legitimate.',
      'Investigate whether duplicate records are intentional before removing them.'));
    const mixed = profiles.filter(p => p.type === 'mixed');
    if (mixed.length) findings.push(check('review', 'Mixed inferred types',
      `${mixed.length} column(s) contain mixed-looking values`,
      'Unexpected type combinations can cause parsing and analysis errors.',
      'Inspect formatting, missing-value markers, and the intended type for each column.'));
    const numeric = profiles.filter(p => p.stats && !isIdentifierLike(p.name));
    const flagged = numeric.filter(p => p.stats.outliers.length);
    if (flagged.length) findings.push(check('review', 'Possible numeric outliers',
      `${flagged.reduce((n, p) => n + p.stats.outliers.length, 0)} flagged value(s) across ${flagged.length} column(s)`,
      'The 1.5 × IQR rule identifies unusual observations; these can be correct values.',
      'Investigate the source, units, and distribution before modifying any flagged value.'));
    const unassessed = numeric.filter(p => !p.stats.canFlag);
    if (unassessed.length) findings.push(check('info', 'Some outlier checks were not assessed',
      `${unassessed.length} numeric column(s) lacked enough variation or observations`,
      'This tool does not flag outliers when fewer than four values exist or IQR is zero.',
      'Treat the absence of flags as inconclusive for these columns.'));
    const ids = profiles.filter(p => isIdentifierLike(p.name));
    if (ids.length) findings.push(check('info', 'Potential identifier columns',
      `${ids.length} header(s) resemble IDs or contact fields`,
      'Column names provide only a heuristic; values were not verified for privacy or identity.',
      'Exclude identifiers and sensitive information as appropriate before modeling or sharing reports.'));
    if (rows.length < 30 && rows.length) findings.push(check('info', 'Small dataset',
      `${rows.length} row(s)`, 'Statistical patterns based on small samples may be unstable.',
      'Do not interpret this dataset alone as sufficient for reliable machine learning.'));
    if (variant === 'cleaning_preview' && cleaning && cleaning.filled) {
      findings.push(check('info', 'Imputed values in preview',
        `${cleaning.filled} missing cell(s) replaced`,
        'Imputed data are estimates, not observed facts. The transformation was simulated in a separate copy.',
        'Compare model or analysis outcomes before and after imputation; keep an audit trail.'));
    }
    if (!findings.some(c => c.severity === 'high' || c.severity === 'review')) {
      findings.push(check('pass', 'No flagged issues under the implemented checks',
        'No unresolved completeness, exact-duplicate, mixed-type or IQR warning',
        'Passing these limited rules does not establish dataset validity, representativeness, fairness, or ML readiness.',
        'Validate meaning, units, provenance, target definition and context with a domain expert.'));
    }
    const rank = { high: 0, review: 1, info: 2, pass: 3 };
    findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
    const passport = {
      schema_version: '1.0', report_name: 'DataProof Lab Dataset Passport', generated_at: generatedAt,
      source_filename: String(filename || 'unnamed.csv'),
      variant, dataset: {
        rows: audit.totalRows, columns: audit.totalColumns, total_cells: audit.totalCells,
        blank_cells: audit.missingValues, blank_cell_percent: round(missingPct),
        completeness_percent: audit.totalCells ? round(audit.completeness) : null,
        exact_duplicate_rows: audit.duplicateRows, duplicate_percent: round(duplicatePct),
        uniqueness_percent: audit.totalRows ? round(audit.uniqueness) : null
      },
      columns: profiles.map(p => ({
        name: p.name, index: p.index, inferred_type: p.type, filled: p.filled,
        blank: p.missing, blank_percent: rows.length ? round(100 * p.missing / rows.length) : null,
        distinct_nonblank: p.distinct,
        numeric_summary: p.stats ? {
          observations: p.stats.count,
          mean: round(p.stats.mean), median: round(p.stats.median),
          minimum: round(p.stats.min), maximum: round(p.stats.max),
          q1: round(p.stats.q1), q3: round(p.stats.q3), iqr: round(p.stats.iqr),
          iqr_outlier_check_assessed: p.stats.canFlag,
          iqr_flagged_count: p.stats.outliers.length
        } : null
      })),
      checks: findings,
      cleaning_preview: variant === 'cleaning_preview' && cleaning ? {
        source_rows: cleaning.before.totalRows, simulated_rows: cleaning.after.totalRows,
        duplicates_removed: cleaning.removed, missing_cells_filled: cleaning.filled,
        // Keep replacement value out of exported passport because this can reveal a source value.
        replacement_value_included: false,
        original_dataset_unchanged: true
      } : null,
      methodology: {
        missing: 'Cell is missing when empty or whitespace-only.',
        duplicates: 'Exact row matches use string equality in original column order.',
        types: 'Inferred by heuristics; numeric identifiers may be misclassified.',
        quartiles: 'Linear interpolation of sorted values at (n-1)*p.',
        outliers: '1.5 × IQR; only numeric fields with >=4 values and nonzero IQR. Identifier-like headers are excluded from warning summary.',
        quality_decision: 'No composite readiness score: checks are transparent and contextual.',
        target_label: 'No target was selected; label leakage, validation strategy, representation and fairness were not assessed.'
      },
      limitations: [
        'Educational quality screening, not an AI model and not an ML-readiness certification.',
        'CSV type inference is heuristic and may be wrong.',
        'Statistical aggregates and column names can themselves be sensitive even without raw rows.',
        'No assessment of bias, data provenance, label leakage, domain constraints, or actual model performance.',
        'The source file remains in the browser; downloadable reports are generated locally and are not uploaded.'
      ],
      privacy: 'Exports contain column names and aggregate statistics, not individual CSV records.'
    };
    return passport;
  }

  function reportSummary(passport) {
    return {
      high: passport.checks.filter(x => x.severity === 'high').length,
      review: passport.checks.filter(x => x.severity === 'review').length,
      info: passport.checks.filter(x => x.severity === 'info').length
    };
  }
  function setText(id, value) { $(id).textContent = String(value); }
  function createCell(tag, value) {
    const cell = document.createElement(tag);
    cell.textContent = String(value);
    return cell;
  }
  function renderPassport() {
    if (!source) return;
    const variant = $('passportScope').value === 'cleaning_preview' ? 'cleaning_preview' : 'original';
    const preview = typeof cleaningState !== 'undefined' && cleaningState?.preview || null;
    const available = Boolean(preview);
    $('passportScope').querySelector('option[value="cleaning_preview"]').disabled = !available;
    if (variant === 'cleaning_preview' && !available) {
      $('passportScope').value = 'original';
      return renderPassport();
    }
    const rows = variant === 'cleaning_preview' ? preview.rows : source.rows;
    currentPassport = createDatasetPassport({
      filename: source.filename, headers: source.headers, rows,
      variant, cleaning: variant === 'cleaning_preview' ? preview : null
    });
    const d = currentPassport.dataset, count = reportSummary(currentPassport);
    const status = count.high ? 'High-priority data issues' : count.review ? 'Human review recommended' : 'No major issues under these checks';
    setText('passportAssessment', status);
    setText('passportSource', variant === 'original' ? 'Original uploaded dataset' : 'Simulated cleaning preview');
    setText('passportMissing', d.completeness_percent === null ? 'N/A' : toPercent(d.completeness_percent));
    setText('passportUnique', d.uniqueness_percent === null ? 'N/A' : toPercent(d.uniqueness_percent));
    setText('passportFlags', count.high + count.review);
    setText('passportSummary', `${count.high} high-priority · ${count.review} review · ${count.info} informational observations`);

    const list = $('passportFindings');
    list.replaceChildren();
    for (const finding of currentPassport.checks) {
      const card = document.createElement('article');
      card.className = 'passport-finding severity-' + finding.severity;
      const heading = document.createElement('div');
      heading.className = 'passport-finding-head';
      const title = createCell('strong', finding.title);
      const sev = createCell('span', finding.severity.toUpperCase());
      sev.className = 'passport-severity';
      heading.append(title, sev);
      const evidence = createCell('p', finding.evidence);
      evidence.className = 'passport-evidence';
      const why = createCell('p', 'Why: ' + finding.explanation);
      const next = createCell('p', 'Next step: ' + finding.recommendation);
      card.append(heading, evidence, why, next);
      list.appendChild(card);
    }
    const tbody = $('passportColumns').querySelector('tbody');
    tbody.replaceChildren();
    const columns = [...currentPassport.columns].sort((a, b) => b.blank - a.blank || a.index - b.index);
    for (const p of columns.slice(0, 12)) {
      const tr = document.createElement('tr');
      [p.name, p.inferred_type, p.blank, p.blank_percent === null ? 'N/A' : toPercent(p.blank_percent), p.numeric_summary?.iqr_flagged_count ?? '—'].forEach(x => tr.appendChild(createCell('td', x)));
      tbody.appendChild(tr);
    }
    setText('passportColumnNote', columns.length > 12 ? `Showing 12 of ${columns.length} columns. All are included in the downloadable reports.` : `Showing all ${columns.length} columns.`);
    setText('passportStatus', 'Report generated locally; no raw data rows are included.');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }
  function passportToHtml(p) {
    const e = escapeHtml, d = p.dataset, c = reportSummary(p);
    const metric = (label, value) => `<div class="metric"><small>${e(label)}</small><strong>${e(value)}</strong></div>`;
    const checks = p.checks.map(x => `<article class="check ${e(x.severity)}"><header><b>${e(x.title)}</b><span>${e(x.severity.toUpperCase())}</span></header><p><strong>Evidence:</strong> ${e(x.evidence)}</p><p><strong>Why:</strong> ${e(x.explanation)}</p><p><strong>Next step:</strong> ${e(x.recommendation)}</p></article>`).join('');
    const cols = p.columns.map(x => `<tr><td>${e(x.name)}</td><td>${e(x.inferred_type)}</td><td>${e(x.filled)}</td><td>${e(x.blank)}</td><td>${e(x.blank_percent === null ? 'N/A' : toPercent(x.blank_percent))}</td><td>${e(x.numeric_summary?.iqr_flagged_count ?? '—')}</td></tr>`).join('');
    const cleaning = p.cleaning_preview ? `<section><h2>Simulated cleaning changes</h2><p>${e(p.cleaning_preview.duplicates_removed)} duplicate rows removed; ${e(p.cleaning_preview.missing_cells_filled)} blank cells filled. Original source preserved. This is a preview, not a validated cleaning pipeline.</p></section>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Dataset Passport — ${e(p.source_filename)}</title><style>
    :root{color-scheme:light}*{box-sizing:border-box}body{font:15px/1.55 system-ui,Arial,sans-serif;color:#183147;background:#f4f8f7;margin:0}main{max-width:940px;margin:36px auto;padding:32px;background:white;border:1px solid #dae5e1;border-radius:16px}h1{font-size:32px;margin:8px 0}h2{font-size:19px;margin-top:27px}p{margin:8px 0;color:#536977}.eyebrow{color:#167b67;text-transform:uppercase;font-weight:750;letter-spacing:1.6px;font-size:11px}.muted{color:#7d8f98}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0}.metric{border:1px solid #dce8e3;border-radius:10px;padding:14px}.metric small{display:block;color:#7c9297}.metric strong{font-size:24px}.check{border-left:4px solid #c99a42;background:#fafbf9;padding:12px 15px;margin:10px 0;border-radius:8px}.check.high{border-color:#c75b57}.check.info,.check.pass{border-color:#259277}.check header{display:flex;justify-content:space-between;gap:12px}.check header span{font-size:11px;text-transform:uppercase;letter-spacing:1px}.check p{font-size:13px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #e3e9ed;text-align:left;font-size:13px}th{background:#edf5f2}li{padding:3px 0;color:#526a77}.foot{border-top:1px solid #e0e8e5;padding-top:14px;margin-top:22px;font-size:12px} @media(max-width:700px){main{margin:0;padding:20px}.metrics{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff}main{margin:0;padding:0;border:0}.check{break-inside:avoid}tr{break-inside:avoid}h2{break-after:avoid}}
    </style></head><body><main><div class="eyebrow">DataProof Lab · Explainable dataset audit</div><h1>Dataset Passport</h1><p><b>File:</b> ${e(p.source_filename)} · <b>Variant:</b> ${e(p.variant.replace('_',' '))}</p><p class="muted">Generated ${e(p.generated_at)} · Aggregate summary, no row-level CSV records</p><div class="metrics">${metric('Rows',d.rows)}${metric('Columns',d.columns)}${metric('Completeness',d.completeness_percent===null?'N/A':toPercent(d.completeness_percent))}${metric('Unique rows',d.uniqueness_percent===null?'N/A':toPercent(d.uniqueness_percent))}</div><p><b>Findings:</b> ${c.high} high priority · ${c.review} need review · ${c.info} informational</p><section><h2>Findings and next steps</h2>${checks}</section>${cleaning}<section><h2>Column overview</h2><div class="table-wrap"><table><thead><tr><th>Column</th><th>Inferred type</th><th>Filled</th><th>Blank</th><th>Blank %</th><th>IQR flags</th></tr></thead><tbody>${cols}</tbody></table></div></section><section><h2>How it was measured</h2><ul>${Object.entries(p.methodology).map(([key,val])=>`<li><b>${e(key.replaceAll('_',' '))}:</b> ${e(val)}</li>`).join('')}</ul></section><section><h2>Limitations</h2><ul>${p.limitations.map(x=>`<li>${e(x)}</li>`).join('')}</ul></section><p class="foot">DataProof Lab is an educational data-quality screening tool, not a predictive AI model or certification. No row-level dataset values are included, but aggregate statistics may still be sensitive. Review before sharing.</p></main></body></html>`;
  }

  function downloadBlob(text, type, filename) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  function downloadPassport(format) {
    if (!currentPassport) return;
    // Choose a generic filename: dataset filenames may contain private names.
    const name = currentPassport.variant === 'original' ? 'dataset-passport-original' : 'dataset-passport-cleaning-preview';
    if (format === 'json') downloadBlob(JSON.stringify(currentPassport, null, 2), 'application/json;charset=utf-8', name + '.json');
    else downloadBlob(passportToHtml(currentPassport), 'text/html;charset=utf-8', name + '.html');
    setText('passportStatus', 'Report downloaded. Review aggregates and column names before sharing.');
  }

  function startPassport(headers, rows, filename) {
    source = { headers: headers.slice(), rows: rows.map(row => row.slice()), filename };
    $('passportScope').value = 'original';
    renderPassport();
  }
  $('passportScope').addEventListener('change', renderPassport);
  for (const id of ['cleanDupes','cleanFill','cleanColumn']) {
    $(id).addEventListener('change', () => {
      if ($('passportScope').value === 'cleaning_preview') renderPassport();
    });
  }
  $('passportJSON').addEventListener('click', () => downloadPassport('json'));
  $('passportHTML').addEventListener('click', () => downloadPassport('html'));
  // Testable pure logic; view and source remain locally scoped.
  window.DataProofPassport = { create: createDatasetPassport, toHTML: passportToHtml, summary: reportSummary };
  window.startPassport = startPassport;
})();

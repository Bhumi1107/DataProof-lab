/* DataProof Lab / Milestone 5: local-only, non-destructive cleaning previews.
   No user dataset is transmitted or stored. Never silently replace source values. */

// Values with an identifying purpose should never be auto-imputed by this demo.
function isIdentifierLike(header) {
  return /(^|[_\s-])(id|name|contact|email|phone|mobile|address|ssn|passport|aadhar|aadhaar)([_\s-]|$)/i.test(header)
    || /(?:email|phone|mobile|contact|address|name)$/i.test(header);
}

function cleaningOptionsFor(headers, rows) {
  return profileColumns(headers, rows)
    .filter(profile => (profile.type === 'numeric' || profile.type === 'categorical')
      && !isIdentifierLike(profile.name))
    .map(profile => ({ index: profile.index, name: profile.name,
      type: profile.type, strategy: profile.type === 'numeric' ? 'median' : 'mode',
      missing: profile.missing }));
}

function mostFrequent(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function makeCleaningPreview(headers, originalRows, config = {}) {
  // The original arrays must remain unchanged through every operation.
  const before = analyzeDataset(headers, originalRows);
  const rows = originalRows.map(row => row.slice());
  const removeDuplicates = Boolean(config.removeDuplicates);
  const columnIndex = config.columnIndex === null || config.columnIndex === undefined
    ? null : Number(config.columnIndex);
  const strategy = config.strategy || 'none';
  const warnings = [];
  let removed = 0, filled = 0, replacement = null;

  let next = rows;
  if (removeDuplicates) {
    const seen = new Set();
    next = rows.filter(row => {
      const key = JSON.stringify(row); // exact-string match, consistent with audit.js
      if (seen.has(key)) { removed++; return false; }
      seen.add(key); return true;
    });
  }

  if (strategy !== 'none' && columnIndex !== null) {
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= headers.length) {
      throw new Error('Choose a valid column.');
    }
    const allowed = cleaningOptionsFor(headers, next).find(option => option.index === columnIndex);
    if (!allowed || allowed.strategy !== strategy) {
      throw new Error('This cleaning method is not available for the selected column.');
    }
    const present = next.map(row => String(row[columnIndex] ?? '').trim())
      .filter(value => !isMissing(value));
    if (present.length === 0) {
      warnings.push('No non-empty values are available to calculate a replacement.');
    } else if (strategy === 'median') {
      const values = present.map(Number).sort((a, b) => a - b);
      replacement = String(percentile(values, 0.5));
    } else if (strategy === 'mode') {
      replacement = mostFrequent(present);
    }
    if (replacement !== null) {
      next.forEach(row => {
        if (isMissing(row[columnIndex])) { row[columnIndex] = replacement; filled++; }
      });
    }
  }

  const after = analyzeDataset(headers, next);
  if (filled > 0) {
    warnings.push('Imputed values are estimates, not observed facts. Examine possible bias before using them for machine learning.');
  }
  if (after.duplicateRows > 0) {
    warnings.push(`${after.duplicateRows} duplicate row(s) remain after the preview operations.`);
  }
  return { rows: next, before, after, removed, filled, replacement,
    warnings, originalRows: originalRows.length, cleanedRows: next.length };
}

function encodeCSV(headers, rows) {
  const safeCell = raw => {
    let value = String(raw ?? '');
    // Guard against spreadsheet formula injection when a downloaded CSV is opened.
    // Intentionally changes suspicious values in the exported file only.
    if (/^\s*[=+@]/.test(value) || (/^\s*-/.test(value) && !isNumeric(value))) {
      value = "'" + value;
    }
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [headers, ...rows].map(row => row.map(safeCell).join(',')).join('\r\n') + '\r\n';
}

// User interface: all table data uses textContent, never untrusted innerHTML.
let cleaningState = null;
function startCleaningStudio(headers, rows) {
  cleaningState = { headers: headers.slice(), rows: rows.map(row => row.slice()), preview: null };
  const columns = cleaningOptionsFor(headers, rows);
  const chooser = document.getElementById('cleanColumn');
  chooser.replaceChildren();
  columns.forEach(c => {
    const option = document.createElement('option');
    option.value = String(c.index);
    option.textContent = `${c.name} · ${c.type} · ${c.missing} blank`;
    chooser.appendChild(option);
  });
  document.getElementById('cleanFill').disabled = columns.length === 0;
  document.getElementById('cleanFill').checked = columns.some(c => c.missing > 0);
  document.getElementById('cleanDupes').checked = true;
  if (columns.length) {
    const firstWithBlanks = columns.find(c => c.missing > 0) || columns[0];
    chooser.value = String(firstWithBlanks.index);
  }
  updateCleaningStrategy();
  refreshCleaningPreview();
}

function updateCleaningStrategy() {
  if (!cleaningState) return;
  const { headers, rows } = cleaningState;
  const selected = cleaningOptionsFor(headers, rows)
    .find(c => c.index === Number(document.getElementById('cleanColumn').value));
  const strategy = document.getElementById('cleanStrategy');
  strategy.textContent = selected?.strategy === 'median'
    ? 'Fill blanks with column median' : selected?.strategy === 'mode'
    ? 'Fill blanks with most frequent value' : 'No suitable column';
  document.getElementById('cleanFill').disabled = !selected;
}

function refreshCleaningPreview() {
  if (!cleaningState) return;
  const { headers, rows } = cleaningState;
  const column = cleaningOptionsFor(headers, rows)
    .find(c => c.index === Number(document.getElementById('cleanColumn').value));
  const useFill = document.getElementById('cleanFill').checked && Boolean(column);
  try {
    const result = makeCleaningPreview(headers, rows, {
      removeDuplicates: document.getElementById('cleanDupes').checked,
      columnIndex: useFill ? column.index : null,
      strategy: useFill ? column.strategy : 'none'
    });
    cleaningState.preview = result;
    const text = (id, value) => { document.getElementById(id).textContent = String(value); };
    text('cleanBeforeRows', result.before.totalRows);
    text('cleanAfterRows', result.after.totalRows);
    text('cleanBeforeMissing', result.before.missingValues);
    text('cleanAfterMissing', result.after.missingValues);
    text('cleanBeforeDuplicates', result.before.duplicateRows);
    text('cleanAfterDuplicates', result.after.duplicateRows);
    text('cleanBeforeComplete', result.before.completeness.toFixed(1) + '%');
    text('cleanAfterComplete', result.after.completeness.toFixed(1) + '%');
    text('cleanEffects', `${result.removed} duplicate row(s) removed · ${result.filled} blank cell(s) filled${result.replacement !== null ? ` with ${result.replacement}` : ''}.`);
    const notes = document.getElementById('cleanWarnings');
    notes.replaceChildren();
    for (const warning of result.warnings) {
      const p = document.createElement('p');
      p.textContent = warning;
      notes.appendChild(p);
    }
    document.getElementById('cleanDownload').disabled = false;
    document.getElementById('cleanStatus').textContent = 'This is a preview. The original uploaded dataset has not been changed.';
    drawCleaningPreview(headers, result.rows);
  } catch (error) {
    cleaningState.preview = null;
    document.getElementById('cleanDownload').disabled = true;
    document.getElementById('cleanStatus').textContent = 'Preview error: ' + error.message;
  }
}

function drawCleaningPreview(headers, rows) {
  const head = document.querySelector('#cleanPreviewTable thead');
  const body = document.querySelector('#cleanPreviewTable tbody');
  head.replaceChildren(); body.replaceChildren();
  const headerRow = document.createElement('tr');
  headers.forEach(name => {
    const th = document.createElement('th');th.textContent = name;headerRow.appendChild(th);
  });
  head.appendChild(headerRow);
  rows.slice(0, 6).forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = isMissing(cell) ? '—' : cell;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function downloadCleaningPreview() {
  if (!cleaningState?.preview) return;
  const content = encodeCSV(cleaningState.headers, cleaningState.preview.rows);
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'dataproof-cleaning-preview.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById('cleanStatus').textContent =
    'Cleaned CSV downloaded. Original dataset remains unchanged in this page.';
}

// Initialize controls once. The dataset is supplied later when CSV upload completes.
document.getElementById('cleanDupes').addEventListener('change', refreshCleaningPreview);
document.getElementById('cleanFill').addEventListener('change', refreshCleaningPreview);
document.getElementById('cleanColumn').addEventListener('change', () => {
  updateCleaningStrategy();refreshCleaningPreview();
});
document.getElementById('cleanDownload').addEventListener('click', downloadCleaningPreview);

const fileInput = document.getElementById("csvFile");
const statusText = document.getElementById("status");
const results = document.getElementById("results");
const columnSelect = document.getElementById("columnSelect");
let currentRows = [];
let currentProfiles = [];

// A visible sample lets GitHub visitors experience the workbench immediately.
// It is embedded here so file:// and GitHub Pages both work without fetch() calls.
const SAMPLE_CSV = [
  'student_id,name,score,category,contact',
  '1,"Riya, Shah",72,A,riya@example.test',
  '2,Dev,74,A,',
  '3,Anaya,73,A,anaya@example.test',
  '3,Anaya,73,A,anaya@example.test',
  '4,Kabir,,B,kabir@example.test',
  '5,Nora,98,A,'
].join("\n") + "\n";

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) {
    results.hidden = true;
    statusText.textContent = "No file selected.";
    return;
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    results.hidden = true;
    statusText.textContent = "Choose a .csv file.";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    results.hidden = true;
    statusText.textContent = "This demo supports CSV files up to 5 MB.";
    return;
  }
  try {
    await analyzeCSVText(await file.text(), file.name);
  } catch (error) {
    results.hidden = true;
    statusText.textContent = "Error: " + error.message;
    console.error(error);
  }
});

document.getElementById("sampleButton").addEventListener("click", async () => {
  fileInput.value = "";
  await analyzeCSVText(SAMPLE_CSV, "demo.csv · built-in sample");
});

async function analyzeCSVText(csvText, filename) {
  results.hidden = true;
  currentRows = [];
  currentProfiles = [];
  statusText.textContent = "Analyzing dataset...";
  try {
    const parsed = parseCSV(csvText);
    if (!parsed.length) throw new Error("The CSV file is empty.");
    const headers = parsed[0];
    const dataRows = parsed.slice(1);
    if (headers.some(h => h.trim() === "")) {
      throw new Error("Column headers cannot be empty.");
    }
    const normalized = headers.map(h => h.trim().toLowerCase());
    if (new Set(normalized).size !== headers.length) {
      throw new Error("Column headers must be unique.");
    }
    const invalid = dataRows.findIndex(row => row.length !== headers.length);
    if (invalid !== -1) {
      throw new Error("CSV record " + (invalid + 2) + " has the wrong number of columns.");
    }

    const audit = analyzeDataset(headers, dataRows);
    const profiles = profileColumns(headers, dataRows);
    currentRows = dataRows;
    currentProfiles = profiles;

    renderOverview(audit);
    renderColumns(profiles);
    renderNumericStats(profiles);
    renderOutliers(profiles);
    renderMissing(audit.columnReports);
    renderPreview(headers, dataRows);
    setupColumnSelect(profiles);
    startCleaningStudio(headers, dataRows);
    startPassport(headers, dataRows, filename);

    results.hidden = false;
    statusText.textContent = "Analysis complete: " + filename;
  } catch (error) {
    results.hidden = true;
    statusText.textContent = "Error: " + error.message;
    console.error(error);
  }
}

function setText(id, value) {
  document.getElementById(id).textContent = String(value);
}
function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function renderOverview(audit) {
  setText("totalRows", audit.totalRows);
  setText("totalColumns", audit.totalColumns);
  setText("missingValues", audit.missingValues);
  setText("duplicateRows", audit.duplicateRows);
  setText("completenessValue", audit.completeness.toFixed(1) + "%");
  setText("uniquenessValue", audit.uniqueness.toFixed(1) + "%");
  document.getElementById("completenessBar").style.width = audit.completeness + "%";
  document.getElementById("uniquenessBar").style.width = audit.uniqueness + "%";
  setText("completenessDescription", `${audit.missingValues} missing out of ${audit.totalCells} cells.`);
  setText("uniquenessDescription", `${audit.duplicateRows} exact duplicate row(s).`);
}

// Use textContent, not innerHTML, so CSV content never becomes executable HTML.
function addTableRow(tbody, values) {
  const tr = document.createElement("tr");
  values.forEach(value => {
    const td = document.createElement("td");
    td.textContent = String(value);
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}
function renderColumns(profiles) {
  const body = document.querySelector("#columnTable tbody");
  body.replaceChildren();
  profiles.forEach(p => addTableRow(body, [p.name, p.type, p.filled, p.missing, p.distinct]));
}
function renderNumericStats(profiles) {
  const body = document.querySelector("#statsTable tbody");
  body.replaceChildren();
  const numeric = profiles.filter(p => p.stats !== null);
  document.getElementById("noNumeric").hidden = numeric.length > 0;
  numeric.forEach(p => {
    const s = p.stats;
    addTableRow(body, [p.name, s.count, formatNumber(s.mean), formatNumber(s.median),
      formatNumber(s.min), formatNumber(s.max), formatNumber(s.q1),
      formatNumber(s.q3), formatNumber(s.iqr), s.canFlag ? s.outliers.length : "Not assessed"]);
  });
}
function renderOutliers(profiles) {
  const list = document.getElementById("outlierList");
  list.replaceChildren();
  const flagged = profiles.filter(p => p.stats && p.stats.outliers.length > 0);
  if (flagged.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No values were flagged. Columns with fewer than 4 numeric values or zero IQR are not assessed.";
    list.appendChild(p);
    return;
  }
  flagged.forEach(profile => {
    const item = document.createElement("div");
    item.className = "finding";
    const examples = profile.stats.outliers.slice(0, 4)
      .map(x => `CSV row ${x.csvRow}: ${formatNumber(x.value)}`).join("; ");
    item.textContent = `${profile.name}: ${profile.stats.outliers.length} possible outlier(s). ${examples}`;
    list.appendChild(item);
  });
}
function renderMissing(reports) {
  const body = document.querySelector("#missingTable tbody");
  body.replaceChildren();
  reports.forEach(p => addTableRow(body, [p.name, p.missing, p.missingPercent.toFixed(1) + "%"]));
}
function renderPreview(headers, rows) {
  const head = document.querySelector("#previewTable thead");
  const body = document.querySelector("#previewTable tbody");
  head.replaceChildren();
  body.replaceChildren();
  const tr = document.createElement("tr");
  headers.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    tr.appendChild(th);
  });
  head.appendChild(tr);
  rows.slice(0, 10).forEach(row => {
    addTableRow(body, row.map(cell => isMissing(cell) ? "—" : cell));
  });
}
function setupColumnSelect(profiles) {
  columnSelect.replaceChildren();
  profiles.forEach(p => {
    const option = document.createElement("option");
    option.value = String(p.index);
    option.textContent = `${p.name} (${p.type})`;
    columnSelect.appendChild(option);
  });
  // Prefer a meaningful numeric measurement over an identifier.
  const preferred = profiles.find(p => p.type === "numeric" && !/id$/i.test(p.name))
    || profiles.find(p => p.type === "categorical") || profiles[0];
  columnSelect.value = String(preferred.index);
  renderDistribution(preferred);
}
columnSelect.addEventListener("change", () => {
  const profile = currentProfiles.find(p => p.index === Number(columnSelect.value));
  if (profile) renderDistribution(profile);
});

function renderDistribution(profile) {
  const chart = document.getElementById("distributionChart");
  chart.replaceChildren();
  const values = currentRows.map(row => String(row[profile.index] ?? "").trim())
    .filter(value => !isMissing(value));
  const note = document.getElementById("chartNote");
  if (values.length === 0) {
    note.textContent = "This column has no non-empty values.";
    return;
  }

  let bars = [];
  if (profile.type === "numeric") {
    const numbers = values.map(Number);
    const min = profile.stats.min, max = profile.stats.max;
    // A simple histogram with five equal-width bins, except constant columns.
    const count = min === max ? 1 : 5;
    const width = count === 1 ? 1 : (max - min) / count;
    const counts = Array(count).fill(0);
    numbers.forEach(n => {
      const position = count === 1 ? 0 : Math.min(count - 1, Math.floor((n - min) / width));
      counts[position]++;
    });
    bars = counts.map((n, i) => ({
      label: count === 1 ? formatNumber(min) :
        formatNumber(min + width * i) + "–" + formatNumber(min + width * (i + 1)),
      count: n
    }));
    note.textContent = "Numeric histogram · five equal-width bins (or one if all values match).";
  } else {
    const frequency = new Map();
    values.forEach(value => frequency.set(value, (frequency.get(value) || 0) + 1));
    const entries = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
    bars = entries.slice(0, 6).map(([label, count]) => ({ label, count }));
    if (entries.length > 6) {
      bars.push({ label: "Other values", count: entries.slice(6).reduce((total, x) => total + x[1], 0) });
    }
    note.textContent = "Value frequencies · up to six common values plus Other. Numeric statistics are only computed for fully numeric columns.";
  }

  const maximum = Math.max(1, ...bars.map(b => b.count));
  bars.forEach(bar => {
    const row = document.createElement("div");
    row.className = "chart-row";
    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = bar.label;
    label.title = bar.label;
    const track = document.createElement("div");
    track.className = "chart-track";
    const fill = document.createElement("div");
    fill.className = "chart-fill";
    fill.style.width = (bar.count / maximum * 100) + "%";
    track.appendChild(fill);
    const value = document.createElement("strong");
    value.textContent = String(bar.count);
    row.append(label, track, value);
    chart.appendChild(row);
  });
}

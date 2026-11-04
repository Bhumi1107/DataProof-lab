// Milestone 4: explainable statistics, no libraries or external API.
function isMissing(value) {
  return String(value ?? "").trim() === "";
}

function isNumeric(value) {
  const text = String(value).trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text)
    && Number.isFinite(Number(text));
}

function isISODate(value) {
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function profileColumns(headers, rows) {
  return headers.map((name, index) => {
    const values = rows.map(row => String(row[index] ?? "").trim());
    const present = values.filter(value => !isMissing(value));
    const distinct = new Set(present).size;
    const numericCount = present.filter(isNumeric).length;
    const dateCount = present.filter(isISODate).length;

    let type = "text";
    if (present.length === 0) type = "empty";
    else if (numericCount === present.length) type = "numeric";
    else if (dateCount === present.length) type = "date";
    else if (numericCount > 0 || dateCount > 0) type = "mixed";
    else if (distinct <= Math.min(15, Math.max(2, Math.ceil(present.length * 0.5)))) {
      type = "categorical";
    }

    let stats = null;
    if (type === "numeric") {
      const numbers = present.map(Number).sort((a, b) => a - b);
      const q1 = percentile(numbers, 0.25);
      const q3 = percentile(numbers, 0.75);
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      // Very small samples and zero-IQR columns don't receive outlier flags.
      const canFlag = numbers.length >= 4 && iqr > 0;
      const outliers = canFlag ? values.flatMap((value, rowIndex) => {
        if (isMissing(value)) return [];
        const num = Number(value);
        return num < lowerFence || num > upperFence
          ? [{ csvRow: rowIndex + 2, value: num }]
          : [];
      }) : [];
      stats = {
        count: numbers.length,
        min: numbers[0],
        max: numbers[numbers.length - 1],
        mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
        median: percentile(numbers, 0.5),
        q1, q3, iqr, lowerFence, upperFence, outliers,
        canFlag
      };
    }

    return { name, index, type, filled: present.length,
      missing: values.length - present.length, distinct, stats };
  });
}

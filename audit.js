function analyzeDataset(headers, rows) {
  const totalRows = rows.length;
  const totalColumns = headers.length;
  const totalCells = totalRows * totalColumns;
  let missingValues = 0, duplicateRows = 0;
  const seenRows = new Set();
  const columnReports = headers.map((header, index) => {
    let missing = 0;
    rows.forEach(row => {
      if (String(row[index] ?? "").trim() === "") { missing++; missingValues++; }
    });
    return { name: header, missing, filled: totalRows - missing,
      missingPercent: totalRows ? missing / totalRows * 100 : 0 };
  });
  rows.forEach(row => {
    const key = JSON.stringify(row);
    if (seenRows.has(key)) duplicateRows++;
    else seenRows.add(key);
  });
  return { totalRows, totalColumns, totalCells, missingValues, duplicateRows,
    completeness: totalCells ? (totalCells - missingValues) / totalCells * 100 : 0,
    uniqueness: totalRows ? (totalRows - duplicateRows) / totalRows * 100 : 0,
    columnReports };
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", state = "start";
  text = text.replace(/^\uFEFF/, "");
  if (text.trim() === "") return rows;
  function finishCell() { row.push(cell); cell = ""; state = "start"; }
  function finishRow() {
    const wasQuoted = state === "afterQuote";
    finishCell();
    if (row.length > 1 || row[0] !== "" || wasQuoted) rows.push(row);
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else state = "afterQuote";
      } else cell += char;
      continue;
    }
    if (char === ",") { finishCell(); continue; }
    if (char === "\n" || char === "\r") {
      finishRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    if (state === "afterQuote") throw new Error("Invalid characters after a quoted value.");
    if (char === '"') {
      if (state === "start") state = "quoted";
      else throw new Error("Unexpected quotation mark in CSV.");
    } else { cell += char; state = "unquoted"; }
  }
  if (state === "quoted") throw new Error("CSV contains an unclosed quotation mark.");
  if (cell !== "" || row.length > 0 || state === "afterQuote") finishRow();
  return rows;
}

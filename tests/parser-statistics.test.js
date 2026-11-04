/* Reproducible parser/statistics tests. Node 20+, zero external dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({});
for (const filename of ['parser.js', 'audit.js', 'statistics.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, filename), 'utf8'), context);
}
const run = expression => vm.runInContext(expression, context);

test('quoted commas remain in one CSV field', () => {
  const result = run('parseCSV("name,city\\n\\\"Riya, Shah\\\",Pune\\n")');
  assert.equal(result[1][0], 'Riya, Shah');
  assert.equal(result[1][1], 'Pune');
});

test('CSV parser handles escaped quotes, multiline cells and Windows line endings', () => {
  const text = 'name,comment\r\nA,"He said ""hello"""\r\nB,"one\ntwo"\r\n';
  const rows = run('parseCSV(' + JSON.stringify(text) + ')');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], 'He said "hello"');
  assert.equal(rows[2][1], 'one\ntwo');
});

test('CSV parser handles Unicode BOM and quoted empty values', () => {
  const rows = run('parseCSV(' + JSON.stringify('\ufeffvalue\n""\nA\n') + ')');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], '');
});

test('CSV parser rejects malformed quote scenarios', () => {
  assert.throws(() => run('parseCSV("key,val\\n1,\\\"unterminated")'), /unclosed/i);
  assert.throws(() => run('parseCSV("key,val\\n1,\\\"two\\\"oops")'), /after a quoted value/i);
});

test('missing and exact duplicate analysis preserves original representation', () => {
  const output = run('analyzeDataset(["name","score"],[["A",""],["A",""],["A"," "]])');
  assert.equal(output.totalRows, 3);
  assert.equal(output.missingValues, 3);
  assert.equal(output.duplicateRows, 1); // whitespace is missing, but NOT an exact match
  assert.equal(output.completeness, 50);
});

test('numeric statistics flag the extreme sample score with the 1.5 IQR rule', () => {
  const scores = ['72', '74', '73', '73', '', '98'];
  const result = run('profileColumns(["score"], ' + JSON.stringify(scores.map(v => [v])) + ')');
  const col = result[0];
  assert.equal(col.type, 'numeric');
  assert.equal(col.stats.mean, 78);
  assert.equal(col.stats.median, 73);
  assert.equal(col.stats.q1, 73);
  assert.equal(col.stats.q3, 74);
  assert.equal(col.stats.iqr, 1);
  assert.equal(col.stats.outliers.length, 1);
  assert.equal(col.stats.outliers[0].value, 98);
});

test('heuristic detects ISO dates, categories and empty columns', () => {
  const r = run('profileColumns(["date","segment","notes"], [["2026-01-01","A",""],["2026-01-02","A", " "]])');
  assert.deepEqual(Array.from(r.map(x=>x.type)), ['date','categorical','empty']);
});

test('zero-IQR series does not imply outlier-free data certification', () => {
  const r = run('profileColumns(["score"],[["5"],["5"],["5"],["5"],["5"],["100"]])');
  assert.equal(r[0].stats.iqr, 0);
  assert.equal(r[0].stats.canFlag, false);
  assert.equal(r[0].stats.outliers.length, 0);
});

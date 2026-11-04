/* Run with Node 20+: node --test tests/cleaning.test.js
   Requires no additional npm packages. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const project = path.join(__dirname, '..');
const context = vm.createContext({
  document: { getElementById() { return { addEventListener() {} }; } },
  console
});
for (const name of ['parser.js', 'audit.js', 'statistics.js', 'cleaning.js']) {
  vm.runInContext(fs.readFileSync(path.join(project, name), 'utf8'), context);
}
const run = expression => vm.runInContext(expression, context);
const sample = fs.readFileSync(path.join(project, 'demo.csv'), 'utf8');
context.source = run('parseCSV(' + JSON.stringify(sample) + ')');
run('var headers = source[0]; var rows = source.slice(1)');

test('Milestone 4 audit baseline is consistent', () => {
  const result = run('analyzeDataset(headers,rows)');
  assert.equal(result.totalRows, 6);
  assert.equal(result.totalColumns, 5);
  assert.equal(result.missingValues, 3);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.completeness, 90);
});

test('preview removes one exact duplicate and fills missing score with median', () => {
  const out = run("makeCleaningPreview(headers,rows,{removeDuplicates:true,columnIndex:2,strategy:'median'})");
  assert.equal(out.removed, 1);
  assert.equal(out.filled, 1);
  assert.equal(out.replacement, '73.5');
  assert.equal(out.before.totalRows, 6);
  assert.equal(out.after.totalRows, 5);
  assert.equal(out.before.duplicateRows, 1);
  assert.equal(out.after.duplicateRows, 0);
  assert.equal(out.after.missingValues, 2);
  assert.equal(out.after.completeness, 92);
  assert.equal(out.rows[3][2], '73.5');
});

test('source dataset is untouched after all preview operations', () => {
  const before = JSON.stringify(context.source);
  run("makeCleaningPreview(headers,rows,{removeDuplicates:true,columnIndex:2,strategy:'median'})");
  assert.equal(JSON.stringify(context.source), before);
});

test('turning off cleaning leaves exact original data intact', () => {
  const result = run("makeCleaningPreview(headers,rows,{removeDuplicates:false,columnIndex:null,strategy:'none'})");
  assert.deepEqual(JSON.parse(JSON.stringify(result.rows)), JSON.parse(JSON.stringify(context.source.slice(1))));
  assert.equal(result.removed, 0);
  assert.equal(result.filled, 0);
});

test('identifying columns are not eligible for imputation', () => {
  const choices = run('cleaningOptionsFor(headers,rows)');
  assert.deepEqual(Array.from(choices.map(x=>x.name)), ['score','category']);
  assert.throws(() => run("makeCleaningPreview(headers,rows,{columnIndex:4,strategy:'mode'})"), /not available/);
});

test('categorical mode filling works deterministically on a distinct dataset', () => {
  const out = run("makeCleaningPreview(['segment'],[['A'],['B'],['A'],['']],{columnIndex:0,strategy:'mode'})");
  assert.equal(out.rows[3][0], 'A');
  assert.equal(out.filled, 1);
});

test('CSV output quotes cells properly and adds formula safety prefix', () => {
  const csv = run("encodeCSV(['name','value'],[['Riya, Shah','Line 1\\nLine 2'],['Dev','=2+2'],['Test','\\\"Hello\\\"']])");
  const parsed = run('parseCSV(' + JSON.stringify(csv) + ')');
  assert.equal(parsed[1][0], 'Riya, Shah');
  assert.equal(parsed[1][1], 'Line 1\nLine 2');
  assert.equal(parsed[2][1], "'=2+2");
  assert.equal(parsed[3][1], '"Hello"');
});

/* DataProof Lab: node --test tests/*.test.js (Node 20+). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname,'..');
const document = { getElementById(){return { addEventListener(){} };} };
const context = vm.createContext({document, window:{}, console});
for (const name of ['parser.js','audit.js','statistics.js','cleaning.js','passport.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
}
const run = js => vm.runInContext(js,context);
const sample = fs.readFileSync(path.join(root,'demo.csv'),'utf8');
context.source = run('parseCSV('+JSON.stringify(sample)+')');
run('var headers = source[0]; var rows = source.slice(1);');
const fresh = `generatedAt:'2026-11-04T00:00:00.000Z'`;

// Need to remove the prototype differences between vm objects and host assertions.
const plain = v => JSON.parse(JSON.stringify(v));

test('original passport reports correct measured dataset quality', () => {
  const p = plain(run(`window.DataProofPassport.create({filename:'demo.csv',headers,rows,${fresh}})`));
  assert.deepEqual([p.dataset.rows,p.dataset.columns,p.dataset.blank_cells,p.dataset.exact_duplicate_rows],[6,5,3,1]);
  assert.equal(p.dataset.completeness_percent,90);
  assert.equal(p.dataset.uniqueness_percent,83.3333);
  assert.equal(p.columns.find(c=>c.name==='score').numeric_summary.iqr_flagged_count,1);
  assert.ok(p.checks.some(c=>c.title==='Exact duplicate rows'));
  assert.ok(p.checks.some(c=>c.title==='Possible numeric outliers'));
});

test('cleaning preview passport matches before/after and records caveats', () => {
  const p = plain(run(`(function(){const preview=makeCleaningPreview(headers,rows,{removeDuplicates:true,columnIndex:2,strategy:'median'});return window.DataProofPassport.create({filename:'demo.csv',headers,rows:preview.rows,variant:'cleaning_preview',cleaning:preview,${fresh}});})()`));
  assert.equal(p.dataset.rows,5);
  assert.equal(p.dataset.blank_cells,2);
  assert.equal(p.dataset.exact_duplicate_rows,0);
  assert.equal(p.dataset.completeness_percent,92);
  assert.equal(p.cleaning_preview.duplicates_removed,1);
  assert.equal(p.cleaning_preview.missing_cells_filled,1);
  assert.ok(p.checks.some(c=>c.title==='Imputed values in preview'));
});

test('report exports no record-level names or source cell content', () => {
  const p = plain(run(`window.DataProofPassport.create({filename:'demo.csv',headers,rows,${fresh}})`));
  const text = JSON.stringify(p);
  assert.equal(text.includes('Riya, Shah'),false);
  assert.equal(text.includes('riya@example.test'),false);
  assert.equal(text.includes('Kabir'),false);
  const report = run('window.DataProofPassport.toHTML(window.DataProofPassport.create({filename:"demo.csv",headers,rows}))');
  assert.equal(report.includes('Riya, Shah'),false);
  assert.ok(report.includes('Dataset Passport'));
});

test('escape column names and file name when rendering printable HTML', () => {
  const html = run(`(function(){const p=window.DataProofPassport.create({filename:'<script>bad()</script>.csv',headers:['<img src=x onerror=alert(1)>'],rows:[['72']],${fresh}});return window.DataProofPassport.toHTML(p);})()`);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;.csv'));
  assert.equal(html.includes('<script>bad()</script>'),false);
  assert.equal(html.includes('<img src=x onerror=alert(1)>'),false);
});

test('empty dataset reports missing quality measures as unassessed', () => {
  const p = plain(run(`window.DataProofPassport.create({filename:'empty.csv',headers:['A','B'],rows:[],${fresh}})`));
  assert.equal(p.dataset.rows,0);
  assert.equal(p.dataset.completeness_percent,null);
  assert.equal(p.dataset.uniqueness_percent,null);
  assert.equal(p.checks[0].severity,'high');
});

test('review classification is not confused with proof of AI readiness', () => {
  const p = plain(run(`window.DataProofPassport.create({filename:'demo.csv',headers,rows,${fresh}})`));
  assert.ok(p.methodology.target_label.includes('not assessed'));
  assert.ok(p.limitations.some(s=>s.includes('not an AI model')));
  assert.equal(p.schema_version,'1.0');
});

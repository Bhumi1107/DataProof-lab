/* DataProof Lab v2.1 tests — Node.js built-in runner, zero dependencies. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({});
vm.runInContext(readFileSync(resolve(__dirname, "..", "validation.js"), "utf8"), context);
const api = context.DataProofValidation;
const toPlain = value => JSON.parse(JSON.stringify(value));

const headers = ["student_id", "name", "score", "category", "contact"];
const sample = [
  ["1", "Riya, Shah", "72", "A", "riya@example.test"],
  ["2", "Dev", "74", "A", ""],
  ["3", "Anaya", "73", "A", "anaya@example.test"],
  ["3", "Anaya", "73", "A", "anaya@example.test"],
  ["4", "Kabir", "", "B", "kabir@example.test"],
  ["5", "Nora", "98", "A", ""]
];

test("required: blank or whitespace-only cells fail and CSV row numbers start at 2", () => {
  const result = api.evaluateRule(headers, sample, { id: "req", type: "required", column: "contact" });
  assert.equal(result.assessed, 6);
  assert.equal(result.violations, 2);
  assert.deepEqual(toPlain(result.rowReferences), [3, 7]);
  assert.equal(api.evaluateRule(["x"], [[" "], ["ok"]], { type: "required", column: "x" }).violations, 1);
});

test("unique: trims surrounding whitespace, is case-sensitive, skips blanks", () => {
  const rows = [["A"], [" A "], ["a"], [""], ["  "], ["B"]];
  const result = api.evaluateRule(["identifier"], rows, { type: "unique", column: "identifier" });
  assert.equal(result.assessed, 4);
  assert.equal(result.violations, 1);
  assert.deepEqual(toPlain(result.rowReferences), [3]);
});

test("range: inclusive minimum and maximum with finite numeric values", () => {
  const rows = [["0"], ["100"], ["100.1"], ["-1"], ["bad"], [""], ["1e2"]];
  const result = api.evaluateRule(["age"], rows, { type: "numeric_range", column: "age", min: 0, max: 100 });
  assert.equal(result.assessed, 6);
  assert.equal(result.violations, 3);
  assert.deepEqual(toPlain(result.rowReferences), [4, 5, 6]);
  assert.equal(api.evaluateRule(headers, sample, { type: "numeric_range", column: "score", min: 0, max: 100 }).violations, 0);
});

test("allowed values: known categories pass; unknown nonblank categories fail", () => {
  const rows = [["A"], [" B "], ["C"], ["a"], [""]];
  const result = api.evaluateRule(["segment"], rows, { type: "allowed_values", column: "segment", values: "A, B" });
  assert.equal(result.assessed, 4);
  assert.equal(result.violations, 2);
  assert.deepEqual(toPlain(result.rowReferences), [4, 5]);
});

test("summary: identifies failing rules, preserving original rows", () => {
  const original = JSON.stringify(sample);
  const rules = [
    { id: "1", type: "required", column: "contact" },
    { id: "2", type: "unique", column: "name" },
    { id: "3", type: "numeric_range", column: "score", min: 0, max: 100 },
    { id: "4", type: "allowed_values", column: "category", values: ["A", "B"] }
  ];
  const result = api.evaluateRules(headers, sample, rules);
  assert.equal(result.totalRules, 4);
  assert.equal(result.failingRules, 2);
  assert.equal(result.ruleFailures, 3);
  assert.equal(JSON.stringify(sample), original, "Rule evaluation must not modify original cells");
  assert.ok(!JSON.stringify(result).includes("riya@example.test"), "Summary must not export raw data cells");
});

test("invalid rule configurations are rejected, not silently interpreted", () => {
  assert.throws(() => api.compileRule(headers, { type: "required", column: "unknown" }), /column/);
  assert.throws(() => api.compileRule(headers, { type: "numeric_range", column: "score", min: "10", max: "1" }), /minimum/);
  assert.throws(() => api.compileRule(headers, { type: "numeric_range", column: "score", min: "oops", max: "100" }), /finite/);
  assert.throws(() => api.compileRule(headers, { type: "allowed_values", column: "category", values: "" }), /permitted/);
  assert.throws(() => api.compileRule(headers, { type: "not-supported", column: "score" }), /valid rule type/);
});

test("wrong row widths are rejected rather than interpreted as missing data", () => {
  assert.throws(() => api.evaluateRule(["a", "b"], [["ok"]], { type: "required", column: "b" }), /match/);
});

test("rule limit protects browser from unbounded validation configuration", () => {
  assert.throws(() => api.evaluateRules(headers, sample, Array.from({ length: 26 }, () => ({ type: "required", column: "name" }))), /at most 25/);
});

test("row-number evidence is capped while exact failure count stays correct", () => {
  const rows = Array.from({ length: 30 }, () => [""]);
  const result = api.evaluateRule(["name"], rows, { type: "required", column: "name" });
  assert.equal(result.violations, 30);
  assert.equal(result.rowReferences.length, 10);
  assert.equal(result.omittedRowReferences, 20);
});

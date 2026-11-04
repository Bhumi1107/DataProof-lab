/* DataProof Lab v2.1: Custom Validation Studio.
   Browser-only and dependency-free. Rules are user-configured, not model predictions.
   Upload data and configured checks remain in the current tab only. */
(function (root) {
  "use strict";

  const RULE_TYPES = Object.freeze(["required", "unique", "numeric_range", "allowed_values"]);
  const MAX_RULES = 25;
  const MAX_ALLOWED_VALUES = 50;
  const MAX_ROW_REFERENCES = 10;

  function blank(value) {
    return String(value ?? "").trim() === "";
  }

  function compileRule(headers, rule) {
    if (!Array.isArray(headers) || !headers.length) throw Error("A dataset with columns is required.");
    if (!rule || !RULE_TYPES.includes(rule.type)) throw Error("Choose a valid rule type.");
    const column = String(rule.column ?? "");
    const index = headers.indexOf(column);
    if (index === -1) throw Error("Choose a column that exists in this dataset.");
    const compiled = { id: String(rule.id || ""), type: rule.type, column, index };
    if (rule.type === "numeric_range") {
      const minText = String(rule.min ?? "").trim();
      const maxText = String(rule.max ?? "").trim();
      if (minText === "" || maxText === "") throw Error("Enter both minimum and maximum values.");
      const min = Number(minText), max = Number(maxText);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        throw Error("The numeric range must have finite bounds and minimum ≤ maximum.");
      }
      compiled.min = min;
      compiled.max = max;
    }
    if (rule.type === "allowed_values") {
      const values = Array.isArray(rule.values)
        ? rule.values.map(v => String(v).trim()).filter(v => v !== "")
        : String(rule.values ?? "").split(",").map(v => v.trim()).filter(v => v !== "");
      const uniqueValues = [...new Set(values)];
      if (!uniqueValues.length || uniqueValues.length > MAX_ALLOWED_VALUES) {
        throw Error("Provide 1 to 50 permitted values, separated by commas.");
      }
      if (uniqueValues.some(v => v.length > 100)) throw Error("Each permitted value must be 100 characters or fewer.");
      compiled.values = uniqueValues;
    }
    return compiled;
  }

  // A blank is checked only by required rules; other checks skip blanks
  // to avoid reporting the same incomplete cell multiple times.
  function evaluateRule(headers, rows, rule) {
    if (!Array.isArray(rows)) throw Error("Rows must be an array.");
    const config = compileRule(headers, rule);
    const violationRows = [];
    let violations = 0, assessed = 0;
    const used = new Set();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length !== headers.length) {
        throw Error("Every CSV data row must match the dataset headers.");
      }
      const value = String(row[config.index] ?? "");
      const trimmed = value.trim();
      let failed = false;
      if (config.type === "required") {
        assessed++;
        failed = blank(value);
      } else if (!blank(value)) {
        assessed++;
        if (config.type === "unique") {
          // Case-sensitive uniqueness after trimming surrounding whitespace.
          failed = used.has(trimmed);
          used.add(trimmed);
        } else if (config.type === "numeric_range") {
          const numeric = Number(trimmed);
          failed = !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(trimmed)
            || !Number.isFinite(numeric) || numeric < config.min || numeric > config.max;
        } else if (config.type === "allowed_values") {
          failed = !config.values.includes(trimmed);
        }
      }
      if (failed) {
        violations++;
        if (violationRows.length < MAX_ROW_REFERENCES) violationRows.push(i + 2);
      }
    }
    const description = config.type === "required" ? "Must not be blank"
      : config.type === "unique" ? "Must be unique (case-sensitive)"
      : config.type === "numeric_range" ? "Numeric value between " + config.min + " and " + config.max
      : "One of: " + config.values.join(", ");
    return {
      id: config.id, type: config.type, column: config.column,
      description, assessed, violations, passed: assessed - violations,
      rowReferences: violationRows, omittedRowReferences: Math.max(0, violations - violationRows.length)
    };
  }

  function evaluateRules(headers, rows, rules) {
    if (!Array.isArray(rules) || rules.length > MAX_RULES) throw Error("Limit validation to at most 25 rules.");
    const results = rules.map(rule => evaluateRule(headers, rows, rule));
    return {
      totalRules: results.length,
      failingRules: results.filter(r => r.violations > 0).length,
      ruleFailures: results.reduce((n, r) => n + r.violations, 0),
      results
    };
  }

  const api = { RULE_TYPES, MAX_RULES, compileRule, evaluateRule, evaluateRules };
  root.DataProofValidation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document === "undefined") return;

  let currentHeaders = [], currentRows = [], rules = [], nextId = 1;
  const $ = id => document.getElementById(id);
  const labels = {
    required: "Required field", unique: "Unique values",
    numeric_range: "Numeric range", allowed_values: "Allowed categories"
  };

  function setStatus(message, error = false) {
    const element = $("validationStatus");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error-text", error);
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function render() {
    const list = $("validationRules");
    const summary = $("validationSummary");
    if (!list || !summary) return;
    list.replaceChildren();
    if (!rules.length) {
      summary.textContent = "No custom checks yet. Create a rule to validate your dataset.";
      $("validationExport").disabled = true;
      return;
    }
    const report = evaluateRules(currentHeaders, currentRows, rules);
    summary.textContent = report.totalRules + " rule(s) · " + report.failingRules +
      " failing rule(s) · " + report.ruleFailures + " validation failure(s).";
    $("validationExport").disabled = false;

    report.results.forEach(result => {
      const item = node("article", "validation-item");
      const head = node("div", "validation-item-head");
      head.appendChild(node("strong", "", result.column + " · " + labels[result.type]));
      head.appendChild(node("span", result.violations ? "validation-fail" : "validation-pass",
        result.violations ? result.violations + " failing" : "All checked values pass"));
      const desc = node("p", "helper", result.description + " · " + result.assessed + " assessed.");
      const rows = node("p", "validation-rows",
        result.violations ? "CSV rows: " + result.rowReferences.join(", ") +
        (result.omittedRowReferences ? " (+" + result.omittedRowReferences + " more)" : "")
        : "No failing rows under this rule.");
      const remove = node("button", "validation-remove", "Remove rule");
      remove.type = "button";
      remove.dataset.ruleId = result.id;
      remove.setAttribute("aria-label", "Remove validation rule for " + result.column);
      head.appendChild(remove);
      item.append(head, desc, rows);
      list.appendChild(item);
    });
  }

  function updateFields() {
    const type = $("validationRuleType")?.value;
    $("validationRangeFields").hidden = type !== "numeric_range";
    $("validationAllowedFields").hidden = type !== "allowed_values";
  }

  function begin(headers, rows) {
    currentHeaders = [...headers];
    currentRows = rows.map(row => [...row]);
    rules = [];
    nextId = 1;
    $("validationColumn").replaceChildren();
    headers.forEach(header => {
      const option = node("option", "", header);
      option.value = header;
      $("validationColumn").appendChild(option);
    });
    $("validationRuleType").value = "required";
    $("validationMin").value = "";
    $("validationMax").value = "";
    $("validationAllowed").value = "";
    updateFields();
    $("validationRuleForm").hidden = false;
    $("validationEmpty").hidden = true;
    setStatus("Dataset loaded. Add a validation rule to begin.");
    render();
  }

  function downloadSummary() {
    const report = evaluateRules(currentHeaders, currentRows, rules);
    // No dataset rows or offending cell values are included.
    const exportValue = {
      tool: "DataProof Lab — Custom Validation Studio",
      formatVersion: "1.0",
      generatedAt: new Date().toISOString(),
      dataset: { rows: currentRows.length, columns: currentHeaders.length },
      ...report
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportValue, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataproof-custom-validation.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus("Validation summary downloaded. Review column names before sharing.");
  }

  function install() {
    const form = $("validationRuleForm");
    if (!form) return;
    $("validationRuleType").addEventListener("change", updateFields);
    form.addEventListener("submit", event => {
      event.preventDefault();
      try {
        if (!currentHeaders.length) throw Error("Upload a CSV dataset first.");
        if (rules.length >= MAX_RULES) throw Error("This version supports at most 25 active rules.");
        const type = $("validationRuleType").value;
        const rule = {
          id: "rule-" + nextId++, type, column: $("validationColumn").value,
          min: $("validationMin").value, max: $("validationMax").value,
          values: $("validationAllowed").value
        };
        compileRule(currentHeaders, rule);
        if (rules.some(r => r.type === rule.type && r.column === rule.column &&
          r.min === rule.min && r.max === rule.max && r.values === rule.values)) {
          throw Error("That exact rule already exists.");
        }
        rules.push(rule);
        render();
        setStatus("Rule added and checked across " + currentRows.length + " data rows.");
      } catch (error) { setStatus(error.message, true); }
    });
    $("validationRules").addEventListener("click", event => {
      const button = event.target.closest("button[data-rule-id]");
      if (!button) return;
      rules = rules.filter(rule => rule.id !== button.dataset.ruleId);
      render();
      setStatus("Rule removed.");
    });
    $("validationExport").addEventListener("click", downloadSummary);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
  api.start = begin;
})(typeof window !== "undefined" ? window : globalThis);

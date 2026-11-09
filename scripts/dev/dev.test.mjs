import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Evaluate only the pure TOML helpers, never the setup/clean command dispatcher.
const source = fs.readFileSync(new URL("./dev.mjs", import.meta.url), "utf8");
const start = source.indexOf("function section(");
const end = source.indexOf("function init()", start);
assert.ok(start >= 0 && end > start);
const helpers = vm.runInNewContext(`(() => { ${source.slice(start, end)}; return { section, replaceInSection, insertInSection }; })()`);

test("section includes all lines until the next table or end of file", () => {
  const text = '[first]\nvalue = 1\nother = 2\n\n[last]\nvalue = 3';
  assert.equal(helpers.section(text, "first"), 'value = 1\nother = 2\n\n');
  assert.equal(helpers.section(text, "last"), 'value = 3');
  assert.equal(helpers.section(text, "missing"), "");
});

test("replacement is confined to the named table even for identical bodies", () => {
  const text = '[other]\ninherit = "none"\n[shell_environment_policy]\ninherit = "none"\n';
  assert.equal(helpers.replaceInSection(text, "shell_environment_policy", /^inherit\s*=.*$/m, 'inherit = "all"'),
    '[other]\ninherit = "none"\n[shell_environment_policy]\ninherit = "all"\n');
});

test("insertion into an empty table does not modify the document start", () => {
  const text = '[other]\nvalue = 1\n[shell_environment_policy.set]\n[next]\nvalue = 2\n';
  assert.equal(helpers.insertInSection(text, "shell_environment_policy.set", 'PATH = "local"'),
    '[other]\nvalue = 1\n[shell_environment_policy.set]\nPATH = "local"\n[next]\nvalue = 2\n');
});

test("missing tables remain untouched", () => {
  const text = '[other]\nvalue = 1\n';
  assert.equal(helpers.insertInSection(text, "missing", "x = 1"), text);
  assert.equal(helpers.replaceInSection(text, "missing", /x/, "y"), text);
});

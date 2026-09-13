import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  stripJsonc,
  validateJson,
  validateJsonc,
  parsePath,
  jsonGet,
  jsonSet,
  prettyJson,
  minifyJson,
  schemaValidate,
  diffJson,
} from "../lib.js";

describe("stripJsonc", () => {
  it("strips comments and trailing commas", () => {
    const raw = `{
      // comment
      "a": 1, /* b */
      "c": [1, 2,],
    }`;
    const cleaned = stripJsonc(raw);
    assert.deepEqual(JSON.parse(cleaned), { a: 1, c: [1, 2] });
  });
});

describe("validate", () => {
  it("validateJson ok/fail", () => {
    assert.equal(validateJson({ text: '{"a":1}' }).valid, true);
    assert.equal(validateJson({ text: "{a:1}" }).valid, false);
  });
  it("validateJsonc allows comments", () => {
    assert.equal(validateJsonc({ text: '{ /*x*/ "a": 1, }' }).valid, true);
  });
});

describe("path get/set", () => {
  it("parsePath", () => {
    assert.deepEqual(parsePath(".foo.bar[0]"), ["foo", "bar", 0]);
  });
  it("jsonGet", () => {
    const r = jsonGet({ text: '{"foo":{"bar":[10,20]}}', path: ".foo.bar[1]" });
    assert.equal(r.value, 20);
  });
  it("jsonSet", () => {
    const r = jsonSet({ text: '{"a":1}', path: ".b", value: 2 });
    assert.equal(r.result.b, 2);
  });
});

describe("pretty/minify", () => {
  it("pretty and minify", () => {
    const p = prettyJson({ text: '{"a":1,"b":2}', indent: 2 });
    assert.match(p.text, /\n/);
    const m = minifyJson({ text: p.text });
    assert.equal(m.text, '{"a":1,"b":2}');
  });
});

describe("schema + diff", () => {
  it("schemaValidate", () => {
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"] };
    const ok = schemaValidate({ dataText: '{"a":1}', schemaText: JSON.stringify(schema) });
    assert.equal(ok.valid, true);
    const bad = schemaValidate({ dataText: '{"a":"x"}', schemaText: JSON.stringify(schema) });
    assert.equal(bad.valid, false);
  });
  it("diffJson", () => {
    const d = diffJson({ leftText: '{"a":1}', rightText: '{"a":2}' });
    assert.equal(d.equal, false);
    assert.ok(d.diffs.length > 0);
  });
  it("roundtrip file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-tools-"));
    const f = path.join(dir, "x.json");
    fs.writeFileSync(f, '{"z":true}');
    assert.equal(validateJson({ filePath: f }).valid, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

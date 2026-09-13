/**
 * Local JSON/JSONC tools. Files and strings only — no network.
 */
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export function stripJsonc(text) {
  // Remove /* */ and // comments outside of strings (simple scanner)
  let out = "";
  let i = 0;
  let inStr = false;
  let quote = null;
  let escape = false;
  while (i < text.length) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === quote) {
        inStr = false;
        quote = null;
      }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // Allow trailing commas by skipping them before } or ]
    if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") {
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

export function readInput({ filePath, text, jsonc = false }) {
  let raw;
  if (filePath) {
    const p = path.resolve(filePath);
    if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
    raw = fs.readFileSync(p, "utf8");
  } else if (typeof text === "string") {
    raw = text;
  } else {
    throw new Error("Provide filePath or text");
  }
  const cleaned = jsonc || (filePath && /\.jsonc$/i.test(filePath)) ? stripJsonc(raw) : raw;
  return { raw, cleaned, parsed: JSON.parse(cleaned) };
}

export function validateJson(args = {}) {
  try {
    const { parsed, cleaned } = readInput({ ...args, jsonc: false });
    return { valid: true, type: Array.isArray(parsed) ? "array" : typeof parsed, bytes: Buffer.byteLength(cleaned, "utf8") };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export function validateJsonc(args = {}) {
  try {
    const { parsed, cleaned } = readInput({ ...args, jsonc: true });
    return { valid: true, type: Array.isArray(parsed) ? "array" : typeof parsed, bytes: Buffer.byteLength(cleaned, "utf8") };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/** Simple jq-like path: .foo.bar[0].baz */
export function parsePath(pathExpr) {
  if (!pathExpr || pathExpr === "." || pathExpr === "") return [];
  let s = pathExpr.startsWith(".") ? pathExpr.slice(1) : pathExpr;
  const parts = [];
  const re = /([^[.\]]+)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1] !== undefined) parts.push(m[1]);
    else if (m[2] !== undefined) parts.push(Number(m[2]));
    else if (m[3] !== undefined) parts.push(m[3]);
    else if (m[4] !== undefined) parts.push(m[4]);
  }
  return parts;
}

export function getAtPath(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setAtPath(obj, parts, value) {
  if (!parts.length) throw new Error("Cannot set root via empty path");
  const clone = structuredClone(obj);
  let cur = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") {
      cur[p] = typeof parts[i + 1] === "number" ? [] : {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return clone;
}

export function jsonGet(args = {}) {
  const { parsed } = readInput(args);
  const parts = parsePath(args.path || ".");
  const value = getAtPath(parsed, parts);
  return { path: args.path || ".", found: value !== undefined, value };
}

export function jsonSet(args = {}) {
  const { parsed } = readInput(args);
  const parts = parsePath(args.path);
  if (!parts.length) throw new Error("path is required for json_set");
  let value = args.value;
  if (typeof value === "string" && args.parseValue) {
    try {
      value = JSON.parse(value);
    } catch {
      /* keep string */
    }
  }
  const next = setAtPath(parsed, parts, value);
  const pretty = args.minify ? JSON.stringify(next) : JSON.stringify(next, null, args.indent ?? 2);
  if (args.outputPath) {
    const out = path.resolve(args.outputPath);
    fs.writeFileSync(out, pretty + (args.minify ? "" : "\n"), "utf8");
    return { outputPath: out, path: args.path, written: true };
  }
  return { path: args.path, result: next, text: pretty };
}

export function prettyJson(args = {}) {
  const { parsed } = readInput(args);
  const indent = args.indent ?? 2;
  const text = JSON.stringify(parsed, null, indent) + "\n";
  if (args.outputPath) {
    fs.writeFileSync(path.resolve(args.outputPath), text, "utf8");
  }
  return { text, bytes: Buffer.byteLength(text, "utf8") };
}

export function minifyJson(args = {}) {
  const { parsed } = readInput(args);
  const text = JSON.stringify(parsed);
  if (args.outputPath) {
    fs.writeFileSync(path.resolve(args.outputPath), text, "utf8");
  }
  return { text, bytes: Buffer.byteLength(text, "utf8") };
}

export function schemaValidate(args = {}) {
  let data;
  let schema;
  if (args.dataFilePath || args.dataText !== undefined) {
    data = readInput({ filePath: args.dataFilePath, text: args.dataText, jsonc: args.jsonc }).parsed;
  } else {
    throw new Error("Provide dataFilePath or dataText");
  }
  if (args.schemaFilePath || args.schemaText !== undefined) {
    schema = readInput({ filePath: args.schemaFilePath, text: args.schemaText, jsonc: false }).parsed;
  } else {
    throw new Error("Provide schemaFilePath or schemaText");
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return {
    valid,
    errors: valid
      ? []
      : (validate.errors || []).map((e) => ({
          instancePath: e.instancePath,
          schemaPath: e.schemaPath,
          message: e.message,
          params: e.params,
        })),
  };
}

function sortedKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortedKeysDeep);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortedKeysDeep(obj[k]);
    return out;
  }
  return obj;
}

export function diffJson(args = {}) {
  const a = readInput({ filePath: args.leftFilePath, text: args.leftText, jsonc: args.jsonc }).parsed;
  const b = readInput({ filePath: args.rightFilePath, text: args.rightText, jsonc: args.jsonc }).parsed;
  const sa = JSON.stringify(sortedKeysDeep(a), null, 2);
  const sb = JSON.stringify(sortedKeysDeep(b), null, 2);
  const equal = sa === sb;
  const leftLines = sa.split("\n");
  const rightLines = sb.split("\n");
  const diffs = [];
  const max = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < max; i++) {
    const L = leftLines[i];
    const R = rightLines[i];
    if (L !== R) {
      diffs.push({ line: i + 1, left: L ?? null, right: R ?? null });
      if (diffs.length >= (args.maxDiffs ?? 100)) break;
    }
  }
  return { equal, leftLines: leftLines.length, rightLines: rightLines.length, diffs };
}

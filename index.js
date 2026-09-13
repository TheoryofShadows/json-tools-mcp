#!/usr/bin/env node
/**
 * @mcpx-digital/json-tools — MCP server for local JSON/JSONC utilities.
 *
 * Tools: validate_json, validate_jsonc, json_get, json_set, pretty_json,
 * minify_json, schema_validate, diff_json
 *
 * Local files and strings only — no network access.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  validateJson,
  validateJsonc,
  jsonGet,
  jsonSet,
  prettyJson,
  minifyJson,
  schemaValidate,
  diffJson,
} from "./lib.js";

const LOCAL =
  "Local files/strings only. Does not fetch URLs or contact external services.";

const fileOrText = {
  filePath: { type: "string", description: "Local JSON/JSONC file path." },
  text: { type: "string", description: "Raw JSON/JSONC string (alternative to filePath)." },
};

const TOOLS = [
  {
    name: "validate_json",
    description: "Parse and validate strict JSON. " + LOCAL,
    inputSchema: { type: "object", properties: { ...fileOrText } },
  },
  {
    name: "validate_jsonc",
    description: "Parse JSONC (comments + trailing commas) and validate. " + LOCAL,
    inputSchema: { type: "object", properties: { ...fileOrText } },
  },
  {
    name: "json_get",
    description: "Get a value at a jq-like path (e.g. .foo.bar[0]). " + LOCAL,
    inputSchema: {
      type: "object",
      properties: { ...fileOrText, path: { type: "string", description: "Path like .a.b[0]" } },
      required: ["path"],
    },
  },
  {
    name: "json_set",
    description: "Set a value at a jq-like path; returns updated JSON (optionally write file). " + LOCAL,
    inputSchema: {
      type: "object",
      properties: {
        ...fileOrText,
        path: { type: "string" },
        value: {},
        parseValue: { type: "boolean", description: "If value is a string, try JSON.parse." },
        outputPath: { type: "string" },
        minify: { type: "boolean" },
        indent: { type: "number" },
      },
      required: ["path"],
    },
  },
  {
    name: "pretty_json",
    description: "Pretty-print JSON with indentation. " + LOCAL,
    inputSchema: {
      type: "object",
      properties: { ...fileOrText, indent: { type: "number" }, outputPath: { type: "string" } },
    },
  },
  {
    name: "minify_json",
    description: "Minify JSON to one line. " + LOCAL,
    inputSchema: {
      type: "object",
      properties: { ...fileOrText, outputPath: { type: "string" } },
    },
  },
  {
    name: "schema_validate",
    description: "Validate JSON data against a JSON Schema using Ajv. " + LOCAL,
    inputSchema: {
      type: "object",
      properties: {
        dataFilePath: { type: "string" },
        dataText: { type: "string" },
        schemaFilePath: { type: "string" },
        schemaText: { type: "string" },
        jsonc: { type: "boolean" },
      },
    },
  },
  {
    name: "diff_json",
    description: "Diff two JSON documents (canonical key-sorted stringify, line-oriented). " + LOCAL,
    inputSchema: {
      type: "object",
      properties: {
        leftFilePath: { type: "string" },
        leftText: { type: "string" },
        rightFilePath: { type: "string" },
        rightText: { type: "string" },
        jsonc: { type: "boolean" },
        maxDiffs: { type: "number" },
      },
    },
  },
];

const handlers = {
  validate_json: validateJson,
  validate_jsonc: validateJsonc,
  json_get: jsonGet,
  json_set: jsonSet,
  pretty_json: prettyJson,
  minify_json: minifyJson,
  schema_validate: schemaValidate,
  diff_json: diffJson,
};

const server = new Server(
  { name: "json-tools", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  const handler = handlers[name];
  if (!handler) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await handler(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

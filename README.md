# @mcpx-digital/json-tools

**MCP server for everyday JSON/JSONC work on local files and strings.**

Validate JSON or JSONC, get/set values with jq-like paths, pretty-print or minify, validate against JSON Schema (Ajv), and diff two documents — from Cursor or any MCP client.

> **Local only.** Tools accept file paths or inline strings. They do **not** fetch URLs, scrape the web, or call external APIs.

## Install (MCPX / npx)

```bash
npx -y @mcpx-digital/json-tools
```

> Prepared for npm as `@mcpx-digital/json-tools`. Until published, run from a local clone.

## Cursor `mcp.json` example

```json
{
  "mcpServers": {
    "json-tools": {
      "command": "npx",
      "args": ["-y", "@mcpx-digital/json-tools"]
    }
  }
}
```

Local clone:

```json
{
  "mcpServers": {
    "json-tools": {
      "command": "node",
      "args": ["/absolute/path/to/json-tools-mcp/index.js"]
    }
  }
}
```

## Tools

| Tool | What it does |
|------|----------------|
| `validate_json` | Strict JSON parse/validate |
| `validate_jsonc` | JSONC (comments + trailing commas) |
| `json_get` | Get value at `.foo.bar[0]`-style path |
| `json_set` | Set value at path (optional write) |
| `pretty_json` | Pretty-print |
| `minify_json` | Minify |
| `schema_validate` | Ajv JSON Schema validation |
| `diff_json` | Line-oriented diff of two JSON docs |

## Example prompts

- “Validate this JSONC config and pretty-print it”
- “Get `.dependencies.react` from package.json”
- “Diff these two API response fixtures”
- “Validate data.json against schema.json”

## Development

```bash
git clone https://github.com/TheoryofShadows/json-tools-mcp.git
cd json-tools-mcp
npm install
npm test
node index.js
```

## Sell / list on MCPX

Suggested listing price: **$7**.

Install command: `npx -y @mcpx-digital/json-tools`

## License

MIT © TheoryofShadows

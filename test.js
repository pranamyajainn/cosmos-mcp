// Connects to the server like Claude does and runs a few live searches.
//   node test.js                 → local version over stdio (Claude Code, desktop app)
//   node test.js http            → web version, served from api/mcp.js on a local port
//   node test.js https://…/mcp   → a deployed web version
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";
import http from "node:http";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
let transport;
let localServer;
if (!mode) {
  transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("./server.js", import.meta.url))] });
} else if (mode === "http") {
  // Small Node → Web Request bridge, standing in for Vercel.
  const { handle } = await import("./api/mcp.js");
  localServer = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const response = await handle(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((r) => localServer.listen(0, r));
  transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${localServer.address().port}/mcp`));
} else {
  transport = new StreamableHTTPClientTransport(new URL(mode));
}
console.log(`testing: ${mode || "stdio"}`);

const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
assert.deepEqual(tools.map((t) => t.name), ["search_cosmos"]);

const call = async (args) => {
  const res = await client.callTool({ name: "search_cosmos", arguments: args });
  assert.ok(!res.isError, res.content[0].text);
  return { data: JSON.parse(res.content[0].text), images: res.content.filter((c) => c.type === "image") };
};

// 1. Default search returns motion only, with previews.
const a = await call({ query: "kinetic typography", limit: 8 });
assert.ok(a.data.results.length > 0, "no results");
assert.ok(a.data.results.every((r) => ["video", "gif"].includes(r.kind)), "non-motion result in motion search");
assert.ok(a.data.results.every((r) => r.cosmos_url.startsWith("https://www.cosmos.so/e/")));
assert.ok(a.images.length > 0, "no previews");
console.log(`motion search: ${a.data.results.length} results, ${a.images.length} previews, ${a.data.total_matches} total`);
console.log("  first:", a.data.results[0]);

// 2. Paging gives new results.
const b = await call({ query: "kinetic typography", limit: 8, cursor: a.data.next_cursor, show_previews: false });
const overlap = b.data.results.filter((r) => a.data.results.some((x) => x.id === r.id));
assert.equal(overlap.length, 0, "page 2 repeats page 1");
assert.equal(b.images.length, 0);
console.log(`page 2: ${b.data.results.length} new results`);

// 3. Images, sort and colour filters are accepted.
const c = await call({ query: "brutalist poster", type: "image", sort: "popular", color: "ff3300", limit: 5, show_previews: false });
assert.ok(c.data.results.every((r) => r.kind === "image"));
console.log(`image + popular + colour: ${c.data.results.length} results`);

// 4. Bad input is rejected before it reaches Cosmos.
const bad = await client.callTool({ name: "search_cosmos", arguments: { query: "x", limit: 99 } });
assert.ok(bad.isError);
console.log("limit 99 rejected");

await client.close();
localServer?.close();
console.log("ALL PASSED");

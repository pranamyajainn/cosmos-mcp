// Web version: claude.ai connects to https://<your-app>.vercel.app/mcp, which Vercel serves from this file.
// Stateless: every request gets a fresh server, so it fits serverless hosting.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../tools.js";

export async function handle(request) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await createServer().connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

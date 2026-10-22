import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { search, fetchPreview, TYPES, SORTS } from "./cosmos.js";

// Builds the MCP server with the search_cosmos tool. Used by both the local (stdio) and web (HTTP) versions.
export function createServer() {
  const server = new McpServer({ name: "cosmos", version: "1.0.0" });

  server.registerTool(
    "search_cosmos",
    {
      title: "Search Cosmos",
      description:
        "Search cosmos.so, a visual inspiration library, for motion graphics, animations, GIFs and images. " +
        "Cosmos search is visual and semantic, so describe what it should look like " +
        "(e.g. 'kinetic typography black and white', 'liquid chrome 3D loop', 'isometric UI animation'), not just a single word. " +
        "By default it returns motion only (videos and GIFs) with small preview images so you can judge which results fit. " +
        "Run a few different phrasings and pick the best results for the user; always give them the cosmos_url for each pick.",
      inputSchema: {
        query: z.string().min(1).describe("What to look for, in plain words"),
        type: z.enum(Object.keys(TYPES)).default("motion").describe("motion = videos and GIFs, image = still images, all = everything"),
        sort: z.enum(Object.keys(SORTS)).default("relevant").describe("Result order"),
        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
          .describe("Hex colour to bias results toward, e.g. #ff3300"),
        limit: z.number().int().min(1).max(40).default(12).describe("Number of results (max 40)"),
        cursor: z.string().optional().describe("next_cursor from a previous call, to get the next page"),
        show_previews: z.boolean().default(true).describe("Attach a small preview image for each result so you can see it"),
      },
    },
    async ({ query, type, sort, color, limit, cursor, show_previews }) => {
      let data;
      try {
        data = await search({ query, type, sort, color: color && (color.startsWith("#") ? color : `#${color}`), limit, cursor });
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Cosmos search failed: ${err.message}` }] };
      }

      const content = [
        {
          type: "text",
          text: JSON.stringify(
            { query, type, total_matches: data.total, returned: data.results.length, next_cursor: data.next_cursor, results: data.results },
            null,
            2,
          ),
        },
      ];

      if (show_previews && data.results.length) {
        const previews = await Promise.all(data.results.map((r) => fetchPreview(r.preview_url)));
        data.results.forEach((r, i) => {
          if (!previews[i]) return;
          content.push({ type: "text", text: `Preview #${i + 1} (id ${r.id}, ${r.kind})` });
          content.push({ type: "image", data: previews[i], mimeType: "image/jpeg" });
        });
      }

      return { content };
    },
  );

  return server;
}

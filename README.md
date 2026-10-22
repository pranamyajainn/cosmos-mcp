# Cosmos MCP

This server lets Claude search [cosmos.so](https://www.cosmos.so) for motion graphics, GIFs and images.

Flow: you ask Claude → Claude calls `search_cosmos` → server queries Cosmos → Claude gets results plus small preview images → Claude picks the best ones and gives you the Cosmos links.

## What the tool does

One tool: `search_cosmos`.

| Input | Default | Meaning |
|---|---|---|
| `query` | (required) | What to find, in plain words. Describe the look, for example "liquid chrome 3D loop". |
| `type` | `motion` | `motion` = videos and GIFs. `image` = still images. `all` = everything. |
| `sort` | `relevant` | `relevant`, `popular`, `latest`, `oldest`, `random`. |
| `color` | none | Hex colour to bias results, for example `#ff3300`. |
| `limit` | 12 | Results per call. Maximum 40. |
| `cursor` | none | `next_cursor` from the last call. Use it to get the next page. |
| `show_previews` | true | Attach a small JPEG preview for each result, so Claude can see it. |

Each result has: `cosmos_url`, `kind` (video, gif, image), `caption`, `creator`, `creator_url`, `source_url`, `video_url` (direct MP4), `preview_url`, size, and duration.

## Setup

You need Node.js 18 or newer.

1. Get the code and install the dependencies:

   ```bash
   git clone https://github.com/pranamyajainn/cosmos-mcp.git
   cd cosmos-mcp && npm install
   ```

   In the steps below, replace `/ABSOLUTE/PATH/TO/cosmos-mcp` with the full path of this folder. To see it, run `pwd`.

2. Check that it works. This runs live searches against Cosmos:

   ```bash
   npm test
   ```

   You must see `ALL PASSED`.

### Connect to Claude Code

```bash
claude mcp add cosmos --scope user -- node /ABSOLUTE/PATH/TO/cosmos-mcp/server.js
```

### Connect to the Claude desktop app

1. Open Claude → Settings → Developer → Edit Config. This opens `claude_desktop_config.json`.
2. Add this block. If `mcpServers` already exists, add only the `cosmos` entry inside it.

   ```json
   {
     "mcpServers": {
       "cosmos": {
         "command": "/usr/local/bin/node",
         "args": ["/ABSOLUTE/PATH/TO/cosmos-mcp/server.js"]
       }
     }
   }
   ```

   Use the full path to `node`. The desktop app does not always see your shell PATH. To find it, run `which node`.

3. Quit Claude fully and open it again.

## How to ask

- "Find me 5 kinetic typography loops on Cosmos, black and white, for a product launch reel."
- "Search Cosmos for isometric UI animations. Show me the 3 best and say why."
- "Find popular liquid metal 3D motion on Cosmos with a blue tone."

Claude does better when it runs 2 or 3 different phrasings and compares the previews. The tool description tells it to do this.

## Limits

- Cosmos has no official public API. This server uses the same public endpoint the Cosmos website uses. No login is needed. If Cosmos changes that endpoint, the server can stop working. Run `npm test` to check.
- Search only. It cannot read your private clusters or save items to your account.
- It hides media that Cosmos marks as not safe, the same as the Cosmos website.
- The work belongs to its creators. Use `creator` and `source_url` for credit, and check rights before you use anything in client work.

## Files

- `server.js`: the MCP server and the `search_cosmos` tool.
- `cosmos.js`: the Cosmos query and result clean-up.
- `test.js`: end-to-end test. It starts the server like Claude does and runs live searches.

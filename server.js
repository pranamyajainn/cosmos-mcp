#!/usr/bin/env node
// Local version: Claude Code and the Claude desktop app start this and talk to it over stdio.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";

await createServer().connect(new StdioServerTransport());

import { DB } from "./db.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readFileSync } from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDir = resolve(__dirname, "..");
const instructions = readFileSync(join(parentDir, "instructions.md"), "utf-8");
const ToolInputSchema = ToolSchema.shape.inputSchema;
var ToolName;
(function (ToolName) {
    ToolName["TEST"] = "test";
})(ToolName || (ToolName = {}));
;
const db = (() => {
    try {
        return new DB();
    }
    catch (error) {
        console.error(`Error in creating db driver: ${error}`);
        process.exit(1);
    }
})();
export const createServer = () => {
    const server = new Server({
        name: "msm-mcp_server",
        title: "MSM (Metada Snippet Manager) MCP server",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: {}
        },
        instructions
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = [
            {
                name: ToolName.TEST,
                description: "Tests db connection",
                inputSchema: zodToJsonSchema(z.object({}))
            }
        ];
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (name === ToolName.TEST) {
            const res = await db.test();
            return {
                content: [{ type: "text", text: `Test returned ${res}` }]
            };
        }
        throw new Error(`Unknown tool: ${name}`);
    });
    return { server };
};
async function main() {
    const transport = new StdioServerTransport();
    const { server } = createServer();
    await server.connect(transport);
    console.error("MSM MCP-server started");
    process.on("SIGINT", async () => {
        await server.close();
        process.exit(0);
    });
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});

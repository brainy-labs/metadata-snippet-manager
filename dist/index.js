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
const TestAddFileSchema = z.object({
    name: z.string().max(30).describe("Name of file to add"),
    content: z.string().max(500).describe("Content of file")
});
const TestReadFileSchema = z.object({
    name: z.string().describe("Name of file to read")
});
const TestRemoveFileSchema = z.object({
    name: z.string().describe("Name of file to read")
});
var ToolName;
(function (ToolName) {
    ToolName["TEST_DB"] = "test_db";
    ToolName["TEST_ADD_FILE"] = "test_add_file";
    ToolName["TEST_READ_FILE"] = "test_read_file";
    ToolName["TEST_REMOVE_FILE"] = "test_remove_file";
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
                name: ToolName.TEST_DB,
                description: "Tests db connection",
                inputSchema: zodToJsonSchema(z.object({}))
            },
            {
                name: ToolName.TEST_ADD_FILE,
                description: "Test add a file in storage and db",
                inputSchema: zodToJsonSchema(TestAddFileSchema)
            },
            {
                name: ToolName.TEST_READ_FILE,
                description: "Test read a file in storage and db",
                inputSchema: zodToJsonSchema(TestReadFileSchema)
            },
            {
                name: ToolName.TEST_REMOVE_FILE,
                description: "Test remove a file in storage and db",
                inputSchema: zodToJsonSchema(TestRemoveFileSchema)
            },
        ];
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (name === ToolName.TEST_DB) {
            const res = await db.test_db_connection();
            return {
                content: [{ type: "text", text: `Test returned ${res}` }]
            };
        }
        if (name === ToolName.TEST_ADD_FILE) {
            const validatedArgs = TestAddFileSchema.parse(args);
            let text = `Failed to add file`;
            try {
                await db.test_add_file(validatedArgs.name, validatedArgs.content);
                text = `
                    Success! \n
                    File added: \n
                    - name: ${validatedArgs.name}, \n
                    - content: ${validatedArgs.content}, \n
                `;
            }
            finally {
                return {
                    content: [
                        {
                            type: "text",
                            text: text
                        }
                    ]
                };
            }
        }
        if (name === ToolName.TEST_READ_FILE) {
            const validatedArgs = TestReadFileSchema.parse(args);
            let text = `Failed to read file`;
            try {
                const res = await db.test_read_file(validatedArgs.name);
                if (res === undefined)
                    text = `Non-existent file`;
                else {
                    text = `Success! \n File: \n - name: ${validatedArgs.name} - content: ${res}`;
                }
            }
            finally {
                return {
                    content: [
                        {
                            type: "text",
                            text: text
                        }
                    ]
                };
            }
        }
        if (name === ToolName.TEST_REMOVE_FILE) {
            const validatedArgs = TestReadFileSchema.parse(args);
            let text = `Failed to remove file`;
            try {
                await db.test_remove_file(validatedArgs.name);
                text = `Success! \n File: \n - name: ${validatedArgs.name}`;
            }
            finally {
                return {
                    content: [
                        {
                            type: "text",
                            text: text
                        }
                    ]
                };
            }
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

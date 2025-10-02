import { DB } from "./db.js";
import { CreateMetadataSchema, CreateSnippetSchema } from "./schemas.js";
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
// Schemas for MCP only
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
    ToolName["CLEAR"] = "clear";
    ToolName["CREATE_METADATA"] = "create_metadata";
    ToolName["CREATE_SNIPPET"] = "create_snippet";
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
        instructions,
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
            {
                name: ToolName.CLEAR,
                description: "Clear all data",
                inputSchema: zodToJsonSchema(z.object({}))
            },
            {
                name: ToolName.CREATE_METADATA,
                description: "Create a metadata",
                inputSchema: zodToJsonSchema(CreateMetadataSchema)
            },
            {
                name: ToolName.CREATE_SNIPPET,
                description: "Create a snippet with metadata",
                inputSchema: zodToJsonSchema(CreateSnippetSchema)
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
        if (name === ToolName.CLEAR) {
            try {
                await db.clear();
            }
            finally {
                return { content: [{ type: "text", text: "db and storage cleared" }] };
            }
        }
        if (name === ToolName.CREATE_METADATA) {
            const metadata = CreateMetadataSchema.parse(args);
            let text = `Failed to create metadata`;
            try {
                const res = await db.createMetadata(metadata);
                text = `Success! \n ${metadata.name} added:\n
                            - category: ${metadata.category}`;
                return {
                    content: [
                        {
                            type: "text",
                            text: text
                        },
                    ]
                };
            }
            catch (error) {
                return { content: [{ type: "text", test: text + error }] };
            }
        }
        if (name === ToolName.CREATE_SNIPPET) {
            const snippet = CreateSnippetSchema.parse(args);
            let text = `Failed to create snippet`;
            try {
                const res = await db.createSnippet(snippet);
                text = `Success! \n ${snippet.name} added:\n
                        - content: ${snippet.content}\n
                        - extension: ${snippet.extension}\n
                        - metadata: ${snippet.metadataNames}\n`;
                return {
                    content: [
                        {
                            type: "text",
                            text: text
                        },
                    ]
                };
            }
            catch (error) {
                return { content: [{ type: "text", test: text + error }] };
            }
        }
        throw new Error(`Unknown tool: ${name}`);
    });
    return { server };
};
async function main(db) {
    const transport = new StdioServerTransport();
    const { server } = createServer();
    await server.connect(transport);
    console.error("MSM MCP-server started");
    process.on("SIGINT", async () => {
        await db.close();
        await server.close();
        process.exit(0);
    });
}
main(db).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});

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
    ToolName["GET_ALL_SNIPPETS"] = "get_all_snippets";
    ToolName["GET_ALL_METADATA"] = "get_all_metadata";
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
            {
                name: ToolName.GET_ALL_SNIPPETS,
                description: "Get all snippets",
                inputSchema: zodToJsonSchema(z.object({}))
            },
            {
                name: ToolName.GET_ALL_METADATA,
                description: "Get all metadata",
                inputSchema: zodToJsonSchema(z.object({}))
            }
        ];
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (name === ToolName.TEST_DB) {
            try {
                const res = await db.test_db_connection();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: `Test returned ${res}` })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'DB test failed' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.TEST_ADD_FILE) {
            const validatedArgs = TestAddFileSchema.parse(args);
            try {
                await db.test_add_file(validatedArgs.name, validatedArgs.content);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: `File added: ${validatedArgs.name}` })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to add file' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.TEST_READ_FILE) {
            const validatedArgs = TestReadFileSchema.parse(args);
            try {
                const res = await db.test_read_file(validatedArgs.name);
                if (!res) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ success: false, error: 'Non-existent file' })
                            }
                        ]
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: res })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to read file' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.TEST_REMOVE_FILE) {
            const validatedArgs = TestRemoveFileSchema.parse(args);
            try {
                await db.test_remove_file(validatedArgs.name);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: `File removed: ${validatedArgs.name}` })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to remove file' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.CLEAR) {
            try {
                await db.clear();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: 'DB and storage cleared' })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to clear DB' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.CREATE_METADATA) {
            const metadata = CreateMetadataSchema.parse(args);
            try {
                await db.createMetadata(metadata);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: `Metadata added: ${metadata.name} (category: ${metadata.category})` })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to create metadata' })
                        }
                    ]
                };
            }
        }
        // TODO: better error handling
        if (name === ToolName.CREATE_SNIPPET) {
            const snippet = CreateSnippetSchema.parse(args);
            try {
                const res = await db.createSnippet(snippet);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                content: {
                                    name: res.name,
                                    metadata: snippet.metadataNames,
                                    category: snippet.category,
                                    extension: snippet.extension,
                                    size: res.size,
                                }
                            })
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to create snippet' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.GET_ALL_SNIPPETS) {
            try {
                const res = await db.getAllSnippets();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: res }, null, 2)
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to get snippets' })
                        }
                    ]
                };
            }
        }
        if (name === ToolName.GET_ALL_METADATA) {
            try {
                const res = await db.getAllMetadata();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, content: res }, null, 2)
                        }
                    ]
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: false, error: error.message || 'Failed to get metadata' })
                        }
                    ]
                };
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

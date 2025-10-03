import { DB } from "./db.js";
import { CreateMetadataSchema, CreateSnippetSchema, DeleteMetadataSchema, DeleteSnippetsSchema, updateSnippetContentSchema } from "./schemas.js";
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
    ToolName["TEST_DB"] = "test_db";
    ToolName["CLEAR"] = "clear";
    ToolName["GET_ALL_SNIPPETS"] = "get_all_snippets";
    ToolName["GET_ALL_METADATA"] = "get_all_metadata";
    ToolName["CREATE_METADATA"] = "create_metadata";
    ToolName["CREATE_SNIPPET"] = "create_snippet";
    ToolName["DELETE_METADATA"] = "delete_metadata";
    ToolName["DELETE_SNIPPETS"] = "delete_snippets";
    ToolName["UPDATE_SNIPPET_CONTENT"] = "update_snippet_content";
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
            },
            {
                name: ToolName.DELETE_METADATA,
                description: "Delete metadata",
                inputSchema: zodToJsonSchema(DeleteMetadataSchema)
            },
            {
                name: ToolName.DELETE_SNIPPETS,
                description: "Delete snippets",
                inputSchema: zodToJsonSchema(DeleteSnippetsSchema)
            },
            {
                name: ToolName.UPDATE_SNIPPET_CONTENT,
                description: "Update snippet content",
                inputSchema: zodToJsonSchema(updateSnippetContentSchema)
            }
        ];
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (name === ToolName.TEST_DB) {
            try {
                const res = await db.test_db_connection();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: `Test returned ${res}` }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'DB test failed' }) }] };
            }
        }
        if (name === ToolName.CLEAR) {
            try {
                await db.clear();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: 'DB and storage cleared' }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to clear DB' }) }] };
            }
        }
        if (name === ToolName.CREATE_METADATA) {
            const metadata = CreateMetadataSchema.parse(args);
            try {
                await db.createMetadata(metadata);
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: `Metadata added: ${metadata.name} (category: ${metadata.category})` }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to create metadata' }) }] };
            }
        }
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
                    content: [{ type: "text", text: JSON.stringify({ success: false, error: error || 'Failed to create snippet' }) }]
                };
            }
        }
        if (name === ToolName.GET_ALL_SNIPPETS) {
            try {
                const res = await db.getAllSnippets();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }, null, 2) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to get snippets' }) }] };
            }
        }
        if (name === ToolName.GET_ALL_METADATA) {
            try {
                const res = await db.getAllMetadata();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }, null, 2) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to get metadata' }) }] };
            }
        }
        if (name === ToolName.DELETE_METADATA) {
            const names = DeleteMetadataSchema.parse(args);
            try {
                await db.deleteMetadataByName(names);
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: "Metadata deleted" }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, content: error || 'Failed to delete metadata' }) }] };
            }
        }
        if (name === ToolName.DELETE_SNIPPETS) {
            const names = DeleteSnippetsSchema.parse(args);
            try {
                await db.deleteSnippetsByName(names);
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: "Snippets deleted" }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, content: "Failed to delete snippets" }) }] };
            }
        }
        if (name === ToolName.UPDATE_SNIPPET_CONTENT) {
            const validatedArgs = updateSnippetContentSchema.parse(args);
            try {
                const res = await db.updateSnippetContent(validatedArgs);
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: error.message }) }] };
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

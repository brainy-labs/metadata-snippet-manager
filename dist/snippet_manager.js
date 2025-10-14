import { AddMetadataParentSchema, CreateMetadataForestSchema, CreateMetadataSchema, CreateMetadataSubtreeSchema, CreateMetadataTreeSchema, CreateSnippetSchema, DeleteMetadataSchema, DeleteSnippetsSchema, GetMetadataForestSchema, GetMetadataPathSchema, GetMetadataSiblingsForestSchema, GetMetadataSiblingsSchema, GetMetadataTreeSchema, PruneMetadataBranchSchema, SearchSnippetByNameSchema, UpdateSnippetContentSchema } from "./schemas.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
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
    ToolName["SEARCH_SNIPPET_BY_NAME"] = "search_snippet_by_name";
    ToolName["GET_METADATA_TREE"] = "get_metadata_tree";
    ToolName["CREATE_METADATA_TREE"] = "create_metadata_tree";
    ToolName["CREATE_METADATA_SUBTREE"] = "create_metadata_subtree";
    ToolName["GET_METADATA_SIBLINGS"] = "get_metadata_siblings";
    ToolName["CREATE_METADATA_FOREST"] = "create_metadata_forest";
    ToolName["GET_METADATA_FOREST"] = "get_metadata_forest";
    ToolName["GET_WHOLE_METADATA_FOREST"] = "get_whole_metadata_forest";
    ToolName["GET_METADATA_PATH"] = "get_metadata_path";
    ToolName["GET_METADATA_SIBLINGS_FOREST"] = "get_metadata_siblings_forest";
    ToolName["ADD_METADATA_PARENT"] = "add_metadata_parent";
    ToolName["PRUNE_METADATA_BRANCH"] = "prune_metadata_branch";
})(ToolName || (ToolName = {}));
async function handleTool(schema, args, dbMethod, errorMessage) {
    const validatedArgs = schema.parse(args);
    try {
        const res = await dbMethod(validatedArgs);
        return {
            content: [
                { type: "text", text: JSON.stringify({ success: true, content: res }) }
            ]
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ success: false, error: error.message || errorMessage })
                }
            ]
        };
    }
}
export const createServer = (db) => {
    const server = new Server({
        name: "msm-mcp_server",
        title: "MSM (Metada Snippet Manager) MCP server",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: {},
            resources: {
                list: true,
                read: true
            }
        },
        instructions,
    });
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                { uri: "metadata://all", name: "All Metadata", description: "List of all metadata" },
                { uri: "snippets://all", name: "All Snippets", description: "List of all snippets" }
            ]
        };
    });
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;
        if (uri === "metadata://all") {
            const res = await db.getAllMetadata();
            return {
                contents: [
                    { uri, mimeType: "application/json", text: JSON.stringify(res, null, 2) }
                ]
            };
        }
        if (uri === "snippets://all") {
            const res = await db.getAllSnippets();
            return {
                contents: [
                    { uri, mimeType: "application/json", text: JSON.stringify(res, null, 2) }
                ]
            };
        }
        throw new Error(`Unknown resource: ${uri}`);
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = [
            { name: ToolName.TEST_DB, description: "Tests db connection", inputSchema: zodToJsonSchema(z.object({})) },
            { name: ToolName.CLEAR, description: "Clear all data", inputSchema: zodToJsonSchema(z.object({})) },
            { name: ToolName.CREATE_METADATA, description: "Create a metadata. Insert the name, the category (concept or language) and the parent", inputSchema: zodToJsonSchema(CreateMetadataSchema) },
            { name: ToolName.CREATE_SNIPPET, description: "Create a snippet with metadata. All metadata have the same category. The name has to be lowercase, no spaces, ending with the extension (for example .py)", inputSchema: zodToJsonSchema(CreateSnippetSchema) },
            { name: ToolName.GET_ALL_SNIPPETS, description: "Get all snippets in list form. All snippets have a list of metadata and a category", inputSchema: zodToJsonSchema(z.object({})) },
            { name: ToolName.GET_ALL_METADATA, description: "Get all metadata in list fortm. All metadata have a category and a parent of the same category.", inputSchema: zodToJsonSchema(z.object({})) },
            { name: ToolName.DELETE_METADATA, description: "Delete some metadata.", inputSchema: zodToJsonSchema(DeleteMetadataSchema) },
            { name: ToolName.DELETE_SNIPPETS, description: "Delete some snippets.", inputSchema: zodToJsonSchema(DeleteSnippetsSchema) },
            { name: ToolName.UPDATE_SNIPPET_CONTENT, description: "Update a snippet content.", inputSchema: zodToJsonSchema(UpdateSnippetContentSchema) },
            { name: ToolName.SEARCH_SNIPPET_BY_NAME, description: "Get snippet searching by name.", inputSchema: zodToJsonSchema(SearchSnippetByNameSchema) },
            { name: ToolName.GET_METADATA_TREE, description: "Get a metadata tree by the root name.", inputSchema: zodToJsonSchema(GetMetadataTreeSchema) },
            { name: ToolName.CREATE_METADATA_TREE, description: "Create a metadata tree.", inputSchema: zodToJsonSchema(CreateMetadataTreeSchema) },
            { name: ToolName.CREATE_METADATA_SUBTREE, description: "Create a metadata tree from a given existing metadata root.", inputSchema: zodToJsonSchema(CreateMetadataSubtreeSchema) },
            { name: ToolName.GET_METADATA_SIBLINGS, description: "Get siblings of a metadata (All metadata with the same father).", inputSchema: zodToJsonSchema(GetMetadataSiblingsSchema) },
            { name: ToolName.CREATE_METADATA_FOREST, description: "Create a metadata forest", inputSchema: zodToJsonSchema(CreateMetadataForestSchema) },
            { name: ToolName.GET_METADATA_FOREST, description: "Get a metadata forest by root names", inputSchema: zodToJsonSchema(GetMetadataForestSchema) },
            { name: ToolName.GET_WHOLE_METADATA_FOREST, description: "Get all metadata in the forest form", inputSchema: zodToJsonSchema(z.object({})) },
            { name: ToolName.GET_METADATA_PATH, description: "Get the path from the root to the specified metadata", inputSchema: zodToJsonSchema(GetMetadataPathSchema) },
            { name: ToolName.GET_METADATA_SIBLINGS_FOREST, description: "Get a forest which roots are all siblings of the specified metadata item (metadata item in input included)", inputSchema: zodToJsonSchema(GetMetadataSiblingsForestSchema) },
            { name: ToolName.ADD_METADATA_PARENT, description: "Add a parent to a specified metadata item (that item can't have other parents and has to be of the same category of the new parent)", inputSchema: zodToJsonSchema(AddMetadataParentSchema) },
            { name: ToolName.PRUNE_METADATA_BRANCH, description: "Remove relationship between a metadata parent and a metadata child. The child becomes a root.", inputSchema: zodToJsonSchema(PruneMetadataBranchSchema) },
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
            return await handleTool(CreateMetadataSchema, args, db.createMetadata.bind(db), "Failed to create metadata");
        }
        if (name === ToolName.CREATE_SNIPPET) {
            return await handleTool(CreateSnippetSchema, args, db.createSnippet.bind(db), "Failed to create snippet");
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
        if (name === ToolName.DELETE_METADATA)
            return await handleTool(DeleteMetadataSchema, args, db.deleteMetadataByName.bind(db), "Failed to delete metadata");
        if (name === ToolName.DELETE_SNIPPETS)
            return await handleTool(DeleteSnippetsSchema, args, db.deleteSnippetsByName.bind(db), "Failed to delete snippets");
        if (name === ToolName.UPDATE_SNIPPET_CONTENT)
            return await handleTool(UpdateSnippetContentSchema, args, db.updateSnippetContent.bind(db), "Failed to update snippet");
        if (name === ToolName.SEARCH_SNIPPET_BY_NAME)
            return await handleTool(SearchSnippetByNameSchema, args, db.searchSnippetByName.bind(db), "Failed to search snippet");
        if (name === ToolName.GET_METADATA_TREE)
            return await handleTool(GetMetadataTreeSchema, args, db.getMetadataTree.bind(db), "Failed to get metadata tree");
        if (name === ToolName.CREATE_METADATA_TREE)
            return await handleTool(CreateMetadataTreeSchema, args, db.createMetadataTree.bind(db), "Failed to create metadata tree");
        if (name === ToolName.CREATE_METADATA_SUBTREE)
            return await handleTool(CreateMetadataSubtreeSchema, args, db.createMetadataSubtree.bind(db), "Failed to create metadata subtree");
        if (name === ToolName.GET_METADATA_SIBLINGS)
            return await handleTool(GetMetadataSiblingsSchema, args, db.getMetadataSiblings.bind(db), "Failed to get metadata siblings");
        if (name === ToolName.CREATE_METADATA_FOREST) {
            const validatedArgs = CreateMetadataForestSchema.parse(args);
            const res = await db.createMetadataForest(validatedArgs);
            return { content: [{ type: "text", text: JSON.stringify(res) }] };
        }
        if (name === ToolName.GET_METADATA_FOREST)
            return await handleTool(GetMetadataForestSchema, args, db.getMetadataForest.bind(db), "Failed to get metadata forest");
        if (name === ToolName.GET_WHOLE_METADATA_FOREST) {
            try {
                const res = await db.getWholeMetadataForest();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }, null, 2) }] };
            }
            catch (error) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to get whole metadata forest' }) }] };
            }
        }
        if (name === ToolName.GET_METADATA_PATH)
            return await handleTool(GetMetadataPathSchema, args, db.getMetadataPath.bind(db), "Failed to get metadata path");
        if (name === ToolName.GET_METADATA_SIBLINGS_FOREST)
            return await handleTool(GetMetadataSiblingsForestSchema, args, db.getMetadataSiblingsForest.bind(db), "Failed to get metadata siblings forest");
        if (name === ToolName.ADD_METADATA_PARENT)
            return await handleTool(AddMetadataParentSchema, args, db.addMetadataParent.bind(db), "Failed to add parent to metadata item");
        if (name === ToolName.PRUNE_METADATA_BRANCH)
            return await handleTool(PruneMetadataBranchSchema, args, db.pruneMetadataBranch.bind(db), "Failed to prune branch");
        throw new Error(`Unknown tool: ${name}`);
    });
    return { server };
};

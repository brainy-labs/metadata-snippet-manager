import { DB } from "./db.js";
import { 
    AddMetadataParentSchema,
    CreateMetadataForestSchema,
    CreateMetadataSchema, 
    CreateMetadataSubtreeSchema, 
    CreateMetadataTreeSchema, 
    CreateSnippetSchema,
    DeleteMetadataSchema,
    DeleteSnippetsSchema,
    GetMetadataForestSchema,
    GetMetadataPathSchema,
    GetMetadataSiblingsForestSchema,
    GetMetadataSiblingsSchema,
    GetMetadataTreeSchema,
    GetSnippetsByMetadataSchema,
    PruneMetadataBranchSchema,
    RenameMetadataSchema,
    SearchSnippetByNameSchema,
    UpdateSnippetContentSchema,
    UpdateSnippetMetadataSchema
} from "./schemas.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema, 
    ReadResourceRequestSchema, 
    Tool, 
    ToolSchema 
} from "@modelcontextprotocol/sdk/types.js";
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
type ToolInput = z.infer<typeof ToolInputSchema>;

enum ToolName {
    // TEST_DB = "test_db",
    // CLEAR = "clear",
    CLEAR_CONSTRAINTS = "clear_constraints",
    // GET_ALL_SNIPPETS = "get_all_snippets",
    // GET_ALL_METADATA = "get_all_metadata",
    CREATE_METADATA = "create_metadata",
    CREATE_SNIPPET = "create_snippet",
    DELETE_METADATA = "delete_metadata",
    DELETE_SNIPPETS = "delete_snippets",
    UPDATE_SNIPPET_CONTENT = "update_snippet_content",
    SEARCH_SNIPPET_BY_NAME = "search_snippet_by_name",
    GET_METADATA_TREE = "get_metadata_tree",
    CREATE_METADATA_TREE = "create_metadata_tree",
    CREATE_METADATA_SUBTREE = "create_metadata_subtree",
    GET_METADATA_SIBLINGS = "get_metadata_siblings",
    CREATE_METADATA_FOREST = "create_metadata_forest",
    GET_METADATA_FOREST = "get_metadata_forest",
    GET_WHOLE_METADATA_FOREST = "get_whole_metadata_forest",
    GET_METADATA_PATH = "get_metadata_path",
    GET_METADATA_SIBLINGS_FOREST = "get_metadata_siblings_forest",
    ADD_METADATA_PARENT = "add_metadata_parent",
    PRUNE_METADATA_BRANCH = "prune_metadata_branch",
    GET_SNIPPETS_BY_METADATA_SUBSET = "get_snippets_by_metadata_subset",
    GET_SNIPPETS_BY_METADATA_INTERSECTION = "get_snippets_by_metadata_intersection",
    UPDATE_SNIPPET_METADATA = "update_snippet_metadata",
    RENAME_METADATA = "rename_metadata"
}

async function handleTool<T>(
    schema: any,
    args: unknown,
    dbMethod: (validated: T) => Promise<any>,
    errorMessage: string
) {
    const validatedArgs = schema.parse(args);
    try {
        const res = await dbMethod(validatedArgs);
        return {
            content: [
                { type: "text", text: JSON.stringify({ success: true, content: res }) }
            ]
        };
    } catch (error: any) {
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

export const createServer = (db: DB) => {
    const server = new Server(
        {
            name: "msm-mcp_server",
            title: "MSM (Metada Snippet Manager) MCP server",
            version: "0.1.0",
        },
        {
            capabilities: {
                tools: {},
                resources: {
                    list: true,
                    read: true
                }
            },
            instructions,
        }
    );

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                { uri: "general://instructions", name: "Instructions", description: "Detailed operational guide for this MCP server", mimeType: "text/markdown" }
            ]
        };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;

        if (uri === "general://instructions") 
            return { contents: [ { uri, mimeType: "text/markdown", text: instructions } ] };

        throw new Error(`Unknown resource: ${uri}`);
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools: Tool[] = [
            // { name: ToolName.TEST_DB, description: "Tests db connection", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            // { name: ToolName.CLEAR, description: "Clear all data", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            { name: ToolName.CLEAR_CONSTRAINTS, description: "Clear db constraints", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            { name: ToolName.CREATE_METADATA, description: "Create a metadata. Insert the name, the category (concept or language) and the parent", inputSchema: zodToJsonSchema(CreateMetadataSchema) as ToolInput },
            { name: ToolName.CREATE_SNIPPET, description: "Create a snippet with metadata. All metadata have the same category. The name has to be lowercase, no spaces, ending with the extension (for example .py)", inputSchema: zodToJsonSchema(CreateSnippetSchema) as ToolInput },
            // { name: ToolName.GET_ALL_SNIPPETS, description: "Get all snippets in list form. All snippets have a list of metadata and a category", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            // { name: ToolName.GET_ALL_METADATA, description: "Get all metadata in list fortm. All metadata have a category and a parent of the same category.", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            { name: ToolName.DELETE_METADATA, description: "Delete some metadata.", inputSchema: zodToJsonSchema(DeleteMetadataSchema) as ToolInput },
            { name: ToolName.DELETE_SNIPPETS, description: "Delete some snippets.", inputSchema: zodToJsonSchema(DeleteSnippetsSchema) as ToolInput },
            { name: ToolName.UPDATE_SNIPPET_CONTENT, description: "Update a snippet content.", inputSchema: zodToJsonSchema(UpdateSnippetContentSchema) as ToolInput },
            { name: ToolName.SEARCH_SNIPPET_BY_NAME, description: "Get snippet searching by name.", inputSchema: zodToJsonSchema(SearchSnippetByNameSchema) as ToolInput },
            { name: ToolName.GET_METADATA_TREE, description: "Get a metadata tree by the root name.", inputSchema: zodToJsonSchema(GetMetadataTreeSchema) as ToolInput },
            { name: ToolName.CREATE_METADATA_TREE, description: "Create a metadata tree.", inputSchema: zodToJsonSchema(CreateMetadataTreeSchema) as ToolInput },
            { name: ToolName.CREATE_METADATA_SUBTREE, description: "Create a metadata tree from a given existing metadata root.", inputSchema: zodToJsonSchema(CreateMetadataSubtreeSchema) as ToolInput },
            { name: ToolName.GET_METADATA_SIBLINGS, description: "Get siblings of a metadata (All metadata with the same father).", inputSchema: zodToJsonSchema(GetMetadataSiblingsSchema) as ToolInput },
            { name: ToolName.CREATE_METADATA_FOREST, description: "Create a metadata forest", inputSchema: zodToJsonSchema(CreateMetadataForestSchema) as ToolInput },
            { name: ToolName.GET_METADATA_FOREST, description: "Get a metadata forest by root names", inputSchema: zodToJsonSchema(GetMetadataForestSchema) as ToolInput },
            { name: ToolName.GET_WHOLE_METADATA_FOREST, description: "Get all metadata in the forest form", inputSchema: zodToJsonSchema(z.object({})) as ToolInput },
            { name: ToolName.GET_METADATA_PATH, description: "Get the path from the root to the specified metadata", inputSchema: zodToJsonSchema(GetMetadataPathSchema) as ToolInput},
            { name: ToolName.GET_METADATA_SIBLINGS_FOREST, description: "Get a forest which roots are all siblings of the specified metadata item (metadata item in input included)", inputSchema: zodToJsonSchema(GetMetadataSiblingsForestSchema) as ToolInput },
            { name: ToolName.ADD_METADATA_PARENT, description: "Add a parent to a specified metadata item (that item can't have other parents and has to be of the same category of the new parent)", inputSchema: zodToJsonSchema(AddMetadataParentSchema) as ToolInput },
            { name: ToolName.PRUNE_METADATA_BRANCH, description: "Remove relationship between a metadata parent and a metadata child. The child becomes a root.", inputSchema: zodToJsonSchema(PruneMetadataBranchSchema) as ToolInput },
            { name: ToolName.GET_SNIPPETS_BY_METADATA_SUBSET, description: "Get a list of snippets that are related to all the given metadata", inputSchema: zodToJsonSchema(GetSnippetsByMetadataSchema) as ToolInput },
            { name: ToolName.GET_SNIPPETS_BY_METADATA_INTERSECTION, description: "Get a list of snippets. Each snippet contains at least one metadata of the given list. The list in output is ordered by cardinality of intersection", inputSchema: zodToJsonSchema(GetSnippetsByMetadataSchema) as ToolInput },
            { name: ToolName.UPDATE_SNIPPET_METADATA, description: "Replace metadata of a snippet", inputSchema: zodToJsonSchema(UpdateSnippetMetadataSchema) as ToolInput },
            { name: ToolName.RENAME_METADATA, description: "Rename a metadata", inputSchema: zodToJsonSchema(RenameMetadataSchema) as ToolInput },
        ];

        return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args} = request.params;

        /*
        if (name === ToolName.TEST_DB) {
            try {
                const res = await db.test_db_connection();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: `Test returned ${res}` }) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'DB test failed' }) }] };
            }
        }*/
        /*
        if (name === ToolName.CLEAR) {
            try {
                await db.clear();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: 'DB and storage cleared' }) }] };
            } catch (error: any) { 
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to clear DB' }) }] };
            }
        }*/

        if (name === ToolName.CLEAR_CONSTRAINTS) {
            try {
                await db.clear_constraints();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: 'cleared DB constraints' }) }] };
            } catch (error: any) { 
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to clear DB' }) }] };
            }
        }

        if (name === ToolName.CREATE_METADATA) {
            return await handleTool(CreateMetadataSchema, args, db.createMetadata.bind(db), "Failed to create metadata");
        }

        if (name === ToolName.CREATE_SNIPPET) {
            return await handleTool(CreateSnippetSchema, args, db.createSnippet.bind(db), "Failed to create snippet");
        }
        /*
        if (name === ToolName.GET_ALL_SNIPPETS) {
            try {
                const res = await db.getAllSnippets();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to get snippets' }) }] };
            }
        }*/
        /*
        if (name === ToolName.GET_ALL_METADATA) {
            try {
                const res = await db.getAllMetadata();
                return { content: [{ type: "text", text: JSON.stringify({ success: true, content: res }, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message || 'Failed to get metadata' }) }] };
            }
        }*/

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
            } catch (error: any) {
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

        if (name === ToolName.GET_SNIPPETS_BY_METADATA_SUBSET)
            return await handleTool(GetSnippetsByMetadataSchema, args, db.getSnippetByMetadataSubset.bind(db), "Failed to get snippets by the given metadata");

        if (name === ToolName.GET_SNIPPETS_BY_METADATA_INTERSECTION)
            return await handleTool(GetSnippetsByMetadataSchema, args, db.getSnippetsByMetadataIntersection.bind(db), "Failed to get snippets by the given metadata");

        if (name === ToolName.UPDATE_SNIPPET_METADATA)
            return await handleTool(UpdateSnippetMetadataSchema, args, db.updateSnippetMetadata.bind(db), "Failed to update metadata o snippet");

        if (name === ToolName.RENAME_METADATA)
            return await handleTool(RenameMetadataSchema, args, db.renameMetadata.bind(db), "Failed to rename metadata");

        throw new Error(`Unknown tool: ${name}`);
    });

    return { server };
}

import { z } from "zod";
export var MetadataCategory;
(function (MetadataCategory) {
    MetadataCategory["CONCEPT"] = "concept";
    MetadataCategory["LANGUAGE"] = "language";
})(MetadataCategory || (MetadataCategory = {}));
export const SnippetSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    extension: z.string().min(1).max(10).toLowerCase(),
    size: z.number().positive(),
    createdAt: z.date(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory),
    author: z.string().min(1).optional()
}).refine((data) => data.name.endsWith(`.${data.extension}`), {
    message: "Il nome deve terminare con l'estensione specificata",
    path: ["name"]
});
export const CreateSnippetSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    extension: z.string().min(1).max(10).toLowerCase(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory),
    author: z.string().min(1).optional()
}).refine((data) => data.name.endsWith(`.${data.extension}`), {
    message: "Il nome deve terminare con l'estensione specificata",
    path: ["name"]
});
export const MetadataSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().toLowerCase().optional()
});
export const CreateMetadataSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().toLowerCase().optional()
});
export const DeleteMetadataSchema = z.object({
    metadata: z.array(z.object({
        name: z.string().min(1).max(100).toLowerCase(),
        category: z.nativeEnum(MetadataCategory)
    }))
});
export const DeleteSnippetsSchema = z.object({
    names: z.array(z.string().min(1).max(255).toLowerCase())
});
export const UpdateSnippetContentSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    author: z.string().min(1).optional()
});
export const SearchSnippetByNameSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase()
});
export const MetadataTreeNodeSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    children: z.lazy(() => z.array(MetadataTreeNodeSchema)).default([])
});
export const GetMetadataTreeSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    maxDepth: z.number().int().default(-1).describe("Max depth of tree. If -1 gets the whole tree")
});
export const CreateMetadataTreeSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    root: MetadataTreeNodeSchema
});
export const CreateMetadataSubtreeSchema = z.object({
    rootName: z.string().min(1).max(100).toLowerCase(),
    children: z.array(MetadataTreeNodeSchema).min(1)
});
export const GetMetadataSiblingsSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase()
});
export const MetadataSiblingsListSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    siblings: z.array(z.string().min(1).max(100).toLowerCase())
});
export const CreateMetadataForestSchema = z.object({
    forest: z.array(CreateMetadataTreeSchema)
});
export const GetMetadataForestSchema = z.object({
    names: z.array(GetMetadataTreeSchema)
});
export const MetadataForestStatusSchema = z.array(z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    tree: MetadataTreeNodeSchema.optional(),
    status: z.string(),
    error: z.string().optional()
}));
export const MetadataForestSuccessSchema = z.object({
    results: MetadataForestStatusSchema,
    success: z.enum(["success", "partial success", "error"])
});
export const GetMetadataPathSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase()
});
export const MetadataPathSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    path: z.array(z.string().min(1).max(100).toLowerCase())
});
export const GetMetadataSiblingsForestSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    maxDepth: z.number().int().default(-1).describe("Max depth of each sibling tree. If -1 gets the whole trees")
});
export const MetadataSiblingsForestSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    forest: z.array(MetadataTreeNodeSchema)
});
export const AddMetadataParentSchema = z.object({
    pairs: z.array(z.object({
        parentName: z.string().min(1).max(100).toLowerCase(),
        childName: z.string().min(1).max(100).toLowerCase()
    }))
});
export const MetadataParentChildStatusSchema = z.array(z.object({
    parentName: z.string().min(1).max(100).toLowerCase(),
    childName: z.string().min(1).max(100).toLowerCase(),
    parentTree: MetadataTreeNodeSchema.optional(),
    status: z.string(),
    error: z.string().optional()
}));
export const MetadataParentChildSuccess = z.object({
    results: MetadataParentChildStatusSchema,
    success: z.enum(["success", "partial success", "error"])
});
export const PruneMetadataBranchSchema = z.object({
    parentName: z.string().min(1).max(100).toLowerCase(),
    childName: z.string().min(1).max(100).toLowerCase(),
});
export const PruneMetadataNewTreesSchema = z.object({
    parentTree: MetadataTreeNodeSchema,
    childTree: MetadataTreeNodeSchema
});
export const GetSnippetsByMetadataSchema = z.object({
    metadataNames: z.array(z.string().min(1).max(100).toLowerCase()),
    category: z.nativeEnum(MetadataCategory)
});
export const SnippetWithMatchCountSchema = z.object({
    snippet: SnippetSchema,
    matchCount: z.number().int().positive()
});
export const UpdateSnippetMetadataSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory)
}).refine((data) => {
    const parts = data.name.split('.');
    return parts.length > 1;
}, {
    message: "Il nome deve contenere un'estensione",
    path: ["name"]
});
export const GetSnippetsByDateSchema = z.object({
    date: z.date().optional(),
    operator: z.enum(['lte', 'gte', 'eq']).default('lte').describe("Comparison operator: lte (<=), gte (>=), eq (=)"),
    limit: z.number().int().positive().default(10).describe("Maximum number of snippets to return")
}).optional();
export const RenameMetadataSchema = z.object({
    oldName: z.string().min(1).max(100).toLowerCase(),
    newName: z.string().min(1).max(100).toLowerCase(),
    category: z.nativeEnum(MetadataCategory)
});
export const TranslationSchema = z.object({
    extension: z.string().min(1).max(10).toLowerCase().describe("File extension for the translated snippet"),
    content: z.string(),
    translatedAt: z.date(),
    snippetName: z.string().min(1).max(255).toLowerCase().describe("Name of the original snippet")
});
export const CreateSnippetTranslationSchema = z.object({
    snippetName: z.string().min(1).max(255).toLowerCase(),
    extension: z.string().min(1).max(10).toLowerCase(),
    content: z.string()
});
export const UpdateSnippetTranslationSchema = z.object({
    snippetName: z.string().min(1).max(255).toLowerCase(),
    extension: z.string().min(1).max(10).toLowerCase(),
    content: z.string()
});
export const DeleteSnippetTranslationSchema = z.object({
    snippetName: z.string().min(1).max(255).toLowerCase(),
    extension: z.string().min(1).max(10).toLowerCase()
});
export const GetSnippetTranslationSchema = z.object({
    snippetName: z.string().min(1).max(255).toLowerCase(),
    extension: z.string().min(1).max(10).toLowerCase()
});
export const SnippetWithTranslationsSchema = z.object({
    snippet: SnippetSchema,
    translations: z.array(TranslationSchema)
});
export const GetSnippetTranslationsSchema = z.object({
    snippetName: z.string().min(1).max(255).toLowerCase()
});

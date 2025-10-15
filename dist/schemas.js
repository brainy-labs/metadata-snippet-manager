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
    category: z.nativeEnum(MetadataCategory)
}).refine((data) => data.name.endsWith(`.${data.extension}`), {
    message: "Il nome deve terminare con l'estensione specificata",
    path: ["name"]
});
export const CreateSnippetSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    extension: z.string().min(1).max(10).toLowerCase(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory)
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
    names: z.array(z.string().min(1).max(100).toLowerCase())
});
export const DeleteSnippetsSchema = z.object({
    names: z.array(z.string().min(1).max(255).toLowerCase())
});
export const UpdateSnippetContentSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string()
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

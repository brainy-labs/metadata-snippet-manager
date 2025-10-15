import { z } from "zod";

export enum MetadataCategory {
    CONCEPT = "concept",
    LANGUAGE = "language"
}

export const SnippetSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    extension: z.string().min(1).max(10).toLowerCase(),
    size: z.number().positive(),
    createdAt: z.date(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory)
}).refine(
    (data) => data.name.endsWith(`.${data.extension}`),
    {
        message: "Il nome deve terminare con l'estensione specificata",
        path: ["name"]
    }
);
export type Snippet = z.infer<typeof SnippetSchema>;

export const CreateSnippetSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string(),
    extension: z.string().min(1).max(10).toLowerCase(),
    metadataNames: z.array(z.string().min(1).toLowerCase()).min(1),
    category: z.nativeEnum(MetadataCategory)
}).refine(
    (data) => data.name.endsWith(`.${data.extension}`),
    {
        message: "Il nome deve terminare con l'estensione specificata",
        path: ["name"]
    }
);
export type CreateSnippetInput = z.infer<typeof CreateSnippetSchema>;

export const MetadataSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().toLowerCase().optional()
});
export type Metadata = z.infer<typeof MetadataSchema>;

export const CreateMetadataSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().toLowerCase().optional()
});
export type CreateMetadataInput = z.infer<typeof CreateMetadataSchema>;

export const DeleteMetadataSchema = z.object({
    names: z.array(z.string().min(1).max(100).toLowerCase())
});
export type DeleteMetadataInput = z.infer<typeof DeleteMetadataSchema>;

export const DeleteSnippetsSchema = z.object({
    names: z.array(z.string().min(1).max(255).toLowerCase())
});
export type DeleteSnippetsInput = z.infer<typeof DeleteSnippetsSchema>;

export const UpdateSnippetContentSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string()
});
export type upDateSnippetContentInput = z.infer<typeof UpdateSnippetContentSchema>;

export const SearchSnippetByNameSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase()
});
export type SearchSnippetByNameInput = z.infer<typeof SearchSnippetByNameSchema>;

export const MetadataTreeNodeSchema: z.ZodType = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    children: z.lazy(() => z.array(MetadataTreeNodeSchema)).default([])
});
export type MetadataTreeNode = z.infer<typeof MetadataTreeNodeSchema>;

export const GetMetadataTreeSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    maxDepth: z.number().int().default(-1).describe("Max depth of tree. If -1 gets the whole tree")
});
export type GetMetadataTreeInput = z.infer<typeof GetMetadataTreeSchema>;

export const CreateMetadataTreeSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    root: MetadataTreeNodeSchema
});
export type CreateMetadataTreeInput = z.infer<typeof CreateMetadataTreeSchema>;

export const CreateMetadataSubtreeSchema = z.object({
    rootName: z.string().min(1).max(100).toLowerCase(),
    children: z.array(MetadataTreeNodeSchema).min(1)
});
export type CreateMetadataSubtreeInput = z.infer<typeof CreateMetadataSubtreeSchema>;

export const GetMetadataSiblingsSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase()
});
export type GetMetadataSiblingsInput = z.infer<typeof GetMetadataSiblingsSchema>;

export const MetadataSiblingsListSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    siblings: z.array(z.string().min(1).max(100).toLowerCase())
});
export type MetadataSiblingsList = z.infer<typeof MetadataSiblingsListSchema>;

export const CreateMetadataForestSchema = z.object({
    forest: z.array(CreateMetadataTreeSchema)
});
export type CreateMetadataForestInput = z.infer<typeof CreateMetadataForestSchema>;

export const  GetMetadataForestSchema = z.object({
    names: z.array(GetMetadataTreeSchema)
});
export type GetMetadataForestInput = z.infer<typeof GetMetadataForestSchema>;

export const GetMetadataPathSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase()
});
export type GetMetadataPathInput = z.infer<typeof GetMetadataPathSchema>;

export const MetadataPathSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    path: z.array(z.string().min(1).max(100).toLowerCase())
});
export type MetadataPath = z.infer<typeof MetadataPathSchema>;

export const GetMetadataSiblingsForestSchema = z.object({
    name: z.string().min(1).max(100).toLowerCase(),
    maxDepth: z.number().int().default(-1).describe("Max depth of each sibling tree. If -1 gets the whole trees")
});
export type GetMetadataSiblingsForestInput = z.infer<typeof GetMetadataSiblingsForestSchema>;

export const MetadataSiblingsForestSchema = z.object({
    category: z.nativeEnum(MetadataCategory),
    forest: z.array(MetadataTreeNodeSchema)
});
export type MetadataSiblingsForest = z.infer<typeof MetadataSiblingsForestSchema>; 

export const AddMetadataParentSchema = z.object({
    pairs: z.array(z.object({
        parentName: z.string().min(1).max(100).toLowerCase(),
        childName: z.string().min(1).max(100).toLowerCase()
    }))
});
export type AddMetadataParentInput = z.infer<typeof AddMetadataParentSchema>;

export const MetadataParentChildStatusSchema = z.array(z.object({
        parentName: z.string().min(1).max(100).toLowerCase(),
        childName: z.string().min(1).max(100).toLowerCase(),
        parentTree: MetadataTreeNodeSchema.optional(),
        status: z.string(),
        error: z.string().optional()
}));
export type MetadataParentChildStatus = z.infer<typeof MetadataParentChildStatusSchema>;

export const MetadataParentChildSuccess = z.object({
    results: MetadataParentChildStatusSchema,
    success: z.enum(["success", "partial success", "error"])
})
export type MetadataParentChildSuccess = z.infer<typeof MetadataParentChildSuccess>;

export const PruneMetadataBranchSchema = z.object({
    parentName: z.string().min(1).max(100).toLowerCase(),
    childName: z.string().min(1).max(100).toLowerCase(),
});
export type PruneMetadataBranchInput = z.infer<typeof PruneMetadataBranchSchema>;

export const PruneMetadataNewTreesSchema = z.object({
    parentTree: MetadataTreeNodeSchema,
    childTree: MetadataTreeNodeSchema
});
export type PruneMetadataNewTrees = z.infer<typeof PruneMetadataNewTreesSchema>;

export const GetSnippetsByMetadataSchema= z.object({
    metadataNames: z.array(z.string().min(1).max(100).toLowerCase()),
    category: z.nativeEnum(MetadataCategory)
});
export type GetSnippetsByMetadataInput = z.infer<typeof GetSnippetsByMetadataSchema>;

export const SnippetWithMatchCountSchema = z.object({
    snippet: SnippetSchema,
    matchCount: z.number().int().positive()
});
export type SnippetWithMatchCount = z.infer<typeof SnippetWithMatchCountSchema>;
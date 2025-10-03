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

export const updateSnippetContentSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase(),
    content: z.string()
});
export type upDateSnippetContentInput = z.infer<typeof updateSnippetContentSchema>;

export const SearchSnippetByNameSchema = z.object({
    name: z.string().min(1).max(255).toLowerCase()
});
export type SearchSnippetByNameInput = z.infer<typeof SearchSnippetByNameSchema>;
import { z } from "zod";

export enum MetadataCategory {
    CONCEPT = "concept",
    LANGUAGE = "language"
}

export const SnippetSchema = z.object({
    name: z.string().min(1).max(255),
    path: z.string().min(1),
    extension: z.string().min(1).max(10),
    size: z.number().positive(),
    createdAt: z.date()
});
export type Snippet = z.infer<typeof SnippetSchema>;

export const CreateSnippetSchema = z.object({
    name: z.string().min(1).max(255),
    content: z.string(),
    extension: z.string().min(1).max(10),
    metadataNames: z.array(z.string()).min(1)
});
export type CreateSnippetInput = z.infer<typeof CreateSnippetSchema>;

export const MetadataSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().optional()
});
export type Metadata = z.infer<typeof MetadataSchema>;

export const CreateMetadataSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().optional()
});
export type CreateMetadataInput = z.infer<typeof CreateMetadataSchema>;

export const SearchSnippetByNameSchema = z.object({
    name: z.string().min(1).max(255)
});
export type SearchSnippetByNameInput = z.infer<typeof SearchSnippetByNameSchema>;
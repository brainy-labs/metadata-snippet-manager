import { z } from "zod";
export var MetadataCategory;
(function (MetadataCategory) {
    MetadataCategory["CONCEPT"] = "concept";
    MetadataCategory["LANGUAGE"] = "language";
})(MetadataCategory || (MetadataCategory = {}));
export const SnippetSchema = z.object({
    name: z.string().min(1).max(255),
    path: z.string().min(1),
    extension: z.string().min(1).max(10),
    size: z.number().positive(),
    createdAt: z.date()
});
export const CreateSnippetSchema = z.object({
    name: z.string().min(1).max(255),
    content: z.string(),
    extension: z.string().min(1).max(10),
    metadataNames: z.array(z.string()).min(1)
});
export const MetadataSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().optional()
});
export const CreateMetadataSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.nativeEnum(MetadataCategory),
    parentName: z.string().optional()
});
export const SearchSnippetByNameSchema = z.object({
    name: z.string().min(1).max(255)
});

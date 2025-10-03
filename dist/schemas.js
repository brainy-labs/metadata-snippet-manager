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

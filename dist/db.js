import neo4j from "neo4j-driver";
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storageDir = resolve(__dirname, "../storage");
var ConstraintType;
(function (ConstraintType) {
    ConstraintType["EXISTS"] = "IS NOT NULL";
    ConstraintType["UNIQUE"] = "IS UNIQUE";
})(ConstraintType || (ConstraintType = {}));
;
export class DB {
    driver;
    /**
     * Initialize db driver
     */
    constructor() {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
            throw new Error("Missing env variables");
        }
        this.driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD), {
            maxConnectionPoolSize: 20,
            connectionAcquisitionTimeout: 20000
        });
    }
    /**
     * Initialize db with nodes constraints
     */
    async initialize() {
        const session = this.driver.session();
        try {
            await this.create_field_constraint(session, "Snippet", "snippet_path_unique", "path", ConstraintType.UNIQUE);
            await this.create_field_constraint(session, "Metadata", "metadata_name_existence", "name", ConstraintType.EXISTS);
            await this.create_field_constraint(session, "Metadata", "metadata_name_unique", "name", ConstraintType.UNIQUE);
            await this.create_index(session, "Metadata", "metadata_category", "category");
        }
        finally {
            await session.close();
        }
    }
    /**
     *
     * @param input Metadata to create
     * @returns the Metadata created
     */
    async createMetadata(input) {
        const session = this.driver.session();
        try {
            // Check if metadata already exists
            const res = await session.run(`
                MATCH (m: Metadata)
                WHERE m.name = $name
                RETURN m
            `, { name: input.name });
            if (res.records.length > 0)
                throw new Error(`Name already taken`);
            // If there is a parent, verify it is from the same category
            if (input.parentName) {
                const parentCheck = await session.run(`
                    MATCH (p:Metadata {name: $parentName})
                    RETURN p.category as category
                `, { parentName: input.parentName });
                if (parentCheck.records.length === 0) {
                    throw new Error(`Parent metadata '${input.parentName}' not found`);
                }
                const parentCategory = parentCheck.records[0].get('category');
                if (parentCategory !== input.category) {
                    throw new Error(`Parent metadata category '${parentCategory}' doesn't match '${input.category}'`);
                }
            }
            // Create metadata and parent relation if exists
            const result = await session.run(`
                MERGE (m:Metadata {name: $name})
                ON CREATE SET m.category = $category
                WITH m
                OPTIONAL MATCH (p:Metadata {name: $parentName})
                WHERE $parentName IS NOT NULL
                FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
                    MERGE (p)-[:PARENT_OF]->(m)
                )
                RETURN m
            `, {
                name: input.name,
                category: input.category,
                parentName: input.parentName || null
            });
            const record = result.records[0].get('m');
            return {
                name: record.properties.name,
                category: record.properties.category,
                parentName: input.parentName
            };
        }
        finally {
            await session.close();
        }
    }
    async deleteMetadataByName(input) {
        const session = this.driver.session();
        try {
            const res = await session.run(`UNWIND $names as name MATCH (m:Metadata {name: name}) DETACH DELETE m`, { names: input.names });
        }
        finally {
            await session.close();
        }
    }
    async deleteSnippetsByName(input) {
        const session = this.driver.session();
        const paths = input.nameExts.map((nameExt) => {
            return join(storageDir, nameExt);
        });
        try {
            const res = await session.run(`UNWIND $paths as path MATCH (s:Snippet {path: path}) DETACH DELETE s`, { paths: paths });
        }
        finally {
            await session.close();
        }
    }
    /**
     * Create a Snippet with the given metadata
     * @param input Snippet to insert
     * @returns the Snippet inserted
     */
    async createSnippet(input) {
        const session = this.driver.session();
        try {
            // Check if snippet already exists
            const res = await session.run(`MATCH (s:Snippet) WHERE s.name = $name RETURN s`, { name: input.name });
            if (res.records.length > 0)
                throw new Error(`Name already taken`);
            // Check metadata existence
            const metadataCheck = await session.run(`MATCH (m:Metadata) WHERE m.name IN $names AND m.category = $category RETURN m.name as name`, {
                names: input.metadataNames,
                category: input.category
            });
            if (metadataCheck.records.length !== input.metadataNames.length) {
                throw new Error(`Some metadata names don't exists`);
            }
            const filename = `${input.name}.${input.extension}`;
            const path = join(storageDir, filename);
            // Create file in storage
            await fs.mkdir(storageDir, { recursive: true });
            await fs.writeFile(path, input.content);
            const stats = await fs.stat(path);
            try {
                // Insert snippet in database
                const result = await session.run(`
                    CREATE (s:Snippet {
                        name: $name,
                        path: $path,
                        extension: $extension,
                        size: $size,
                        createdAt: datetime()
                    })
                    WITH s
                    UNWIND $metadataNames as metadataName
                    MATCH (m: Metadata {name: metadataName})
                    MERGE (s)-[:HAS_METADATA]->(m)
                    RETURN s, s.createdAt as createdAt
                `, {
                    name: input.name,
                    path: path,
                    extension: input.extension,
                    size: stats.size,
                    metadataNames: input.metadataNames
                });
                const record = result.records[0];
                const snippet = record.get('s').properties;
                const createdAt = record.get('createdAt');
                const content = await fs.readFile(path, "utf-8");
                return {
                    name: snippet.name,
                    content: content,
                    path: snippet.path,
                    extension: snippet.extension,
                    size: snippet.size,
                    createdAt: new Date(createdAt.toString()),
                    metadataNames: input.metadataNames,
                    category: input.category
                };
            }
            catch {
                await fs.unlink(path);
                throw new Error('Failed to add snippet in db');
            }
        }
        finally {
            await session.close();
        }
    }
    /**
     * Get all metadata from db
     * @returns an array of all metadata
     */
    async getAllMetadata() {
        const session = this.driver.session();
        try {
            const res = await session.run(`MATCH (m:Metadata) RETURN m`);
            const response = res.records.map(record => {
                const node = record.get('m');
                return node.properties;
            });
            return response;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Get all snippets from db with metadata
     * @returns an array of all snippets
     */
    async getAllSnippets() {
        const session = this.driver.session();
        try {
            const res = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    path: s.path,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS s
            `);
            const response = await Promise.all(res.records.map(async (record) => {
                const node = record.get('s');
                const content = await fs.readFile(node.path, 'utf-8');
                const snippet = { ...node, content: content };
                return snippet;
            }));
            return response;
        }
        finally {
            await session.close();
        }
    }
    async updateSnippetContent(input) {
        const path = join(storageDir, `${input.name}.${input.extension}`);
        try {
            await fs.access(path, fs.constants.F_OK);
        }
        catch {
            throw new Error(`File doesn't exists`);
        }
        await fs.writeFile(path, input.content);
        const session = this.driver.session();
        try {
            const res = await session.run(`
                MATCH (s:Snippet)-[:HAS_METADATA]->(m:Metadata)
                WHERE s.path = $path
                WITH s, collect(DISTINCT m.category) AS categories, collect(DISTINCT m.name) AS metadataNames
                RETURN {
                    name: s.name,
                    path: s.path,
                    extension: s.extension,
                    size: s.size,
                    createdAt: s.createdAt,
                    category: head(categories),
                    metadataNames: metadataNames
                } AS s`, { path: path });
            const s = res.records[0].get('s');
            const snippet = { ...s, content: input.content };
            return snippet;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Clears database and storage
     */
    async clear() {
        const session = this.driver.session();
        try {
            // clean db
            await session.run("MATCH (n) DETACH DELETE n");
            // clean storage
            try {
                const files = await fs.readdir(storageDir);
                await Promise.all(files.map(file => fs.unlink(join(storageDir, file))));
            }
            catch { /* Directory might not exist, ok */ }
        }
        finally {
            await session.close();
        }
    }
    /**
     * Closes database connection
     */
    async close() {
        await this.driver.close();
    }
    /**
     * Run a query that adds (if not exists) a constraint to the right field
     * @param session
     * @param label
     * @param constraint_name
     * @param field
     * @param type it can be a uniqueness constraint as well as a existence constraint
     */
    async create_field_constraint(session, label, constraint_name, field, type) {
        await session.run(`
            CREATE CONSTRAINT ${constraint_name} IF NOT EXISTS
            FOR (${label[0].toLowerCase}:${label}) REQUIRE ${label[0].toLowerCase}.${field} ${type};
        `);
    }
    /**
     * Run a query that adds (if not exists) an index to the right field
     * @param session
     * @param label
     * @param index_name
     * @param field
     */
    async create_index(session, label, index_name, field) {
        // Index for metadata category
        await session.run(`
            CREATE INDEX ${index_name} IF NOT EXISTS 
            FOR (${label[0].toLowerCase}:${label}) ON (${label[0].toLowerCase}.${field})
        `);
    }
    /**
     * db connection test function
     * @returns if ok return 1 else returns -1
     */
    async test_db_connection() {
        const session = this.driver.session();
        try {
            const result = await session.run("RETURN 1 AS num");
            return result.records[0].get("num").toNumber();
        }
        catch {
            return -1;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Run a custom query
     * @param query
     * @param params
     * @returns
     */
    async runCustomQuery(query, params = {}) {
        const session = this.driver.session();
        try {
            const result = await session.run(query, params);
            await session.close();
            return result;
        }
        catch {
            await session.close();
            return [];
        }
    }
}

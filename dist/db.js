import neo4j from "neo4j-driver";
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { dirname, join, resolve, basename } from "path";
import { fileURLToPath } from "url";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storageDir = resolve(__dirname, "../storage");
export class DB {
    driver;
    constructor() {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
            throw new Error("Missing env variables");
        }
        this.driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD), {
            maxConnectionPoolSize: 20,
            connectionAcquisitionTimeout: 20000
        });
    }
    async initialize() {
        // TODO: add db constraint
    }
    async clear() {
        const session = this.driver.session();
        try {
            await session.run("MATCH (n) DETACH DELETE n");
        }
        finally {
            await session.close();
        }
    }
    async close() {
        await this.driver.close();
    }
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
    async test_add_file(name, content) {
        if (content.length > 500 || name.length > 30)
            throw new Error("File content of File name tool long");
        const path = join(storageDir, name);
        await fs.writeFile(path, content);
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MERGE (f:File { path: $path })
                SET f.content = $content
                RETURN f;
            `, { path: path, content: content });
            return basename(result.records[0].get("f").properties.path);
        }
        catch (error) {
            throw new Error(`Error adding file: ${error}`);
        }
        finally {
            session.close();
        }
    }
    async test_remove_file(name) {
        const path = join(storageDir, name);
        const session = this.driver.session();
        try {
            const result = await session.run(`
               MATCH (f: File { path: $path }) 
               DETACH DELETE f
            `, { path: path });
            await fs.unlink(path);
            return name;
        }
        catch (error) {
            throw new Error(`Error removing file: ${error}`);
        }
        finally {
            session.close();
        }
    }
    async test_read_file(name) {
        const path = join(storageDir, name);
        const session = this.driver.session();
        try {
            const result = await session.run(`
                MATCH (f: File { path: $path})
                return f
            `, { path: path });
            if (result.records.length === 0)
                return undefined;
            return result.records[0].get("f").properties.content;
        }
        catch (error) {
            throw new Error(`Error reading file: ${error}`);
        }
        finally {
            session.close();
        }
    }
    async runCustomQuery(query, params = {}) {
        const session = this.driver.session();
        try {
            const result = await session.run(query, params);
            return result;
        }
        finally {
            await session.close();
            return [];
        }
    }
}

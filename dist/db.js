import neo4j from "neo4j-driver";
import * as dotenv from 'dotenv';
dotenv.config();
export class DB {
    driver;
    session = null;
    constructor() {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
            throw new Error("Missing env variables");
        }
        this.driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD), {
            maxConnectionPoolSize: 20,
            connectionAcquisitionTimeout: 20000
        });
    }
    async test() {
        this.session = this.driver.session();
        try {
            const result = await this.session.run("RETURN 1 AS num");
            return result.records[0].get("num").toNumber();
        }
        catch {
            return -1;
        }
        finally {
            await this.session.close();
            this.session = null;
        }
    }
    async close() {
        this.driver.close();
    }
}

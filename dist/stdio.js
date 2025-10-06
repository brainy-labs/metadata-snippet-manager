import { DB } from "./db.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./snippet_manager.js";
async function main() {
    const db = (() => {
        try {
            return new DB();
        }
        catch (error) {
            console.error(`Error in creating db driver: ${error}`);
            process.exit(1);
        }
    })();
    const transport = new StdioServerTransport();
    const { server } = createServer(db);
    await server.connect(transport);
    console.error("MSM MCP-server started");
    process.on("SIGINT", async () => {
        await db.close();
        await server.close();
        process.exit(0);
    });
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});

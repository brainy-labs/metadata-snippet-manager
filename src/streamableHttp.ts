import { createServer } from "./snippet_manager.js";
import { DB } from "./db.js";
import http from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

async function main() {
    const db: DB = (() => {
        try {
            return new DB();
        } catch (error) {
            console.error(`Error creating db driver: ${error}`);
            process.exit(1);
        }
    })();

    // Configuration
    const PORT = Number(process.env.PORT || 3002);
    
    // Initialize MCP server
    const { server } = createServer(db);
    
    // Create streamable HTTP transport 
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
    });

    // connect MCP server to transport
    await server.connect(transport);

    // server HTTP that uses transport
    const httpServer = http.createServer(async (req, res) => {
        // healtcheck
        if (req.url === "/healt") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // handle MCP requests
        await transport.handleRequest(req, res);
    });

    httpServer.listen(PORT, () => {
        console.error(`MSM MCP-server (HTTP) running on http://localhost:${PORT}`);
    });

    // graceful shutdown
    const shutdown = async () => {
        console.error("Shutting down HTTP MCP server...");
        try {
            await db.close();
        } catch (error) {
            console.error("Error closing DB:", error);
        }
        try {
            await server.close();
        } catch (error) {
            console.error("Error closing MCP server:", error)
        }
        httpServer.close(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((error) => {
    console.error("HTTP server error:", error);
    process.exit(1);
})
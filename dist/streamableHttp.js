import { createServer } from "./snippet_manager.js";
import { DB } from "./db.js";
import http from "http";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
async function main() {
    // 1. Initialize Database (once)
    // The DB instance will be shared across all server sessions.
    const db = (() => {
        try {
            return new DB();
        }
        catch (error) {
            console.error(`Error creating db driver: ${error}`);
            process.exit(1);
        }
    })();
    // Configuration
    const PORT = Number(process.env.PORT || 3002);
    // Initialize the Express application
    const app = express();
    // 2. Enable CORS
    // Essential for allowing external clients (like the MCP Inspector) to connect.
    app.use(cors({
        "origin": "*", // Be careful in production; you might want to restrict the origin
        "methods": "GET,POST,DELETE",
        "exposedHeaders": [
            'mcp-session-id',
            'last-event-id',
            'mcp-protocol-version'
        ]
    }));
    // 3. Session Management
    // We use a Map to keep track of active transports, using the sessionId as the key.
    // This is the core of the multi-client management.
    const transports = new Map();
    // Define a single /msm route to handle all MCP requests.
    // The method (POST, GET, DELETE) determines the action.
    app.all('/msm', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        let transport;
        console.error(`[${new Date().toISOString()}] Received MCP ${req.method} request. Session ID: ${sessionId || 'None'}`);
        try {
            if (sessionId && transports.has(sessionId)) {
                // --- Case 1: Existing Session ---
                // The client provided a valid sessionId, so we reuse the existing transport.
                transport = transports.get(sessionId);
            }
            else if (req.method === 'POST' && !sessionId) {
                // --- Case 2: New Session ---
                // This is an initialization request (POST without a sessionId).
                // We create a new MCP server and a new transport for this session.
                const { server } = createServer(db);
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    // Handles the session initialization event
                    onsessioninitialized: (newSessionId) => {
                        console.error(`Session initialized with ID: ${newSessionId}`);
                        // We add the new transport to our map, making it available
                        // for future requests with this sessionId.
                        transports.set(newSessionId, transport);
                    }
                });
                // Handles session closure to clean up resources.
                server.onclose = async () => {
                    const sid = transport.sessionId;
                    if (sid && transports.has(sid)) {
                        console.error(`Session ${sid} closed. Removing from transports map.`);
                        transports.delete(sid);
                    }
                };
                // Connect the MCP server to the transport BEFORE handling the request,
                // so that responses can flow back correctly.
                await server.connect(transport);
            }
            else {
                // --- Case 3: Error ---
                // Invalid request (e.g., GET or DELETE without a valid sessionId).
                console.error(`Bad Request: Invalid session ID provided for ${req.method} request.`);
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                    id: req?.body?.id || null,
                });
                return;
            }
            // Forward the request to the correct transport (new or existing).
            // The transport will handle the details of the MCP protocol.
            await transport.handleRequest(req, res);
        }
        catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error', data: error.message },
                    id: req?.body?.id || null,
                });
            }
        }
    });
    // Healthcheck endpoint
    app.get("/health", (req, res) => {
        res.status(200).json({ ok: true, active_sessions: transports.size });
    });
    // Start the HTTP server
    const httpServer = http.createServer(app);
    httpServer.listen(PORT, () => {
        console.error(`MSM MCP-server (HTTP) running on http://localhost:${PORT}`);
        console.error(`MCP endpoint is POST/GET/DELETE http://localhost:${PORT}/msm`);
    });
    // 4. Graceful Shutdown
    // Handles the graceful shutdown of the server.
    const shutdown = async () => {
        console.error("Shutting down HTTP MCP server...");
        // Close all active connections
        for (const [sessionId, transport] of transports.entries()) {
            console.error(`Closing transport for session ${sessionId}...`);
            await transport.close().catch(err => console.error(`Error closing transport for session ${sessionId}:`, err));
        }
        transports.clear();
        // Close the database connection
        await db.close().catch(error => console.error("Error closing DB:", error));
        // Close the HTTP server
        httpServer.close(() => {
            console.error("Server shut down gracefully.");
            process.exit(0);
        });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((error) => {
    console.error("HTTP server fatal error:", error);
    process.exit(1);
});

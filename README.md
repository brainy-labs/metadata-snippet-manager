# MSM (Metadata Snippet Manager)

A snippet manager based on a metadata system.

## License

This project is distributed under the MIT License. See the file [LICENSE](./LICENSE) for details.

## Setup

Follow these steps to set up and run the MCP Server project locally.

---

### 1. Environment Variables

Create a `.env` file in the project root with the following content:

```
# Neo4j Configuration
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Local Neo4j connection (outside Docker)
NEO4J_URI=bolt://localhost:7687

# Server Configuration
PORT=3002
```

> **Note:** When running locally (not in Docker), `NEO4J_URI` must point to `localhost`.

---

### 2. Start the Neo4j Database

The project uses Neo4j as a graph database. To start it in Docker:

```bash
docker compose up -d
```

* This will start Neo4j in the background.
* Neo4j Browser will be available at [http://localhost:7474](http://localhost:7474)
* Bolt protocol for the driver runs on port `7687`.

> **Note:** Make sure these ports are free before starting.
> If Neo4j does not start, check logs with:
>
> ```bash
> docker logs -f neo4j
> ```

---

### 3. Install Dependencies

Install the Node.js dependencies:

```bash
npm install
```

---

### 4. Build the Project

Compile the TypeScript source code and prepare the executable:

```bash
npm run build
```

This will:

* Compile TypeScript files into the `dist/` directory
* Copy additional files (e.g., `instructions.md`)
* Prepare the runtime build

---

### 5. Start the Application

Once Neo4j is running and the project is built, start the application with:

```bash
node dist/index.js [stdio|http]
```

Available modes:

* `stdio` — runs the server in standard I/O mode (for integration or CLI use)
* `http` — starts the HTTP server on the configured port (default: `3002`)

Example:

```bash
node dist/index.js http
```

---

### 6. Optional: Stop the Database

To stop the Neo4j Docker container:

```bash
docker compose down
```

To remove all data (reset the database):

```bash
docker compose down -v
```

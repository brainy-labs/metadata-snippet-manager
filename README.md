# MSM (Metadata Snippet Manager)

A snippet manager based on a metadata system.

## License
This project is distributed under the MIT License. See the file [LICENSE](./LICENSE) for details.

## Setup

Follow these steps to set up and run the MCP Server project locally:

### 1. Start the Neo4j Database

The project uses Neo4j as a graph database. To start it in Docker:

```bash
docker-compose up -d
```

* This will start Neo4j in the background.
* Neo4j Browser will be available at [http://localhost:7474](http://localhost:7474)
* Bolt protocol for the driver runs on port `7687`.

> **Note:** Make sure these ports are free before starting. If Neo4j does not start, check `docker logs -f neo4j` for details.

---

### 2. Install Dependencies

Install Node.js dependencies:

```bash
npm install
```

---

### 3. Build the Project

Compile the TypeScript source code and prepare the executable:

```bash
npm run build
```

This will:

* Compile TypeScript files to `dist/`
* Copy additional files (e.g., `instructions.md`)
* Set executable permissions on `.js` files

---

### 4. Start the Application

Once the database is running and the project is built:

```bash
npm start
```

This runs the compiled server from `dist/index.js`.

---

### 5. Optional: Stop the Database

If you need to stop Neo4j Docker:

```bash
docker-compose down
```

* Use `-v` to remove volumes if you want a clean reset:

```bash
docker-compose down -v
```

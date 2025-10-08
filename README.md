
# MSM (Metadata Snippet Manager)

A snippet manager based on a metadata system.

---

## Table of Contents

- [MSM (Metadata Snippet Manager)](#msm-metadata-snippet-manager)
  - [Table of Contents](#table-of-contents)
  - [License](#license)
  - [Overview](#overview)
  - [Environment variables](#environment-variables)
  - [Quick start — Local (DB in Docker, app local)](#quick-start--local-db-in-docker-app-local)
  - [Quick start — Full Docker (DB + app in Docker)](#quick-start--full-docker-db--app-in-docker)

---

## License

This project is distributed under the **MIT License**. See the `LICENSE` file for details.

---

## Overview

MSM can be run in two main ways:

* **Local development**: Neo4j runs in Docker (using `docker-compose.local.yml`) while the application runs on your host machine. This is the recommended flow for development and debugging.
* **Full Docker**: both Neo4j and the application run inside Docker containers (using `docker-compose.yml`). This is useful for deployment or when you want everything inside Docker.

When the app runs inside Docker (full compose), it automatically runs in `http` mode. When running locally, you can choose `http` or `stdio` when launching `dist/index.js`.

---

## Environment variables

Create a `.env` file in the project root with Neo4j credentials and the server port. Example:

```env
# Neo4j Configuration
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Local use (when DB runs on the host)
NEO4J_URI=bolt://localhost:7687

# Docker use (when app runs inside Docker)
# NEO4J_URI=bolt://neo4j:7687

# Server Configuration
PORT=3002
```

**Important:**

* If you run the app locally against a DB on your machine, use `NEO4J_URI=bolt://localhost:7687` and comment out the Docker hostname line.
* If you run the full Docker Compose stack (app inside Docker), use `NEO4J_URI=bolt://neo4j:7687` so the app container can reach the Neo4j container by its Docker service name.

---

## Quick start — Local (DB in Docker, app local)

1. Clone the repository:

```bash
git clone <repo-url>
cd <repo-dir>
```

2. Start **only** the Neo4j database in Docker (runs in background):

```bash
docker compose -f docker-compose.local.yml up -d
```

3. Install dependencies and build the project (if not already built):

```bash
npm install
npm run build
```

4. Run the application locally (from project root):

```bash
# HTTP server mode (server listens on PORT from .env)
node dist/index.js http

# or stdio mode (CLI / integration)
node dist/index.js stdio
```

**To stop:**

* Stop the **local application** with `Ctrl+C` in the terminal running `node dist/index.js`.
* Stop and remove the **database** container with:

```bash
docker compose -f docker-compose.local.yml down
```

---

## Quick start — Full Docker (DB + app in Docker)

1. Clone the repository:

```bash
git clone <repo-url>
cd <repo-dir>
```

2. Ensure your `.env` uses `bolt://neo4j:7687` for `NEO4J_URI` (uncomment the Docker line and comment the localhost line).

3. Build images and start services (DB + app):

```bash
# build (the image build runs the project build inside the image)
docker compose build

# start services in background
docker compose up -d
```

The app will run in `http` mode inside Docker and be exposed on the port defined in `.env`.

**To stop everything (app + DB):**

```bash
docker compose down
```

This will stop and remove the containers started by `docker-compose.yml`.

---

If you want, I can export this document as a `README.md` file ready to download or apply additional edits (badges, security notes, example `.env` with safer defaults, or CI instructions). Tell me which format you prefer.

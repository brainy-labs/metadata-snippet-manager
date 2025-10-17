# MSM (Metadata Snippet Manager)

A powerful snippet manager that organizes code through intelligent hierarchical metadata, enabling semantic search and multilingual code organization.

---

## Table of Contents

- [MSM (Metadata Snippet Manager)](#msm-metadata-snippet-manager)
  - [Table of Contents](#table-of-contents)
  - [License](#license)
  - [Overview](#overview)
  - [Key Features](#key-features)
  - [Architecture](#architecture)
  - [Environment variables](#environment-variables)
  - [Quick start – Local (DB in Docker, app local)](#quick-start--local-db-in-docker-app-local)
  - [Quick start – Full Docker (DB + app in Docker)](#quick-start--full-docker-db--app-in-docker)
  - [MCP Server Integration](#mcp-server-integration)
    - [Supported Clients](#supported-clients)
    - [Configuration Examples](#configuration-examples)
  - [How It Works](#how-it-works)
    - [Metadata Categories](#metadata-categories)
    - [Hierarchical Organization](#hierarchical-organization)
    - [Translation System](#translation-system)
  - [Available Tools](#available-tools)
    - [Metadata Management](#metadata-management)
    - [Snippet Management](#snippet-management)
    - [Search \& Discovery](#search--discovery)
  - [Usage Guide](#usage-guide)
    - [For End Users](#for-end-users)
    - [For AI Assistants](#for-ai-assistants)
  - [Best Practices](#best-practices)
  - [Example Workflows](#example-workflows)

---

## License

This project is distributed under the **MIT License**. See the `LICENSE` file for details.

---

## Overview

MSM is an MCP (Model Context Protocol) server that provides intelligent code snippet management through semantic metadata organization. Unlike traditional snippet managers that rely on file names or folders, MSM uses a graph-based metadata system to enable:

- **Semantic search**: Find snippets by concepts (e.g., "recursive sorting algorithms")
- **Hierarchical organization**: Metadata organized in meaningful parent-child relationships
- **Multilingual support**: Create metadata in any language, search with variants and synonyms
- **Cross-language translations**: Maintain algorithm implementations across multiple programming languages
- **Author tracking**: Organize snippets by creator

The system is designed to work seamlessly with AI assistants (Claude, Copilot, etc.) that can intelligently navigate the metadata hierarchy and suggest appropriate classifications.

---

## Key Features

- **Graph-based metadata hierarchy**: Organize concepts from general to specific
- **Two metadata categories**: 
  - `concept`: Abstract ideas (algorithm, sorting, recursion)
  - `language`: Language constructs (class, interface, async/await)
- **Smart search strategies**: Progressive search with fallback from specific to general
- **Translation management**: Link implementations of the same algorithm across languages
- **Flexible queries**: Search by exact match, subset (AND), or intersection (OR)
- **Author attribution**: Track snippet creators and filter by author
- **Batch operations**: Create entire metadata hierarchies in single operations

---

## Architecture

- **Database**: Neo4j (graph database) for metadata relationships
- **API**: Node.js MCP server with stdio/http modes
- **Protocol**: Model Context Protocol for AI assistant integration
- **Storage**: Snippets stored with content, metadata links, and translations

---

## Environment variables

Create a `.env` file in the project root:

```env
# Neo4j Configuration
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Local use (when DB runs on host)
NEO4J_URI=bolt://localhost:7687

# Docker use (when app runs inside Docker)
# NEO4J_URI=bolt://neo4j:7687

# Server Configuration
PORT=3002
```

**Note**: Switch `NEO4J_URI` based on deployment mode (local vs Docker).

---

## Quick start – Local (DB in Docker, app local)

1. **Clone and setup**:
```bash
git clone <repo-url>
cd <repo-dir>
```

2. **Start Neo4j database**:
```bash
docker compose -f docker-compose.local.yml up -d
```

3. **Build and run application**:
```bash
npm install
npm run build
node dist/index.js stdio  # For MCP client integration
# or
node dist/index.js http   # For HTTP API
```

4. **Stop services**:
```bash
# Stop app: Ctrl+C
docker compose -f docker-compose.local.yml down
```

---

## Quick start – Full Docker (DB + app in Docker)

1. **Configure for Docker**: Edit `.env` to use `NEO4J_URI=bolt://neo4j:7687`

2. **Build and start**:
```bash
docker compose build
docker compose up -d
```

3. **Stop everything**:
```bash
docker compose down
```

---

## MCP Server Integration

MSM implements the Model Context Protocol, allowing AI assistants to interact with the snippet manager through standardized tool calls.

### Supported Clients

- **Claude Desktop** (recommended)
- **VSCode Copilot**
- **VSCode Continue**
- **Any MCP-compatible client**

### Configuration Examples

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "msm": {
      "command": "node",
      "args": ["/absolute/path/to/msm/dist/index.js", "stdio"]
    }
  }
}
```

**VSCode Continue** (`.continue/config.json`):
```json
{
  "mcpServers": [
    {
      "name": "msm",
      "command": "node",
      "args": ["/absolute/path/to/msm/dist/index.js", "stdio"]
    }
  ]
}
```

**Important**: You may need to manually add the `instructions.md` file content to your AI assistant's system prompt for optimal behavior. This file contains detailed guidelines for metadata management, search strategies, and best practices.

---

## How It Works

### Metadata Categories

1. **concept**: Abstract, language-independent concepts
   - Examples: `algorithm`, `sorting`, `recursion`, `tree`, `graph`
   - Transversal across programming languages

2. **language**: Language-specific constructs
   - Examples: `class`, `async`, `decorator`, `generic`, `lambda`
   - The programming language itself (Java, Python) is identified by file extension, NOT metadata

### Hierarchical Organization

Metadata forms parent-child trees:
```
algorithm
├── sorting
│   ├── quicksort
│   ├── mergesort
│   └── bubblesort
├── search
│   ├── binary
│   └── linear
└── graph
    ├── traversal
    └── shortest_path
```

### Translation System

Snippets can have translations in different programming languages:
- **Original snippet**: `quicksort.py` (Python implementation)
- **Translations**: 
  - `quicksort.py` → Java translation
  - `quicksort.py` → C++ translation
  - `quicksort.py` → TypeScript translation

All translations share the same metadata and are searchable together.

---

## Available Tools

### Metadata Management

**Creation**:
- `create_metadata_tree`: Create entire hierarchies at once
- `create_metadata_subtree`: Add branches to existing metadata
- `create_metadata_forest`: Create multiple independent trees

**Navigation**:
- `get_metadata_tree`: Retrieve metadata and descendants
- `get_metadata_forest`: Search multiple metadata by name (with language variants)
- `get_metadata_siblings`: Find related concepts at same level
- `get_metadata_siblings_forest`: Get siblings with their subtrees
- `get_metadata_path`: Get hierarchical path from root to metadata
- `get_whole_metadata_forest`: Retrieve entire metadata database (expensive)

**Modification**:
- `rename_metadata`: Change metadata name (preserves all relationships)
- `add_metadata_parent`: Connect metadata to create relationships
- `prune_metadata_branch`: Separate metadata from parent
- `delete_metadata`: Remove metadata (cascades to relationships)

### Snippet Management

**Creation**:
- `create_snippet`: Create new snippet with metadata
- `create_snippet_translation`: Add language translation of existing snippet

**Modification**:
- `update_snippet_content`: Update snippet code
- `update_snippet_metadata`: Change snippet's metadata associations
- `update_snippet_translation`: Update translation content

**Deletion**:
- `delete_snippets`: Remove snippets (cascades to translations)
- `delete_snippet_translation`: Remove specific language translation

### Search & Discovery

**By Name**:
- `search_snippet_by_name`: Find snippet by exact name

**By Metadata**:
- `get_snippets_by_metadata_subset`: Find snippets with ALL specified metadata (AND logic)
- `get_snippets_by_metadata_intersection`: Find snippets with ANY metadata (OR logic)

**Translations**:
- `get_snippet_with_translations`: Get snippet with all language versions
- `get_snippet_translations`: List available translations

**Filtering**: All snippet searches support optional `author` parameter for filtering by creator.

---

## Usage Guide

### For End Users

**Basic interaction patterns**:

1. **Storing a snippet** (vague):
   ```
   "Save this quicksort implementation [paste code]"
   ```
   → AI will analyze code, infer concepts, create appropriate metadata in English

2. **Storing a snippet** (explicit):
   ```
   "Store this snippet as bubble_sort.py with metadata: sorting, algorithm, iterative"
   ```
   → AI will verify metadata exists, create if missing, store snippet

3. **Searching snippets**:
   ```
   "Find sorting algorithms that use recursion in Java"
   ```
   → AI searches with multilingual variants, checks translations if not found as original

4. **Finding related snippets**:
   ```
   "Show me snippets similar to quicksort.py"
   ```
   → AI explores hierarchy, finds siblings, descendants, and translations

5. **Managing translations**:
   ```
   "Create a Java version of quicksort.py"
   ```
   → AI creates translation linked to original

6. **Language preference**:
   ```
   "I want metadata in Italian: 'ricorsione', 'ordinamento'"
   ```
   → AI will create as requested (though English is default)

### For AI Assistants

**Core principles**:

1. **Multilingual search strategy**: Always use `get_metadata_forest` with language variants, synonyms, and typos:
   ```json
   ["recursion", "ricorsione", "rekursion", "recursive", "recusrion"]
   ```

2. **Progressive data access**: Start specific, expand gradually
   - Forest search with variants (max 4-5 calls)
   - Navigate through found metadata (siblings, path)
   - Broader concepts if needed
   - Ask user before `get_whole_metadata_forest`

3. **Generous depth values**: Use maxDepth 5-8 for initial explorations (not all metadata exists)

4. **Verify before navigate**: Always check metadata exists before using `get_metadata_siblings`, `get_metadata_path`, etc.

5. **Translation awareness**: 
   - When snippet not found in requested language, automatically check translations
   - Never say "not found" without checking `get_snippet_with_translations`

6. **English-first creation**:
   - Create metadata in English by default
   - Inform user of the choice
   - Allow override if user insists

7. **Use rename for standardization**: Prefer `rename_metadata` over delete+recreate

---

## Best Practices

**For users**:
- Be as vague or specific as you want—AI adapts
- Search in your language; system handles translations
- Let AI suggest metadata; confirm or adjust
- Request English or local language metadata explicitly if desired

**For AI assistants** (from instructions.md):
- **Search**: Multilingual forest-first with generous depth
- **Create**: English metadata by default, inform user
- **Navigate**: Verify existence before using sibling/path functions
- **Translate**: Always check translations before reporting "not found"
- **Standardize**: Use `rename_metadata` for consistency
- **Batch operations**: Few large calls better than many small ones

**Naming conventions**:
- Snippet names: `lowercase_with_underscores.ext`
- Metadata names: `lowercase`, no spaces, meaningful terms
- Avoid: language names as metadata (use extension instead)

---

## Example Workflows

**1. Initialize empty database**:
```
User: "Set up standard programming concepts"
AI: → Creates hierarchies: algorithm→sorting/search, datastructure→linear/tree, etc.
```

**2. Store vague snippet**:
```
User: "Save this [sorting code]"
AI: → Analyzes code
    → Searches for existing metadata (multilingual)
    → Creates missing metadata in English
    → Suggests snippet name
    → Creates snippet
```

**3. Cross-language search**:
```
User: "Find recursive sorting in Java"
AI: → Forest search: ["recursion", "ricorsione", "recursive", "sorting", "ordinamento"]
    → Find snippets with metadata
    → Filter by extension="java"
    → Check translations for non-Java results
    → Present: originals + available translations
```

**4. Standardize metadata**:
```
User: "Convert all Italian metadata to English"
AI: → Identifies mixed-language metadata
    → Proposes renames: "ricorsione"→"recursion", "ordinamento"→"sorting"
    → Uses rename_metadata (preserves relationships)
    → Reports: "X metadata standardized, Y snippets updated"
```

**5. Create translation**:
```
User: "I need quicksort.py in Java"
AI: → Searches for quicksort.py
    → Checks existing translations (avoid duplicates)
    → Creates Java translation if not exists
    → Links to original snippet
```

---

**Ready to start?** Launch the server, connect your AI assistant, and begin organizing your code semantically!
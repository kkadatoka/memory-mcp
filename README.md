# Memory MCP
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/memory-mcp)](https://archestra.ai/mcp-catalog/jamesanz__memory-mcp)

A Model Context Protocol (MCP) server for logging and retrieving memories from LLM conversations with intelligent context window caching capabilities.

## Features

- **Save Memories**: Store memories from LLM conversations with timestamps and LLM identification
- **Retrieve Memories**: Get all stored memories with detailed metadata
- **Add Memories**: Append new memories without overwriting existing ones
- **Clear Memories**: Remove all stored memories
- **Context Window Caching**: Archive, retrieve, and summarize conversation context
- **Relevance Scoring**: Automatically score archived content relevance to current context
- **Tag-based Search**: Categorize and search context by tags
- **Conversation Orchestration**: External system to manage context window caching
- **MongoDB Storage**: Persistent storage using MongoDB database

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Configuration

Set the MongoDB connection string via environment variable:

```bash
export MONGODB_URI="mongodb://localhost:27017"
```

Default: `mongodb://localhost:27017`

## Usage

### Running the MCP Server

Start the MCP server:

```bash
npm start
```

### Running the Conversation Orchestrator Demo

Try the interactive CLI demo:

```bash
npm run cli
```

The CLI demo allows you to:

- Add messages to simulate conversation
- See automatic archiving when context gets full
- Trigger manual archiving and retrieval
- Create summaries of archived content
- Monitor conversation status and get recommendations

### Basic Memory Tools

1. **save-memories**: Save all memories to the database, overwriting existing ones
   - `memories`: Array of memory strings to save
   - `llm`: Name of the LLM (e.g., 'chatgpt', 'claude')
   - `userId`: Optional user identifier

2. **get-memories**: Retrieve all memories from the database
   - No parameters required
# Memory MCP

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/memory-mcp)](https://archestra.ai/mcp-catalog/jamesanz__memory-mcp)

A Model Context Protocol (MCP) server for logging and retrieving memories from LLM conversations with context-window caching, relevance scoring and MongoDB persistence.

## Quick start

Requirements:
- Node.js 18+ and npm
- MongoDB (local or remote)

Install dependencies and build:

```bash
npm install
npm run build
```

Run the server (after build):

```bash
npm start
```

Run the interactive CLI demo:

```bash
npm run cli
```

## Configuration

Set the MongoDB connection string via environment variable:

```bash
export MONGODB_URI="mongodb://localhost:27017/memorydb"
```

You can also set `PORT` to change the HTTP server port (default: 3000).

## Docker

Build and run with Docker (basic example):

```bash
docker build -t memory-mcp .
docker run -e MONGODB_URI="mongodb://host.docker.internal:27017/memorydb" -p 3000:3000 memory-mcp
```

Or use the included `docker-compose.yml` to run MongoDB + the app:

```bash
docker compose up --build
```

## Tools / API

This project exposes several MCP tools for managing memories and context. Key tools include:

- `save-memories` — Save (overwrite) memories
- `add-memories` — Append new memories
- `get-memories` — Retrieve all memories
- `clear-memories` — Clear stored memories
- `archive-context` — Archive context for conversation
- `retrieve-context` — Retrieve relevant archived context
- `score-relevance` — Score relevance of archived content
- `create-summary` — Create a summary and link to context

See the code in `src/` for full parameter lists and examples.

## Development notes

- Build: `npm run build` (uses `tsc`)
- Start: `npm start` (runs `node build/index.js`)
- CLI: `npm run cli` (runs `node build/cli.js`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit and push your changes
4. Open a pull request against `main`

If you need a PR created from your local branch, I can help automate that.

## License

ISC

## Acknowledgements

Thanks to the upstream project and contributors whose work inspired and enabled this repository. Special thanks to the maintainers of the original Memory MCP implementation and to anyone who contributed ideas, patches, or reviews. Your work makes projects like this possible.

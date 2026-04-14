# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Email:** Open a private issue on GitHub or contact the maintainer directly.

**Do not** open a public issue for security vulnerabilities.

## Scope

This is a research prototype. The engine itself has no network access, no authentication, and no data persistence — it's a pure function (input → output). Security concerns are limited to:

- The **web demo** (static site, no backend)
- The **playground server** (`src/playground/server.ts` — local development only, not intended for production)
- The **training inference server** (`training/serve.py` — local development only)
- The **optional LLM translation layer** (`src/engine/core/translation.ts` — uses `ANTHROPIC_API_KEY` from environment)

## API Keys

The project never hardcodes API keys. The optional LLM translation layer reads `ANTHROPIC_API_KEY` from `process.env`. If you fork or deploy this project, ensure your environment variables are not exposed.

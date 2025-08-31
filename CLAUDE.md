# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker proxy that converts API requests from various AI providers (Gemini, OpenAI) into Claude-compatible format. The project enables using Claude Code with different AI backends by translating request/response formats.

## Development Commands

### Local Development
```bash
pnpm dev              # Start development server with auto-formatting and type generation
```

### Deployment
```bash
pnpm deploycf         # Deploy to Cloudflare Workers with formatting and type generation
```

### Manual Commands
```bash
wrangler types        # Generate TypeScript types for Cloudflare Workers
pnpm prettier --write . # Format all code
wrangler dev --port 8080 # Start local development server
wrangler deploy       # Deploy to Cloudflare Workers
```

## Architecture

### Core Components

**Request Flow:**
1. `src/index.ts` - Main entry point, handles routing and provider selection
2. `src/provider.ts` - Interface defining the contract for provider implementations
3. `src/gemini.ts` - Gemini API provider implementation
4. `src/openai.ts` - OpenAI API provider implementation
5. `src/utils.ts` - Shared utilities for stream processing and data transformation
6. `src/types.ts` - TypeScript definitions for all API formats (Claude, Gemini, OpenAI)

**URL Structure:**
```
/{provider_type}/{provider_base_url}/v1/messages
```
- `provider_type`: Either `gemini` or `openai`
- `provider_base_url`: The target provider's API base URL (including version)

### Key Design Patterns

**Provider Pattern**: Each AI service implements the `Provider` interface with two methods:
- `convertToProviderRequest()`: Transforms Claude format → Provider format
- `convertToClaudeResponse()`: Transforms Provider format → Claude format

**Stream Processing**: Both streaming and non-streaming responses are supported through a unified stream processing utility in `utils.ts`.

**Tool Calling Support**: The proxy handles tool/function calling translation between different API formats, maintaining compatibility with Claude Code's tool system.

### Type System Structure

- **Claude Types**: Standard Claude API format (messages, tools, responses)
- **Provider Types**: Gemini and OpenAI specific formats 
- **Stream Types**: Event-based streaming for real-time responses

### Configuration

- `wrangler.jsonc`: Cloudflare Workers configuration
- `tsconfig.json`: TypeScript configuration optimized for Workers runtime
- `package.json`: Uses pnpm package manager (v10.12.2+)

## Testing the Proxy

Example request format:
```bash
curl -X POST https://your-worker.workers.dev/gemini/https://generativelanguage.googleapis.com/v1beta/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

API key can be provided via either `x-api-key` header or `Authorization` header.
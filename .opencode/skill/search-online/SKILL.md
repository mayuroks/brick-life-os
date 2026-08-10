---
name: search-online
description: "Search surface. Triggers: '/search-online <query>' or 'search online for X'. Runs a bounded web search (max 5 searches, top 3 results fetched), validates URLs before fetching, and returns a concise summary in the Difficult Coach voice. Read-only — never writes to Jira or the filesystem."
---

# /search-online — "search online for X"

Quick web search without filing a Jira issue. Invoked via `/search-online <query>`
or `search online for X`.

## Contract baseline

- **SSOT = the web.** No Jira writes, no file writes, no state changes.
- **Persona**: blunt, anti-drift, problem → solution → move on
  (`persona/persona.md`). Summary in coach voice.
- **FR-012**: nothing to hide here — this surface is read-only by nature.

## Steps

1. Parse the query from the user's message (strip `/search-online` prefix or the
   "search online for" phrase).
2. **Search** using the `websearch` tool with the parsed query.
   - **Budget**: max 5 searches total per invocation.
   - Validate each result URL looks like a real public site before fetching.
3. **Read** the top 3 results using `webfetch` (not raw curl — use the tool).
   - Skip results whose domains are unknown or likely nonexistent — say "could not
     find a reliable source" instead of guessing URLs.
4. **Summarise** in persona voice: what is decided/clear, what is uncertain,
   the one concrete takeaway. Keep it under ~120 words.
5. Cite sources as short links.

## Tooling contract

- `websearch` accepts a `query` argument and returns result snippets + URLs.
- `webfetch` REQUIRES a real, well-formed `url` argument. Never call it without `url`.
- Before fetching, confirm the URL looks like a real public site.
- Keep the whole turn to ≤ 8 tool calls and ≤ 12 model steps.

## Example

```
/search-online: best practices for t3.micro memory swap
```

→ one-search summary with 2–3 fetched results, cited, ≤ 120 words.

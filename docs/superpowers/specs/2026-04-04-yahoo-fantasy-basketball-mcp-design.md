# Yahoo Fantasy Basketball MCP Server — Design Spec

## Overview

A stdio-based MCP server in TypeScript that gives LLM clients (Claude Code, etc.) comprehensive access to Yahoo Fantasy Basketball — league info, player data, matchup projections, and streaming recommendations.

Built on the `yahoo-fantasy` npm package for API access and OAuth, and `@modelcontextprotocol/sdk` for the MCP server framework.

## Architecture

```
src/
├── index.ts              # Entry point, stdio transport
├── server.ts             # MCP server, tool registration
├── auth.ts               # OAuth 2.0 (browser + manual fallback)
├── token-store.ts        # Token/config persistence
├── yahoo-client.ts       # yahoo-fantasy wrapper + response cleaning
├── cache.ts              # In-memory TTL cache
├── stat-mapping.ts       # Stat ID → human name mapping
├── league-tools.ts       # League info tools
├── player-tools.ts       # Player search/stats tools
├── roster-tools.ts       # Add/drop tools (nice-to-have)
└── analytics-tools.ts    # Projections + streaming (nice-to-have)
```

## Authentication

**OAuth 2.0 Authorization Code flow via `yahoo-fantasy` package.**

- Credentials provided via env vars: `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`
- Primary flow: spin up temp local HTTP server on `localhost:9876`, open browser to Yahoo consent URL, receive callback with auth code, exchange for tokens
- Fallback: if no callback within 60s, print auth URL to stderr and accept pasted authorization code from stdin
- Tokens stored at `~/.config/yahoo-fantasy-mcp/tokens.json`
- Auto-refresh on access token expiry
- On revoked/expired refresh token: re-trigger full auth flow, log "Session expired, re-authenticating..." to stderr

## League Discovery

- On first auth, fetch all user's NBA fantasy leagues
- Present list to stderr, user picks default
- Default stored in `~/.config/yahoo-fantasy-mcp/config.json`
- All tools accept optional `league_key` param to override default
- `set_default_league` tool to change without re-auth

## Configuration

| Item | Location | Rationale |
|------|----------|-----------|
| Yahoo credentials | Env vars (`YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`) | Secrets belong in env, matches MCP client config patterns |
| OAuth tokens | `~/.config/yahoo-fantasy-mcp/tokens.json` | Runtime state managed by server |
| Default league | `~/.config/yahoo-fantasy-mcp/config.json` | User preference managed by server |

## Tools — Must-Have

### League Info

| Tool | Description | Params |
|------|-------------|--------|
| `get_league_settings` | Scoring type, roster positions, trade deadline, etc. | `league_key?` |
| `get_standings` | League standings with records and category totals | `league_key?` |
| `get_scoreboard` | Current/specified week's matchups and scores | `league_key?`, `week?` |
| `get_teams` | All teams in the league with basic info | `league_key?` |
| `get_team_roster` | A team's full roster with player details | `team_key`, `league_key?` |

### Player Data

| Tool | Description | Params |
|------|-------------|--------|
| `search_players` | Search by name, returns stats + ownership status | `name`, `league_key?` |
| `get_free_agents` | Browse available players with filters | `position?`, `sort_by?`, `limit?`, `league_key?` |
| `get_player_stats` | Detailed stats for a specific player | `player_key`, `league_key?` |

### Config

| Tool | Description | Params |
|------|-------------|--------|
| `set_default_league` | Switch the default league | `league_key` |

## Tools — Nice-to-Have

### Roster Management

| Tool | Description | Params |
|------|-------------|--------|
| `add_player` | Add a free agent, optionally dropping someone | `player_key`, `drop_player_key?`, `league_key?` |
| `drop_player` | Drop a player from roster | `player_key`, `league_key?` |

### Analytics

| Tool | Description | Params |
|------|-------------|--------|
| `get_matchup_projection` | Projected category totals for a matchup week based on per-game averages x scheduled games | `week?`, `team_key?`, `league_key?` |
| `get_streaming_recommendations` | Free agents whose remaining games + category strengths address weaknesses in your current matchup | `week?`, `limit?`, `league_key?` |

## Data Format

- All tool responses return cleaned, flattened JSON
- Stat IDs mapped to human-readable names (FG%, 3PM, REB, AST, STL, BLK, TO, PTS, etc.)
- Stat mapping fetched once from league settings endpoint, cached for session
- Ownership status (free agent / waivers / owned + owner team) included in all player responses
- Deeply nested Yahoo API structures flattened to shallow objects

## Caching

Simple in-memory `Map<string, { data, expiry }>`. No external cache needed — server lifecycle matches a conversation session.

| Data | TTL |
|------|-----|
| League settings | Session |
| Stat ID → name mapping | Session |
| Standings | 5 min |
| Scoreboard | 60s |
| Player stats/search | 2 min |
| Roster data | 60s |

## Error Handling

Human-readable error strings returned to the LLM. No error codes or structured error objects.

Examples:
- "Player 'Lebrun James' not found. Did you mean 'LeBron James'?"
- "Yahoo API rate limit hit. Try again in 30 seconds."
- "No default league set. Use set_default_league first, or pass league_key."

## Testing

- Unit tests (vitest) for data transformation layer: stat mapping, response cleaning/flattening, cache behavior
- Mock `yahoo-fantasy` client at the interface level
- Manual evaluation of LLM tool selection against real league data
- No automated testing of auth flow or non-deterministic LLM behavior

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` — MCP server framework
- `yahoo-fantasy` — Yahoo API wrapper + OAuth
- `zod` — tool input validation
- `open` — open browser for auth flow

### Dev
- `typescript`
- `vitest`
- `@types/node`

## Setup Guide (for users)

1. Create a Yahoo Developer app at https://developer.yahoo.com/ with Fantasy Sports API read/write access
2. Note your Consumer Key and Consumer Secret
3. Configure in Claude Code's MCP settings with env vars
4. On first tool call, complete the OAuth flow in browser
5. Server auto-discovers leagues, pick your default

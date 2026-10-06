# Yahoo Fantasy Basketball MCP Server

MCP server that gives AI assistants access to your Yahoo Fantasy Basketball league.

## Features

- League info and settings
- Standings and scoreboard
- Player search and free agent browsing
- Matchup projections
- Streaming recommendations

## Setup

### Prerequisites

- Node.js 18+
- A Yahoo Developer app with Fantasy Sports API access

### Getting Yahoo API Credentials

1. Go to https://developer.yahoo.com/
2. Create a new app
3. Select "Fantasy Sports" API with Read access
4. Set the redirect URI to `https://localhost:9876/callback`
5. Note your Client ID and Client Secret

### Installation

```bash
npm install
npm run build
```

### Configuration in Claude Code

Add to your MCP settings (`claude_desktop_config.json` or similar):

```json
{
  "mcpServers": {
    "yahoo-fantasy-basketball": {
      "command": "node",
      "args": ["/absolute/path/to/yahoo-fantasy-basketball-mcp/build/index.js"],
      "env": {
        "YAHOO_CLIENT_ID": "your_client_id",
        "YAHOO_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## First Use

On first tool call, the server opens a browser for Yahoo OAuth authorization. After authorizing, tokens are saved and refreshed automatically.

## Available Tools

| Tool | Description |
|------|-------------|
| set_default_league | Set your default league |
| get_league_settings | League scoring and settings |
| get_standings | Current standings |
| get_scoreboard | Weekly matchup scores |
| get_teams | All teams in league |
| get_team_roster | A team's full roster |
| search_players | Search players by name |
| get_free_agents | Browse available players |
| get_player_stats | Detailed player stats |
| get_matchup_projection | Project matchup category totals |
| get_streaming_recommendations | Find best streaming pickups |

## Development

```bash
npm run build    # Compile TypeScript
npm test         # Run tests
```

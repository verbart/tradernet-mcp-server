<p align="center">
  <img src="logo.jpg" alt="Tradernet" width="120" />
</p>

<h1 align="center">Tradernet MCP Server</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/tradernet-mcp"><img src="https://img.shields.io/npm/v/tradernet-mcp" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

MCP server for the [Tradernet](https://tradernet.com) / [Freedom24](https://freedom24.com) trading platform API. Manage your portfolio, place orders, get quotes, search tickers, set alerts — all through AI assistants like Claude.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_user_data` | Account info, portfolio summary, open positions |
| `get_portfolio` | Current positions, balances, P&L |
| `place_order` | Place buy/sell/short/margin orders |
| `cancel_order` | Cancel an active order |
| `set_stop_loss_take_profit` | Set SL/TP for a position |
| `get_security_info` | Ticker details (currency, exchange, min step) |
| `get_quotes_history` | Historical OHLCV candlestick data |
| `search_tickers` | Search securities by name or symbol |
| `add_price_alert` | Set a price alert with notifications |
| `delete_price_alert` | Remove a price alert |
| `get_security_sessions` | List open security sessions |
| `raw_api_call` | Call any Tradernet API command directly |

## Setup

### 1. Get API Keys

1. Log in to [Tradernet](https://tradernet.com) or [Freedom24](https://freedom24.com)
2. Go to your profile settings
3. Generate API keys (Public Key and Private Key)

### 2. Configure

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "tradernet": {
      "command": "npx",
      "args": ["-y", "tradernet-mcp"],
      "env": {
        "TRADERNET_PUBLIC_KEY": "your_public_key",
        "TRADERNET_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

#### Claude Code

```bash
claude mcp add tradernet -- npx -y tradernet-mcp
```

Then set environment variables `TRADERNET_PUBLIC_KEY` and `TRADERNET_PRIVATE_KEY`.

## Usage Examples

Once connected, you can ask your AI assistant things like:

- "Show my portfolio"
- "What are my open positions?"
- "Buy 10 shares of AAPL"
- "Set stop-loss for SBER at 250"
- "Search for Tesla stock"
- "Show AAPL price history for the last month"
- "Set an alert when MSFT crosses $400"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRADERNET_PUBLIC_KEY` | Yes | Your Tradernet API public key |
| `TRADERNET_PRIVATE_KEY` | Yes | Your Tradernet API private key |
| `TRADERNET_API_URL` | No | API base URL (default: `https://tradernet.com/api`) |

## API Documentation

This server implements the [Tradernet API](https://tradernet.com/tradernet-api). For the full API reference, see the [official documentation](https://github.com/tradernet/tn.api).

## License

MIT

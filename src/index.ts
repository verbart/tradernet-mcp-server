#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import crypto from "crypto";
import axios from "axios";
import { z } from "zod";

// --- Configuration ---

const PUBLIC_KEY = process.env.TRADERNET_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.TRADERNET_PRIVATE_KEY ?? "";
const API_BASE = process.env.TRADERNET_API_URL ?? "https://tradernet.com/api";

// --- API Client ---

function generateSignature(data: string): string {
  return crypto.createHmac("sha256", PRIVATE_KEY).update(data).digest("hex");
}

async function callApi(command: string, params: Record<string, unknown> = {}) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error(
      "TRADERNET_PUBLIC_KEY and TRADERNET_PRIVATE_KEY environment variables are required"
    );
  }

  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify(params);

  const headers = {
    "Content-Type": "application/json",
    "X-NtApi-PublicKey": PUBLIC_KEY,
    "X-NtApi-Timestamp": timeStamp,
    "X-NtApi-Sig": generateSignature(payload + timeStamp),
  };

  const response = await axios.post(`${API_BASE}/${command}`, payload, {
    headers,
  });
  return response.data;
}


function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// --- MCP Server ---

function createServer() {
  const server = new McpServer({
    name: "tradernet",
    version: "1.0.0",
  });

  registerTools(server);
  return server;
}

export function createSandboxServer() {
  return createServer();
}

const server = createServer();

function registerTools(server: McpServer) {

// ==========================================
// Authentication & User Info
// ==========================================

server.tool(
  "get_user_data",
  "Get initial user data (account info, portfolio summary, open positions). This is the primary command to check your account status.",
  {},
  async () => {
    try {
      const data = await callApi("getOPQ", {});
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Portfolio
// ==========================================

server.tool(
  "get_portfolio",
  "Get current portfolio positions and account balances. Returns account funds, open positions with P&L, market values, and settlement info.",
  {},
  async () => {
    try {
      const data = await callApi("getPositionJson", {});
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Orders
// ==========================================

server.tool(
  "place_order",
  "Place a new trading order (buy, sell, short, margin). Returns order_id on success.",
  {
    instrument: z
      .string()
      .describe('Ticker symbol, e.g. "AAPL.US", "SBER", "SIE.EU"'),
    action: z
      .enum(["buy", "buy_margin", "sell", "sell_short"])
      .describe("Order action"),
    order_type: z
      .enum(["market", "limit", "stop", "stop_limit"])
      .describe("Order type"),
    quantity: z.number().int().positive().describe("Number of shares/lots"),
    limit_price: z.number().optional().describe("Limit price (for limit and stop_limit orders)"),
    stop_price: z.number().optional().describe("Stop price (for stop and stop_limit orders)"),
    expiration: z
      .enum(["day", "day_ext", "gtc"])
      .default("day")
      .describe("Order expiration: day, day+extended, or good-till-cancelled"),
  },
  async ({ instrument, action, order_type, quantity, limit_price, stop_price, expiration }) => {
    const actionMap = { buy: 1, buy_margin: 2, sell: 3, sell_short: 4 };
    const typeMap = { market: 1, limit: 2, stop: 3, stop_limit: 4 };
    const expMap = { day: 1, day_ext: 2, gtc: 3 };

    try {
      const data = await callApi("putTradeOrder", {
        instr_name: instrument,
        action_id: actionMap[action],
        order_type_id: typeMap[order_type],
        qty: quantity,
        limit_price: limit_price ?? 0,
        stop_price: stop_price ?? 0,
        expiration_id: expMap[expiration],
      });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "cancel_order",
  "Cancel an active order by its ID",
  {
    order_id: z.number().describe("Order ID to cancel"),
  },
  async ({ order_id }) => {
    try {
      const data = await callApi("delTradeOrder", { order_id });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "set_stop_loss_take_profit",
  "Set stop-loss and/or take-profit for a position. Pass null to leave unchanged.",
  {
    instrument: z.string().describe('Ticker symbol, e.g. "AAPL.US"'),
    stop_loss: z.number().nullable().describe("Stop-loss price, or null to skip"),
    take_profit: z.number().nullable().describe("Take-profit price, or null to skip"),
    trailing_stop_percent: z
      .number()
      .nullable()
      .optional()
      .describe("Trailing stop-loss percentage, or null to skip"),
  },
  async ({ instrument, stop_loss, take_profit, trailing_stop_percent }) => {
    try {
      const data = await callApi("putStopLoss", {
        instr_name: instrument,
        stop_loss,
        take_profit,
        stoploss_trailing_percent: trailing_stop_percent ?? null,
      });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Market Data & Quotes
// ==========================================

server.tool(
  "get_security_info",
  "Get detailed information about a security/ticker (name, currency, exchange, min step, etc.)",
  {
    ticker: z.string().describe('Ticker symbol, e.g. "AAPL.US", "SBER"'),
  },
  async ({ ticker }) => {
    try {
      const data = await callApi("getSecurityInfo", { ticker, sup: true });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_quotes_history",
  "Get historical candlestick (OHLCV) data for a ticker. Returns arrays of high/low/open/close prices with timestamps.",
  {
    ticker: z.string().describe('Ticker symbol, e.g. "AAPL.US"'),
    timeframe: z
      .enum(["1", "5", "15", "60", "1440"])
      .describe("Candle interval in minutes: 1, 5, 15, 60 (1h), or 1440 (1d)"),
    date_from: z
      .string()
      .describe('Start date in format "DD.MM.YYYY hh:mm", e.g. "01.01.2025 00:00"'),
    date_to: z
      .string()
      .describe('End date in format "DD.MM.YYYY hh:mm", e.g. "31.01.2025 23:59"'),
    count: z
      .number()
      .int()
      .default(0)
      .describe("Extra candlesticks beyond the date range (0 = none)"),
  },
  async ({ ticker, timeframe, date_from, date_to, count }) => {
    try {
      const data = await callApi("getHloc", {
        id: ticker,
        timeframe: parseInt(timeframe),
        date_from,
        date_to,
        count,
        intervalMode: "ClosedRay",
      });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_tickers",
  'Search for securities/tickers by name or symbol. Supports market filter with @ syntax, e.g. "AAPL@FIX" for NYSE/NASDAQ.',
  {
    query: z
      .string()
      .describe(
        'Search text. Use "TICKER@MARKET" to filter by market. Markets: MCX (MICEX), FORTS (derivatives), FIX (NYSE/NASDAQ), EU (Europe), KASE (Kazakhstan)'
      ),
  },
  async ({ query }) => {
    try {
      const data = await callApi("tickerFinder", { text: query });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Price Alerts
// ==========================================

server.tool(
  "add_price_alert",
  "Set a price alert for a ticker. You'll be notified when the price condition is met.",
  {
    ticker: z.string().describe('Ticker symbol in Tradernet format, e.g. "AAPL.US"'),
    price: z.string().describe("Target price for the alert"),
    trigger_type: z
      .enum([
        "crossing",
        "crossing_down",
        "crossing_up",
        "less_then",
        "greater_then",
        "channel_in",
        "channel_out",
        "moving_down_from_current",
        "moving_up_from_current",
        "moving_down_from_maximum",
        "moving_up_from_minimum",
      ])
      .describe("When to trigger the alert"),
    quote_type: z
      .enum(["ltp", "bap", "bbp", "op", "pp"])
      .default("ltp")
      .describe(
        "Price basis: ltp (last trade), bap (best bid), bbp (best ask), op (open), pp (close)"
      ),
    notification_type: z
      .enum(["email", "sms", "push", "all"])
      .default("push")
      .describe("How to notify: email, sms, push, or all"),
    alert_period: z
      .enum(["0", "60", "300", "900", "3600", "86400"])
      .default("0")
      .describe("Re-alert frequency in seconds (0 = once)"),
  },
  async ({ ticker, price, trigger_type, quote_type, notification_type, alert_period }) => {
    try {
      const data = await callApi("togglePriceAlert", {
        ticker,
        price: { price },
        trigger_type,
        quote_type,
        notification_type,
        alert_period,
        expire: 0,
      });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "delete_price_alert",
  "Delete an existing price alert by its ID",
  {
    alert_id: z.number().describe("Alert ID to delete"),
  },
  async ({ alert_id }) => {
    try {
      const data = await callApi("togglePriceAlert", {
        id: alert_id,
        del: true,
        quote_type: "ltp",
        notification_type: "email",
      });
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Security Sessions
// ==========================================

server.tool(
  "get_security_sessions",
  "Get list of currently open security sessions (for two-factor authentication operations)",
  {},
  async () => {
    try {
      const data = await callApi("getSecuritySessions", {});
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// ==========================================
// Generic API call (escape hatch)
// ==========================================

server.tool(
  "raw_api_call",
  "Make a raw API call to any Tradernet command. Use this for commands not covered by other tools.",
  {
    command: z.string().describe("API command name"),
    params: z
      .string()
      .default("{}")
      .describe("JSON string of parameters"),
    use_v2: z
      .boolean()
      .default(false)
      .describe("Use API v2 endpoint (/api/v2/cmd/) instead of v1"),
  },
  async ({ command, params, use_v2 }) => {
    try {
      const parsed = JSON.parse(params);
      const data = use_v2
        ? await callApi(command, parsed)
        : await callApi(command, parsed);
      return { content: [{ type: "text", text: formatResult(data) }] };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  }
);

} // end registerTools

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

#!/usr/bin/env ts-node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";

// Schema for input validation
const PriceArgsSchema = z.object({
  coin: z.string().min(1),
  currency: z.string().optional().default("usd"),
});

type PriceArgs = z.infer<typeof PriceArgsSchema>;

interface CoinGeckoResponse {
  [coinId: string]: {
    [currency: string]: number;
  };
}

// Create MCP server
const server = new Server(
  {
    name: "crypto",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool metadata
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get-crypto-price",
      description: "Fetch current price of a cryptocurrency from CoinGecko",
      inputSchema: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description: "CoinGecko coin ID (e.g., bitcoin, ethereum)",
          },
          currency: {
            type: "string",
            description: "Fiat currency (e.g., usd, eur). Default is 'usd'.",
          },
        },
        required: ["coin"],
      },
    },
  ],
}));

// Handle tool call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;

  if (name === "get-crypto-price") {
    try {
      const args = PriceArgsSchema.parse(rawArgs);
      const { coin, currency } = args;

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}`;
      const res = await fetch(url);
      const data = (await res.json()) as CoinGeckoResponse;

      const price = data[coin]?.[currency];
      if (!price) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find price for ${coin} in ${currency}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `${coin.toUpperCase()} = ${price} ${currency.toUpperCase()}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err.message}`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Crypto MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatToolError } from "../common";
import { searchUsers } from "./tools/database.tool";
import { handleFileOperation } from "./tools/file.tool";
import { handleWeatherQuery } from "./tools/weather.tool";

const server = new McpServer({
  name: "nestjs-mcp-server",
  version: "1.0.0",
});
//如果你写了 outputSchema，建议保留 structuredContent，而且它必须符合 outputSchema 的对象结构。
//如果你只想返回普通文本，可以去掉 outputSchema 和 structuredContent，只返回 content 就行。
server.registerTool(
  "search-users",
  {
    description: "搜索用户",
    inputSchema: {
      page: z.string().describe("当前页码").default("1"),
      pageSize: z.string().describe("每页记录数").default("10"),
      name: z.string().describe("用户名称").optional(),
      role: z.string().describe("角色").optional(),
    },
    outputSchema: {
      pagination: z.object({
        total: z.number().describe("总记录数"),
        totalPage: z.number().describe("总页数"),
        currentPage: z.number().describe("当前页码"),
        pageSize: z.number().describe("每页记录数"),
        hasNextPage: z.boolean().describe("是否有下一页"),
        hasPreviousPage: z.boolean().describe("是否有上一页"),
      }),
      data: z.array(
        z.object({
          id: z.number().describe("用户 ID"),
          name: z.string().describe("用户名称"),
          email: z.string().describe("邮箱"),
          role: z.string().describe("角色"),
          createdAt: z.string().describe("创建时间"),
          updatedAt: z.string().describe("更新时间"),
        }),
      ),
    },
  },
  async ({ page, pageSize, name, role }) => {
    try {
      const res = await searchUsers({ page, pageSize, name, role });

      return {
        structuredContent: res,
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    } catch (error) {
      const message = formatToolError(error);

      return {
        isError: true,
        structuredContent: {
          pagination: {
            total: 0,
            totalPage: 0,
            currentPage: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          data: [],
        },
        content: [{ type: "text", text: message }],
      };
    }
  },
);

server.registerTool(
  "read-file",
  {
    description: "读取项目目录内的文件",
    inputSchema: {
      path: z.string().describe("文件路径"),
    },
    outputSchema: {
      content: z.string().describe("文件内容"),
    },
  },
  async ({ path }) => {
    try {
      const fileContent = await handleFileOperation("read", { path });

      return {
        structuredContent: { content: fileContent },
        content: [{ type: "text", text: fileContent }],
      };
    } catch (error) {
      const message = formatToolError(error);

      return {
        isError: true,
        structuredContent: { content: message },
        content: [{ type: "text", text: message }],
      };
    }
  },
);

server.registerTool(
  "weather-query",
  {
    description: "查询天气",
    inputSchema: {
      city: z.string().describe("城市名称"),
    },
    outputSchema: {
      content: z.string().describe("天气信息"),
    },
  },
  async ({ city }) => {
    try {
      const result = await handleWeatherQuery({ city });

      return {
        structuredContent: { content: result },
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      const message = formatToolError(error);

      return {
        isError: true,
        structuredContent: { content: message },
        content: [{ type: "text", text: message }],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Server] 已启动，等待 Client 连接...');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

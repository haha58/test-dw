import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getStringEnv, MCP_SERVER_ARGS, MCP_SERVER_COMMAND } from '../common';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private transport: StdioClientTransport;

  // ── 模块启动时连接 MCP Server ──────────────────────
  async onModuleInit() {
    this.client = new Client(
      {
        name: 'nestjs-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );
    // stdio 模式：NestJS 以子进程方式启动 MCP Server
    this.transport = new StdioClientTransport({
      command: MCP_SERVER_COMMAND,
      args: MCP_SERVER_ARGS,
      // 把当前环境变量传给子进程（包含 DATABASE_URL 等）
      env: getStringEnv(),
    });

    await this.client.connect(this.transport);
    console.log('MCP client connected');
  }

  // ── 获取所有可用工具列表 ──────────────────────────
  async getToolList() {
    const response = await this.client.listTools()
    return response.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
  }

  // ── 调用指定工具 ──────────────────────────────────
  async callTool(toolName: string, args: Record<string, unknown> = {}) {
    const response = await this.client.callTool({
      name: toolName,
      arguments: args,
    });
    console.log('MCP client call tool:', response.content);
    return {
      tool: toolName,
      result: response.structuredContent ?? '工具无返回内容',
      isError: response.isError ?? false,
    }
  }

  // ── 应用退出时断开连接 ─────────────────────────────
  async onModuleDestroy() {
    await this.client.close();
    console.log('MCP client closed');
  }
}

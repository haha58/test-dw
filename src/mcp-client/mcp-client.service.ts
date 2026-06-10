import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private transport: StdioClientTransport;

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

    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/src/mcp-server/server.js'],
      // 把当前环境变量传给子进程（包含 DATABASE_URL 等）
      env: getStringEnv(),
    });

    await this.client.connect(this.transport);
    console.log('MCP client connected');
  }

  async getToolList() {
    const response = await this.client.listTools()
    return response.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
  }

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

  async onModuleDestroy() {
    await this.client.close();
    console.log('MCP client closed');
  }
}

function getStringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

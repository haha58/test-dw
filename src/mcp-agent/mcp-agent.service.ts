import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { createAgent } from 'langchain';
import { getStringEnv, MCP_SERVER_ARGS, MCP_SERVER_COMMAND } from '../common';
import { config } from '../config';

@Injectable()
export class McpAgentService implements OnModuleInit, OnModuleDestroy {
  // MultiServerMCPClient：可以同时连接多个 MCP Server。
  private mcpClient!: MultiServerMCPClient;

  // 从 MCP Server 转换得到的 LangChain Tools。
  private mcpTools: any[] = [];

  // 本地 Ollama 模型。这里降低 numCtx/numPredict，避免 qwen3:8b 占用过多内存。
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.host,
    temperature: config.ollama.temperature,
    think: false,
    numCtx: 1024,
    numPredict: 256,
  });

  // 模块启动时初始化 MCP 连接，并加载 MCP 工具。
  async onModuleInit() {
    this.mcpClient = new MultiServerMCPClient({
      // 自定义本地 MCP Server，使用 stdio 模式启动。
      'local-tools': {
        transport: 'stdio',
        command: MCP_SERVER_COMMAND,
        args: MCP_SERVER_ARGS,
        cwd: process.cwd(),
        stderr: 'inherit',
        env: getStringEnv(),
      },

      // 也可以连接社区现成的 MCP Server（举例，需要单独安装）
      // 'filesystem': {
      //   transport: 'stdio',
      //   command: 'npx',
      //   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      // },
    });

    // 把所有 MCP Server 的工具转成 LangChain Tools 格式，像普通 LangChain Tool 一样使用
    this.mcpTools = await this.mcpClient.getTools();
    console.log(
      'MCP agent connected, tools:',
      this.mcpTools.map((tool) => tool.name),
    );
  }

  // 获取当前 Agent 可用的工具列表，方便调试确认工具是否加载成功。
  async getToolList() {
    return this.mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }));
  }

  // 让 Agent 根据用户问题自行判断是否需要调用 MCP 工具。
  async runAgent(message: string) {
    if (this.mcpTools.length === 0) {
      return {
        success: false,
        message: 'No MCP tools loaded',
        data: null,
      };
    }

    const agent = createAgent({
      model: this.llm,
      tools: this.mcpTools,
      systemPrompt: [
        'You are a helpful assistant.',
        'Use MCP tools when the user asks about weather, files, or users.',
        'For weather questions, call the weather-query tool with a city argument.',
        'Supported weather cities are Beijing, Shanghai, Wuhan, Guangzhou, and Shenzhen.',
        'Answer the user in Chinese.',
      ].join('\n'),
    });

    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });
    console.log(result.messages);

    // Agent 最后一条消息一般就是最终回答。
    return result.messages.at(-1)?.content
  }

  // 应用退出时关闭 MCP 连接，避免子进程残留。
  async onModuleDestroy() {
    await this.mcpClient?.close();
    console.log('MCP agent closed');
  }
}

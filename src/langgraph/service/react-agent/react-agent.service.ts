import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  StateGraph, START, END, MessagesAnnotation, MemorySaver, GraphRecursionError,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { tool }     from '@langchain/core/tools'
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { ToolCall } from '@langchain/core/messages/tool'
import { z } from 'zod'
import { ChatOllama } from '@langchain/ollama'
import { config } from 'src/config'

// ── 工具定义 ──────────────────────────────────────────
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = Function(`'use strict'; return (${expression})`)()
      return `计算结果：${expression} = ${result}`
    } catch (e: any) {
      return `计算错误：${e.message}`
    }
  },
  {
    name:        'calculator',
    description: '计算数学表达式，例如：(2 + 3) * 4',
    schema:      z.object({
      expression: z.string().describe('合法的 JS 数学表达式'),
    }),
  }
)

const weatherTool = tool(
  async ({ city }) => {
    const mock: Record<string, string> = {
    '北京': '晴，25°C，东北风 3 级',
    '上海': '多云，28°C，东风 2 级',
    '武汉': '晴，30°C，南风 1 级',
    '广州': '雷阵雨，32°C，南风 2 级',
  }
  return mock[city] ?? `${city}：晴，22°C，微风`
},
{
  name:        'get_weather',
    description: '查询指定城市的当前天气',
    schema:      z.object({
    city: z.string().describe('城市名，如：北京、上海、武汉'),
  }),
    }
)

const tools = [calculatorTool, weatherTool]
const toolsByName: Record<string, any> = Object.fromEntries(
  tools.map((tool) => [tool.name, tool]),
)

@Injectable()
  export class ReactAgentService implements OnModuleInit {
    private llm: any;
    private graph: any;

    onModuleInit() {
        this.llm = new ChatOllama({
            model: config.ollama.chatModel, // Ollama 模型名称
            temperature: config.ollama.temperature, // 生成文本的随机程度
            baseUrl: config.ollama.host, // Ollama 服务器地址
            think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
            numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
        });
      // bindTools：把工具的 name/description/schema 注入 LLM
      // LLM 推理时知道有哪些工具可以调，需要时自动生成 tool_calls
      const llmWithTools = this.llm.bindTools(tools)

      // 手动执行 LLM 返回的 tool_calls，便于自定义错误处理和并发执行
      const callModel = async (state: typeof MessagesAnnotation.State) => {
        const messages = [
          new SystemMessage(`你是专业助手，可用工具：
- calculator：数学计算
- get_weather：查询天气
根据问题决定是否调用工具。`),
          ...state.messages,
        ]
        const response = await llmWithTools.invoke(messages)
        return { messages: [response] }
      }

      const callTools: GraphNode<typeof MessagesAnnotation> = async (state) => {
        const lastMsg = state.messages.at(-1)!
        const toolCalls: ToolCall[] =
          lastMsg instanceof AIMessage ? (lastMsg.tool_calls ?? []) : []

        const results = await Promise.all(
          toolCalls.map(async (tc: ToolCall) => {
            const id = tc.id ?? ''
            try {
              const handler = toolsByName[tc.name]
              if (!handler) {
                return new ToolMessage({
                  content: `未知工具: ${tc.name}`,
                  tool_call_id: id,
                })
              }

              const result = await handler.invoke(tc)
              const content = typeof result === 'string' ? result : String(result)
              return new ToolMessage({ content, tool_call_id: id })
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err)
              return new ToolMessage({
                content: `工具执行失败: ${errorMsg}`,
                tool_call_id: id,
              })
            }
          }),
        )

        return { messages: results }
      }

      // 路由函数：检查最后一条消息是否包含 tool_calls
      const shouldContinue = (state: typeof MessagesAnnotation.State) => {
        const last = state.messages.at(-1) as AIMessage
        // 有 tool_calls → 去执行工具，继续循环
        // 没有 tool_calls → LLM 已给出最终答案，结束
        return (last.tool_calls?.length ?? 0) > 0 ? 'tools' : END
      }

      this.graph = new StateGraph(MessagesAnnotation)
        .addNode('callModel', callModel)
        .addNode('tools',     callTools)
        .addEdge(START, 'callModel')
        .addConditionalEdges('callModel', shouldContinue, {
          tools: 'tools',
          [END]:  END,
        })
        .addEdge('tools', 'callModel')   // 工具执行完 → 回到 LLM，形成循环
      .compile({ checkpointer: new MemorySaver() })

    console.log('✅ ReAct Agent 初始化完成')
  }

  async chat(threadId: string, message: string): Promise<string> {
    try {
      const result = await this.graph.invoke(
        { messages: [new HumanMessage(message)] },
        {
          configurable:   { thread_id: threadId },
          recursionLimit: 20,   // 限制图最多执行 20 步，防止工具调用死循环
        }
      )
      return result.messages.at(-1).content as string
    } catch (err) {
      if (err instanceof GraphRecursionError) {
        return '工具调用次数过多，已停止执行，避免陷入死循环。'
      }

      const errorMsg = err instanceof Error ? err.message : String(err)
      return `处理失败: ${errorMsg}`
    }
  }
}

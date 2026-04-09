import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import type { Response } from 'express'
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { config } from '../config'
@Injectable()
export class FunctionCallingService {
    // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    });

    // // ── 业务工具定义 ──────────────────────────────────────
    // 工具一：查询商品库存
    private checkInventoryTool = tool(
        async ({ productName }: { productName: string }) => {
            // 模拟数据库查询（实际项目可以注入 PrismaService 查真实数据库）
            const db: Record<string, { stock: number; price: number }> = {
                'iPhone 18': { stock: 50, price: 7999 },
                'MacBook Pro': { stock: 10, price: 15999 },
                'AirPods Pro': { stock: 200, price: 1799 },
            }
            const item = db[productName]
            if (!item) return JSON.stringify({ found: false, message: `未找到：${productName}` })
            return JSON.stringify({
                found: true,
                productName,
                stock: item.stock,
                price: item.price,
                status: item.stock > 0 ? '有货' : '缺货',
            })
        },
        {
            name: 'check_inventory',
            description: '查询商品库存和价格',
            schema: z.object({
                productName: z.string().describe('商品名称，例如 iPhone 16'),
            }),
        },
    )

    // 工具二：创建订单
    private createOrderTool = tool(
        async ({ productName, quantity, customerName }: {
            productName: string; quantity: number; customerName: string
        }) => {
            const orderId = `ORD-${Date.now()}`
            return JSON.stringify({
                success: true,
                orderId,
                productName,
                quantity,
                customerName,
                createdAt: new Date().toLocaleString('zh-CN'),
            })
        },
        {
            name: 'create_order',
            description: '为客户创建购买订单',
            schema: z.object({
                productName: z.string().describe('商品名称'),
                quantity: z.number().describe('购买数量'),
                customerName: z.string().describe('客户姓名'),
            }),
        },
    )

    // 工具三：查询订单状态
    private checkOrderTool = tool(
        async ({ orderId }: { orderId: string }) => {
            const statuses = ['待支付', '已支付', '备货中', '已发货', '已完成']
            return JSON.stringify({
                orderId,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                updatedAt: new Date().toLocaleString('zh-CN'),
            })
        },
        {
            name: 'check_order',
            description: '查询订单状态',
            schema: z.object({
                orderId: z.string().describe('订单号，格式 ORD-XXXXX'),
            }),
        },
    )

    // // ── Function Calling 核心逻辑 ─────────────────────────
    async runFcCalling(userMessage: string) {
        const tools = [this.checkInventoryTool, this.createOrderTool, this.checkOrderTool]
        const toolMap: Record<string, any> = {
            check_inventory: this.checkInventoryTool,
            create_order: this.createOrderTool,
            check_order: this.checkOrderTool,
        }

        const llmWithTools = this.llm.bindTools(tools)
        const messages: any[] = [new HumanMessage(userMessage)]
        const toolCallLog: any[] = []

        for (let round = 0; round < 3; round++) {
            const response = await llmWithTools.invoke(messages)
            messages.push(response)

            if (!response.tool_calls?.length) break

            for (const toolCall of response.tool_calls) {
                const toolFn = toolMap[toolCall.name]
                if (!toolFn) continue

                const result = await toolFn.invoke(toolCall.args)
                toolCallLog.push({
                    tool: toolCall.name,
                    args: toolCall.args,
                    result: JSON.parse(result),
                })

                messages.push(new ToolMessage({ content: result, tool_call_id: toolCall.id || '' }))
            }
        }

        const lastMsg = [...messages].reverse().find(m => m.constructor.name === 'AIMessage')

        return {
            userMessage,
            toolCalls: toolCallLog, // 调用了哪些工具、参数和结果
            finalAnswer: lastMsg?.content || '处理完成',
        }


    }
}

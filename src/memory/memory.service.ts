import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import type { Response } from 'express'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { config } from '../config'
@Injectable()
export class MemoryService {
    // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    });

    private sessions = new Map<string, InMemoryChatMessageHistory>();
    private systemMessage = new SystemMessage(
        '你是一个智能助手，能记住对话历史， 根据上下文准确的回答'
    )
    private getOrCreate(sessionId: string): InMemoryChatMessageHistory {
        if (!this.sessions.has(sessionId)) {
            // 新会话， 初始化加入 SystemMessage
            this.sessions.set(sessionId, new InMemoryChatMessageHistory())
        }
        return this.sessions.get(sessionId)!

    }

    async chat(sessionId: string, message: string) {
        const history = this.getOrCreate(sessionId);
        // 把用户新的消息加入历史
        await history.addMessage(new HumanMessage(message));
        // 把完整的历史发给模型（包含 system, 历史对话， 本次信息）
        const messages = await history.getMessages();
        const response = await this.llm.invoke([this.systemMessage, ...messages]);

        // 把模型回复也加入历史， 下次对话继续携带
        await history.addMessage(response)
        const savedMessages = await history.getMessages();
        return {
            sessionId,
            message,
            reply: response.content,
            turns: Math.floor(savedMessages.length / 2) //对话轮数
        }


    }
    // ── 查看会话历史 ──────────────────────────────────────
    async getHistory(sessionId: string) {
        const history = this.sessions.get(sessionId)
        if (!history) return { sessionId, exists: false, messages: [] }

        const historyMessages = await history.getMessages()
        const messages = historyMessages
            .filter(m => !(m instanceof SystemMessage))
            .map((m, i) => ({
                index: i + 1,
                role: m instanceof HumanMessage ? 'user' : 'assistant',
                content: m.content,
            }))

        return {
            sessionId,
            exists: true,
            turns: Math.floor(messages.length / 2),
            messages,
        }
    }

    // ── 清空会话 ──────────────────────────────────────────
    async clearSession(sessionId: string) {
        if (!this.sessions.has(sessionId)) {
            return { sessionId, cleared: false, message: '会话不存在' }
        }
        await this.sessions.get(sessionId)!.clear()
        return { sessionId, cleared: true, message: '会话已清空' }
    }

    // ── 所有会话列表 ──────────────────────────────────────
    async listSessions() {
        const sessions = await Promise.all(
            Array.from(this.sessions.entries()).map(async ([id, h]) => {
                const messages = await h.getMessages()
                return {
                    sessionId: id,
                    turns: Math.floor(messages.length / 2),
                }
            })
        )
        return { total: sessions.length, sessions }
    }

    // ── 多轮对话（SSE 流式版本）──────────────────────────
    async chatStream(sessionId: string, message: string, res: Response) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('Access-Control-Allow-Origin', '*')

        const history = this.getOrCreate(sessionId)
        await history.addMessage(new HumanMessage(message))

        let fullReply = ''

        const messages = await history.getMessages()
        const stream = await this.llm.stream([this.systemMessage, ...messages])
        for await (const chunk of stream) {
            if (chunk.content) {
                const text = String(chunk.content)
                fullReply += text
                res.write(`data: ${JSON.stringify({ text, sessionId })}\n\n`)
            }
        }

        // 流结束后把完整回复存入历史
        await history.addMessage(new AIMessage(fullReply))
        const savedMessages = await history.getMessages()
        res.write(`data: ${JSON.stringify({ text: '[DONE]', turns: Math.floor(savedMessages.length / 2) })}\n\n`)
        res.end()
    }



}

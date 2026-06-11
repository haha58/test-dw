import { ChatOllama } from '@langchain/ollama';
import { Injectable, OnModuleInit } from '@nestjs/common'
import { config } from '../../../config';
import { HumanMessage, SystemMessage } from 'langchain';
import { END, MemorySaver, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';

@Injectable()
export class LanggraphService implements OnModuleInit {
    private llm: any;
    private simpleGraph: any;
    private memoryGraph: any;

    onModuleInit() {
        this.llm = new ChatOllama({
            model: config.ollama.chatModel, // Ollama 模型名称
            temperature: config.ollama.temperature, // 生成文本的随机程度
            baseUrl: config.ollama.host, // Ollama 服务器地址
            think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
            numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
        });

        this.simpleGraph = this.createSimpleGraph().simpleGraph
        this.memoryGraph = this.createSimpleGraph().memoryGraph
    }

    createSimpleGraph() {
        const callModel = async (state: typeof MessagesAnnotation.State) => {
            // state.messages 包含本次传入的所有消息
            const response = await this.llm.invoke(state.messages)
            // 只返回新增消息，LangGraph 自动追加（不覆盖历史）
            return { messages: [response] }
        }

        const simpleGraph = new StateGraph(MessagesAnnotation)
            .addNode('callModel', callModel)
            .addEdge(START, 'callModel')
            .addEdge('callModel', END)
            .compile()

        const memoryGraph = new StateGraph(MessagesAnnotation)
            .addNode('callModel', callModel)
            .addEdge(START, 'callModel')
            .addEdge('callModel', END)
            .compile({ checkpointer: new MemorySaver() })

        return { simpleGraph, memoryGraph }
    }

    async simpleChat(message: string) {
        const result = await this.simpleGraph.invoke({
            messages: [
                new SystemMessage('你是专业的 AI 助手，回答简洁清晰。'),
                new HumanMessage(message),
            ],
        })
        return result.messages.at(-1).content as string
    }

    // 上下文聊天
    async memoryChat(threadId: string, message: string): Promise<string> {
        const result = await this.memoryGraph.invoke(
            { messages: [new HumanMessage(message)] },
            { configurable: { thread_id: threadId } },   // thread_id 区分不同会话
        )
        return result.messages.at(-1).content as string
    }

    async getHistory(threadId: string) {
        // getState 获取某个 thread 当前保存的完整状态
        const state = await this.memoryGraph.getState({
            configurable: { thread_id: threadId },
        })
        return (state.values.messages ?? []).map((m: any, i: number) => ({
            index: i,
            role: m._getType?.() === 'human' ? 'user' : 'assistant',
            content: m.content,
        }))
    }
}

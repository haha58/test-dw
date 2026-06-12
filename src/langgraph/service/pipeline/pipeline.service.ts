// src/langgraph/pipeline.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common'
import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { ChatOllama } from '@langchain/ollama'
import { config } from 'src/config'

const PipelineState = Annotation.Root({
    topic: Annotation<string>(),
    research: Annotation<string>(),
    outline: Annotation<string>(),
    draft: Annotation<string>(),
    finalArticle: Annotation<string>(),
    progress: Annotation<string[]>({
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
    }),
})

@Injectable()
export class PipelineService implements OnModuleInit {
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

        const researchAgent = async (state: typeof PipelineState.State) => {
            const res = await this.llm.invoke([
                new HumanMessage(`你是研究员，为主题"${state.topic}"收集素材：
1. 背景介绍（2-3 句）
2. 核心要点（3-5 个）
3. 典型案例（1-2 个）
每条不超过 50 字。`),
            ])
            return { research: res.content as string, progress: ['✅ 素材收集完成'] }
        }

        const outlineAgent = async (state: typeof PipelineState.State) => {
            const res = await this.llm.invoke([
                new HumanMessage(`你是内容策划，根据素材为"${state.topic}"生成大纲：
素材：${state.research}
格式：# 章节 / - 子项，共 3-5 章`),
            ])
            return { outline: res.content as string, progress: ['✅ 大纲生成完成'] }
        }

        const writingAgent = async (state: typeof PipelineState.State) => {
            const res = await this.llm.invoke([
                new HumanMessage(`你是撰稿人，根据大纲写文章（400-600 字）：
主题：${state.topic}
大纲：${state.outline}
参考素材：${state.research}`),
            ])
            return { draft: res.content as string, progress: ['✅ 初稿写作完成'] }
        }

        const reviewAgent = async (state: typeof PipelineState.State) => {
            const res = await this.llm.invoke([
                new HumanMessage(`你是编辑，优化以下文章，直接输出优化后全文：\n${state.draft}`),
            ])
            return { finalArticle: res.content as string, progress: ['✅ 审校优化完成'] }
        }

        this.graph = new StateGraph(PipelineState)
            .addNode('researchNode', researchAgent)
            .addNode('outlineNode', outlineAgent)
            .addNode('writingNode', writingAgent)
            .addNode('reviewNode', reviewAgent)
            .addEdge(START, 'researchNode')
            .addEdge('researchNode', 'outlineNode')
            .addEdge('outlineNode', 'writingNode')
            .addEdge('writingNode', 'reviewNode')
            .addEdge('reviewNode', END)
            .compile()
    }

    async createContent(topic: string) {
        const t0 = Date.now()
        const result = await this.graph.invoke({ topic })
        return {
            topic,
            progress: result.progress,
            finalArticle: result.finalArticle,
            totalTime: `${Date.now() - t0}ms`,
        }
    }
}

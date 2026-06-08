import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { BadRequestException, Injectable } from '@nestjs/common';
import { IDocument } from './dto/load.dto';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../config'
import { createAgent } from 'langchain'

@Injectable()
export class RagTestService {
    // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    });
 
    // 向量化模型： 把文本转成数字向量 （用于比较相似度）
    private embeddings = new OllamaEmbeddings({
        model: config.ollama.embedModel,
        baseUrl: config.ollama.host
    })

    // 内存向量库（null 表示未初始化）
    // postgresql pgvector
    private vectorStore: MemoryVectorStore | null = null;
    private docCount = 0;


    // 加载文档到向量库 
    async load(documents: IDocument[]) {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,     // 每块最大字符数
            chunkOverlap: 50,   // 相邻块重叠 50 个字符
            // 分隔符优先级：从上到下依次尝试
            separators: [
                '\n\n',  // 第1优先：段落分隔（语义最完整）
                '\n',    // 第2优先：换行
                '。',    // 第3优先：中文句号
                '！', '？',
                ' ',     // 第4优先：空格（英文单词边界）
                '',      // 最后手段：强制按字符数截断
            ],
        })

        const allDocs: any[] = [];

        for (const doc of documents) {
            const chunks = await splitter.createDocuments(
                [doc.content],
                [{ source: doc.source || doc.id, docId: doc.id }]
            )
            // 插入数据库
            allDocs.push(...chunks);
        }
        // fromDocuments 批量向量化所有文档块， 存入内存向量库
        this.vectorStore = await MemoryVectorStore.fromDocuments(
            allDocs,
            this.embeddings,
        )
        this.docCount = documents.length;
        return {
            success: true,
            originalDocs: documents.length,
            totalChunk: allDocs.length,
            message: `加载${documents.length} 篇文档，共${allDocs.length} 个块`
        }
    }

    async query(question: string, topK = 3) {
        if (!this.vectorStore) {
            return { error: '请先调用/rag/load 加载文档，文档向量化存储' }
        }

        // 1. 先检索最相关的文档块。
        if (typeof question !== 'string' || !question.trim()) {
            throw new BadRequestException('question 必须是非空字符串')
        }
        const docs = await this.vectorStore.similaritySearch(question, topK)
        if (!docs.length) {
            return { question, answer: '知识库中没有找到相关的内容', source: [] }

        }
        // 2. 再把检索结果拼成一段可读上下文。
        // 这里不直接把 Document[] 原样塞给 Agent，是为了让 system 更清楚。
        const context = docs
            .map((doc, index) => {
                return `资料 ${index + 1}：${doc.pageContent}`
            })
            .join('\n\n')
        const agent = createAgent({ model: this.llm })
        const result = await agent.invoke({
            messages: [
                {
                    // system 负责告诉 Agent：哪些内容是参考资料，以及回答时要遵守什么边界。
                    role: 'system',
                    content: `你是公司的 AI 助手。
                        请优先根据下面的参考资料回答问题。
                        如果资料里没有明确答案，就直接说不知道，不要编造。

                        参考资料：
                        ${context}`,
                },
                {
                    // user 仍然是用户原始问题，不需要改写。
                    role: 'user',
                    content: question,
                },
            ],
        })

        // 3. 最后一条消息就是本轮回答。
        return result.messages.at(-1)?.text ?? ''
    }
}

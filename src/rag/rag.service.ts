import { Injectable } from '@nestjs/common';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate } from '@langchain/core/prompts';
import { config } from '../config'
@Injectable()
export class RagService {
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
    async loadDocuments(documents: { id: string; content: string; source?: string }[]) {
        // 文本拆分器
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
        const allDocs:Document[] = [];

        for (const doc of documents) {
            const chunks = await splitter.createDocuments(
                [doc.content],
                [{source:doc.source || doc.id, docId: doc.id}]
            )
            // 插入数据库
            allDocs.push(...chunks);

        }

        // fromDocuments 批量向量化所有文档块， 存入内存向量库
        // 内部调用 MemoryVectorStore 转成向量
        this.vectorStore = await MemoryVectorStore.fromDocuments(
            allDocs,
            this.embeddings
        )
        this.docCount = documents.length;

        return {
            success: true,
            originalDocs: documents.length,
            totalChunk: allDocs.length,
            message: `加载${documents.length} 篇文档，共${allDocs.length} 个块`
        }

    }
    // 纯 向量检索  （不通过大模型  直接查看检索的结果！）
    async search(query:string, topK=3) {
        if(!this.vectorStore){
            return {error: '请先调用/rag/load 加载文档，文档向量化存储'}
        }
        // similaritySearchWithScore
        // 1. 把query 向量化 （调用 embedding.embedQuery）
        // 2. 和向量库里面的所有文档 向量计算 余弦相似度
        // 3. 按照相似度排序，返回前 topK个 数据
        const results = await this.vectorStore.similaritySearchWithScore(query, topK);
        return {
            query,
            results: results.map(([doc, sorce])=> ({
                content: doc.pageContent,
                source: doc.metadata.source,
                sorce: parseFloat(sorce.toFixed(4)) // 越高 越相关（0-1）
            }))
        }
    }
    // 完整的rag问答！
    async query(question:string, topK=3) {
        if(!this.vectorStore){
            return {error: '请先调用/rag/load 加载文档，文档向量化存储'}
        }
        // setp1: 检索相关的文档块
        const retrieved = await this.vectorStore.similaritySearchWithScore(question, topK);
        console.log('retrieved.length-----', retrieved.length)
        if(!retrieved.length) {
            return {question, answer: '知识库中没有找到相关的内容', source: []}

        }
        // setp2: 把检索结果 拼成 content 字符串@
        // [1]第一块内容\n\n[2] 第二块内容....
        // 编号 方便模型在回答⑩引用： “根据【1】 。。。 根据【2】”
        const context = retrieved.map(([doc], i)=> `[${i + 1}] ${doc.pageContent}`).join('\n\n')

        // setp3: RAG Prompt : 严格限制模型只能 用参考资料回答 

        const prompt = ChatPromptTemplate.fromMessages([
            ['system', `你是知识库回答助手， 严格基于参考资料回答。
                规则：
                1. 只根据参考资料内容回答，不能使用资料外的知识
                2. 资料中没有相关信息，回答"知识库中暂无相关内容"
                3. 回答简洁准确，使用中文
                参考资料：
                {context}
                `],
                ['human', '{question}']
        ])

        // setp4: 调用模型生成 回答
        const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
        const answer = await chain.invoke({context, question})

        return {
            question,
            answer,
            sources: retrieved.map(([doc, score])=>({
                content: doc.pageContent,
                source: doc.metadata.source,
                sorce: parseFloat(score.toFixed(4)) // 越高 越相关（0-1）
            }))
        }
    }

    getStatus() {
        return {
            loaded: !!this.vectorStore,
            docCount: this.docCount,
            message: this.vectorStore ? `已加载${this.docCount} 篇文档`: '知识库是空的， 请先加载文档'
        }
    }

    clearKnowledage() {
        this.vectorStore = null;
        this.docCount = 0;
        return {success: true, message: '知识库已经清空'}
    }
}

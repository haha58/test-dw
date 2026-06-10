import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { BadRequestException, Injectable } from '@nestjs/common';

import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../config'
import { createAgent } from 'langchain'
import { Pool } from 'pg';
import { DistanceStrategy, PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class RagDbTestService {
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

    private pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10, // 连接池最大连接数，根据实际需求调整
        idleTimeoutMillis: 30000, // 连接空闲超时时间，单位毫秒
        connectionTimeoutMillis: 2000, // 连接超时时间，单位毫秒
    })

    private pgVectorConfig = {
        pool: this.pgPool, // pg 连接池
        // 集合名称：类似命名空间： 可以隔离不同的业务的向量数据
        // 例如：rag_collection 存储RAG相关的文档向量， faq_collection 存储FAQ相关的文档向量
        collectionName: 'rag-knowledge-base', // 存储向量的集合名称（表名前缀）
        collectionTableName: 'langchain_pg_collection', // 存储文档的表名        
        // 向量表名
        tableName: 'langchain_pg_embedding', // 存储文档的表名
        columns: {
            idColumnName: 'id', // 文档ID列
            vectorColumnName: 'embedding', // 向量列
            contentColumnName: 'content', // 文档内容列
            metadataColumnName: 'metadata', // 元数据列，存储文档的额外信息（例如来源、文档ID等）
        },
        distanceStrategy: 'cosine' as DistanceStrategy,
        skipInitializationCheck: true, //跳过每次查询都重复初始化表结构
    }


    // 加载文档到向量库 
    async load(documents: any[]) {
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
        // fromDocuments 批量向量化所有文档块， 存入向量库
        await PGVectorStore.fromDocuments(
            allDocs,
            this.embeddings,
            this.pgVectorConfig
        )

        return {
            success: true,
            originalDocs: documents.length,
            totalChunk: allDocs.length,
            message: `加载${documents.length} 篇文档，共${allDocs.length} 个块`
        }
    }

    async search(query: string, topK = 3) {
        // 每次调用 新建连接池， end  把池销毁了 
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorConfig
        );
        const results = await vectorStore.similaritySearchWithScore(query, topK);
        await vectorStore.end(); // 使用完毕后关闭连接
        return {
            query,
            results: results.map(([doc, score]) => ({
                content: doc.pageContent,
                source: doc.metadata.source,
                score: parseFloat(score.toFixed(4)), // 余弦相举例
                similarity: (1 - parseFloat(score.toFixed(4))).toFixed(4), // 余弦相似度 = 1 - 余弦距离
                rawDistance: parseFloat(score.toFixed(4)) // 原始距离值，越小越相关
            })),
        }

    }

    async query(question: string, topK = 3) {
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorConfig
        );

        if (!vectorStore) {
            return { error: '请先调用/rag/load 加载文档，文档向量化存储' }
        }

        // 1. 先检索最相关的文档块。
        if (typeof question !== 'string' || !question.trim()) {
            throw new BadRequestException('question 必须是非空字符串');
        }
        //余弦距离越小越接近
        const queryWithPrefix = `Represent this sentence for searching relevant passages: ${question}`
        const retrieved = await vectorStore.similaritySearchWithScore(queryWithPrefix, topK)
        await vectorStore.end()
        const filtered = retrieved.filter(([, score]) => score <= 0.5);
        if (!filtered.length) {
            return { question, answer: '知识库中没有找到相关的内容', source: [] }
        }

        const context = filtered.map(([doc], i) => `[${i + 1}] ${doc.pageContent}`).join('\n\n')
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
        const answer = await chain.invoke({ context, question })

        return {
            question,
            answer,
            sources: retrieved.map(([doc, score]) => ({
                content: doc.pageContent,
                source: doc.metadata.source,
                similarity: (1 - parseFloat(score.toFixed(4))).toFixed(4), // 余弦相似度 = 1 - 余弦距离
                sorce: parseFloat(score.toFixed(4)) // 距离值，越小越相关（0-1）
            }))
        }
    }

    async getStatus() {
        try {
            const vectorStore = await PGVectorStore.initialize(
                this.embeddings,
                this.pgVectorConfig
            );

            if (!vectorStore) {
                return { error: '请先调用/rag/load 加载文档，文档向量化存储' }
            }

            const results = await this.pgPool.query(`SELECT COUNT(*) as docCount FROM ${this.pgVectorConfig.tableName}
                WHERE collection_id =  (SELECT uuid from ${this.pgVectorConfig.collectionTableName} WHERE name = $1)`, [this.pgVectorConfig.collectionName])
            const docCountNum = parseInt(results.rows[0].doccount, 10);
            return {
                loaded: !!vectorStore,
                message: vectorStore ? `已加载${docCountNum} 篇文档` : '知识库是空的， 请先加载文档'
            }
        } catch (error) {
            console.error('获取状态失败:', error);
            return {
                mode: 'pgvector',
                loaded: false,
                vectorCount: 0,
                message: '获取状态失败，可能是数据库连接问题// 请先调用/rag/load 加载文档，文档向量化存储'
            }
        }
    }

    async clearKnowledage() {
        // 删除当前collection 下的所有向量数据和文档数据
        await this.pgPool.query(`DELETE FROM ${this.pgVectorConfig.tableName}
            WHERE collection_id =  (SELECT uuid from ${this.pgVectorConfig.collectionTableName} WHERE name = $1)`, [this.pgVectorConfig.collectionName])
        await this.pgPool.query(`DELETE FROM ${this.pgVectorConfig.collectionTableName}
            WHERE name = $1`, [this.pgVectorConfig.collectionName])
        return { success: true, message: '知识库已经清空' }
    }
}

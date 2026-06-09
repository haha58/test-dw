import { Injectable } from '@nestjs/common';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
// 内存存储
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
// 真实的数据库存储pgvector
import { PGVectorStore, DistanceStrategy } from '@langchain/community/vectorstores/pgvector';
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate } from '@langchain/core/prompts';
import { Pool } from 'pg';
import { config } from '../config'
@Injectable()
export class RagDbService {
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

    // postgresql pgvector 连接池
    private pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10, // 连接池最大连接数，根据实际需求调整
        idleTimeoutMillis: 30000, // 连接空闲超时时间，单位毫秒
        connectionTimeoutMillis: 2000, // 连接超时时间，单位毫秒
    })

    // 内存向量库（null 表示未初始化）
    // postgresql pgvector
    // private vectorStore: MemoryVectorStore | null = null;
    private docCount = 0;

    // PGVectorStore的配置 
    private pgVectorStoreConfig = {
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
        // 向量距离计算策略：pgvector 支持两种距离计算方式：欧氏距离（L2）和余弦相似度（COSINE）
        distanceStrategy: 'cosine' as DistanceStrategy // 使用余弦相似度计算向量距离
    }

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
        const allDocs: Document[] = [];

        for (const doc of documents) {
            const chunks = await splitter.createDocuments(
                [doc.content],
                [{ source: doc.source || doc.id, docId: doc.id }]
            )
            // 插入数据库
            allDocs.push(...chunks);

        }

        // fromDocuments 批量向量化所有文档块， 存入内存向量库
        // 内部调用 MemoryVectorStore 转成向量

        // pgvectorestore 存入 pgvector 数据库
        // pgvectorestore.fromDocuments 内部会调用 this.embeddings.embedDocuments 把文本转成向量
        // 1.首次调用 自动场景创建表结构（langchain_pg_collection 存储文档， langchain_pg_embedding 存储向量）
        // 2.后续调用 自动把向量数据插入 langchain_pg_embedding 表， 文档数据插入 langchain_pg_collection 表
        const vectorStore = await PGVectorStore.fromDocuments(
            allDocs,
            this.embeddings,
            this.pgVectorStoreConfig
        )
        this.docCount += documents.length;

        // this.vectorStore = await MemoryVectorStore.fromDocuments(
        //     allDocs,
        //     this.embeddings
        // )
        // this.docCount = documents.length;

        return {
            success: true,
            originalDocs: documents.length,
            totalChunk: allDocs.length,
            message: `加载${documents.length} 篇文档，共${allDocs.length} 个块`
        }

    }

    // 纯 向量检索  （不通过大模型  直接查看检索的结果！）
    async search(query: string, topK = 3) {
        // 每次调用 新建连接池， end  把池销毁了 
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorStoreConfig
        );
        const results = await vectorStore.similaritySearchWithScore(query, topK);
        // await vectorStore.end(); // 使用完毕后关闭连接
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
    // // 完整的rag问答！
    async query(question:string, topK=3) {
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorStoreConfig
        );
        // setp1: 检索相关的文档块
        const retrieved = await vectorStore.similaritySearchWithScore(question, topK);
        console.log('retrieved.length-----', retrieved.length)
        // setp2: 把检索结果 拼成 content 字符串@
        // [1]第一块内容\n\n[2] 第二块内容....
        // 编号 方便模型在回答⑩引用： “根据【1】 。。。 根据【2】”
        // const context = retrieved.map(([doc], i)=> `[${i + 1}] ${doc.pageContent}`).join('\n\n')

        // score 是举例 越小越相关， 过滤掉 score > 0.5 的内容， 认为它们和问题不相关
        // score > 0.5 的才算相关的内容， 其他的过滤掉     
        const filtered = retrieved.filter(([, score])=> score <= 0.5);
        if(!filtered.length) {
            return {question, answer: '知识库中没有找到相关的内容', source: []}

        }

        const context = filtered.map(([doc], i)=> `[${i + 1}] ${doc.pageContent}`).join('\n\n')
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
                similarity: (1 - parseFloat(score.toFixed(4))).toFixed(4), // 余弦相似度 = 1 - 余弦距离
                sorce: parseFloat(score.toFixed(4)) // 距离值，越小越相关（0-1）
            }))
        }
    }

    async getStatus() {
        try {
            // 查询 pgvector 数据库中已经存储的向量数量
            const results = await this.pgPool.query(`SELECT COUNT(*) FROM ${this.pgVectorStoreConfig.tableName}
                WHERE collection_id =  (SELECT uuid from langchain_pg_collection WHERE name = $1)`, [this.pgVectorStoreConfig.collectionName]);
            const vectorCount = parseInt(results.rows[0].count, 10);

            return {
                mode: 'pgvector',
                loaded: vectorCount > 0,
                // docCount: this.docCount,
                vectorCount,
                collecton: this.pgVectorStoreConfig.collectionName,
                message: vectorCount > 0 ? 'PostgreSQL向量数据库已加载 有 ' + vectorCount + ' 个向量块' : '状态获取成功，但知识库为空'
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
        this.pgPool.query(`DELETE FROM ${this.pgVectorStoreConfig.tableName}
            WHERE collection_id =  (SELECT uuid from langchain_pg_collection WHERE name = $1)`, [this.pgVectorStoreConfig.collectionName])
        this.pgPool.query(`DELETE FROM ${this.pgVectorStoreConfig.collectionTableName}
            WHERE name = $1`, [this.pgVectorStoreConfig.collectionName])  
            this.docCount = 0;  
        return {success: true, message: '知识库已经清空'}
    }


    async onModuleDestroy() {
        // 关闭 pg 连接池
        await this.pgPool.end();
        console.log('数据库连接已关闭');    
    }
}


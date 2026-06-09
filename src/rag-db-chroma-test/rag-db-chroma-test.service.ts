import { Document } from '@langchain/core/documents'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Injectable } from '@nestjs/common'
import { ChromaClient } from 'chromadb'
import { config } from '../config'

@Injectable()
export class RagDbChromaTestService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false,
    numPredict: 512,
  })

  private embeddings = new OllamaEmbeddings({
    model: config.ollama.embedModel,
    baseUrl: config.ollama.host,
  })

  private chromaConfig = {
    host: 'localhost',
    port: 8000,
    ssl: false,
    collectionName: 'rag-knowledge-base',
  }

  private docCount = 0

  private get chromaUrl() {
    const protocol = this.chromaConfig.ssl ? 'https' : 'http'
    return `${protocol}://${this.chromaConfig.host}:${this.chromaConfig.port}`
  }

  private get chromaClientParams() {
    return {
      host: this.chromaConfig.host,
      port: this.chromaConfig.port,
      ssl: this.chromaConfig.ssl,
    }
  }

  async loadDocuments(documents: { id: string; content: string; source?: string }[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '。', '，', '；', ' ', ''],
    })

    const allDocs: Document[] = []
    for (const doc of documents) {
      const chunks = await splitter.createDocuments(
        [doc.content],
        [{ source: doc.source || doc.id, docId: doc.id }],
      )
      allDocs.push(...chunks)
    }

    await Chroma.fromDocuments(allDocs, this.embeddings, {
      collectionName: this.chromaConfig.collectionName,
      clientParams: this.chromaClientParams,
    })

    this.docCount += documents.length

    return {
      success: true,
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `已将 ${documents.length} 篇文档（${allDocs.length} 个块）存入 Chroma`,
    }
  }

  private async getVectorStore(): Promise<Chroma> {
    return new Chroma(this.embeddings, {
      collectionName: this.chromaConfig.collectionName,
      clientParams: this.chromaClientParams,
    })
  }

  async search(query: string, topK = 3) {
    const vectorStore = await this.getVectorStore()
    const results = await vectorStore.similaritySearchWithScore(query, topK)

    return {
      query,
      results: results.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        score: parseFloat(score.toFixed(4)),
      })),
    }
  }

  async query(question: string, topK = 3) {
    const vectorStore = await this.getVectorStore()
    const retrieved = await vectorStore.similaritySearchWithScore(question, topK)

    if (!retrieved.length) {
      return {
        question,
        answer: '知识库中没有找到相关内容',
        sources: [],
      }
    }

    const context = retrieved.map(([doc], i) => `[${i + 1}] ${doc.pageContent}`).join('\n\n')

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是知识库问答助手，严格基于参考资料回答。
规则：
1. 只能根据参考资料内容回答，不能使用资料外的知识。
2. 资料中没有相关信息时，回答“知识库中暂无相关内容”。
3. 回答简洁准确，使用中文。

参考资料：
{context}`,
      ],
      ['human', '{question}'],
    ])

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const answer = await chain.invoke({ context, question })

    return {
      question,
      answer,
      sources: retrieved.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        score: parseFloat(score.toFixed(4)),
      })),
    }
  }

  async getStatus() {
    try {
      const vectorStore = await this.getVectorStore()
      const collection = await vectorStore.ensureCollection()
      const count = await collection.count()

      return {
        mode: 'Chroma',
        loaded: true,
        collection: this.chromaConfig.collectionName,
        chromaUrl: this.chromaUrl,
        count,
        message: `Chroma 向量库连接正常，Collection：${this.chromaConfig.collectionName}`,
      }
    } catch {
      return {
        mode: 'Chroma',
        loaded: false,
        message: `无法连接 Chroma 服务（${this.chromaUrl}），请确认服务已启动`,
      }
    }
  }

  async clearKnowledge() {
    try {
      const client = new ChromaClient(this.chromaClientParams)
      await client.deleteCollection({ name: this.chromaConfig.collectionName })
      this.docCount = 0

      return {
        success: true,
        message: `已删除 Chroma Collection：${this.chromaConfig.collectionName}`,
      }
    } catch (e) {
      return {
        success: false,
        message: `清空失败：${e}`,
      }
    }
  }
}

import { Injectable } from '@nestjs/common';
import {ChatOllama} from '@langchain/ollama';
import type { Response } from 'express'
import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import{ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate} from '@langchain/core/prompts';
import{ RunnableSequence, RunnablePassthrough} from '@langchain/core/runnables';
import {config} from '../config'
@Injectable()
export class ChainsService {
      // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    }); 

    // 多步执行， 每一步的输出都可以作为下一步的输入，适合需要分步骤处理的复杂任务
    // 文章润色的例子，第一步先对文章进行分析，提取出文章的主题、风格、存在的问题等关键信息，
    // 第二步根据第一步的分析结果对文章进行润色，改进文章的表达、结构、用词等方面，使文章更加流畅、清晰、有吸引力
    async polish(article: string) {
        const analysisPrompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个文章分析助手，只输出问题列表，不要其他的内容'],
            ['human', '分析这篇文章存在的问题: {article}']
        ]);
        const polishPrompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个文章润色助手，根据输出的问题列表对文章进行润色，改进文章的表达、结构、用词等方面，使文章更加流畅、清晰、有吸引力。'],
            ['human', '根据以下分析结果润色这篇文章: {analysis}，文章内容是: {article}']
        ]);

        // 第一条chain: article字符串 ->分析---  analysis字符串 
        const analysisChain = analysisPrompt.pipe(this.llm).pipe(new StringOutputParser());
        // 

        // 第1步骤chain:保留article原文， +  调用analysisChain 得到 analysis字符串 
        // 第2步骤chain:     analysis字符串 + article字符串 ->润色后的文章字符串 polishChain
        // RunnableSequence 可以把多个 chain 串联起来，前一个 chain 的输出会作为后一个 chain 的输入，这样就实现了多步骤的处理流程
        // RunnableSequence 的输入是一个对象，这个对象可以包含多个属性，每个属性都可以通过 RunnablePassthrough 来保留原始输入，或者通过其他 chain 来进行处理
        // RunnablePassthrough 是一个特殊的 chain，它会直接把输入传递给下一个 chain，而不进行任何处理，这样就可以在多步骤的流程中保留原始输入，供后续的 chain 使用
        const fullChain= RunnableSequence.from([
            {article: new RunnablePassthrough(), // 保留原文
                analysis: analysisChain,
             },  // 调用分析chain得到分析结果
            polishPrompt.pipe(this.llm).pipe(new StringOutputParser()) // 调用润色chain得到润色结果
        ]);
        console.log('Running full chain with article:', article);
        const result = await fullChain.invoke({article});
        return{ original: article, polish: result};
    }
    // 顺序链 播客生成的例子 （关键词--- 大纲---文章---seo标题）
    async generateBlog(keywords: string, style: string) {
        // 三条chain: 顺序执行 上一步输出传给下一步  关键词 -> 大纲 -> 文章 -> SEO标题
        const outlinePrompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个博客大纲生成助手，根据用户提供的关键词和风格要求生成一篇博客文章的大纲。'],
            ['human', '请根据以下关键词和风格要求生成一篇博客文章的大纲。关键词: {keywords}，风格要求: {style}']
        ]).pipe(this.llm).pipe(new StringOutputParser());

        const articlePrompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个博客文章生成助手，根据用户提供的博客大纲和风格要求生成一篇博客文章。'],
            ['human', '请根据以下博客大纲和风格要求生成一篇博客文章。博客大纲: {outline}']
        ]).pipe(this.llm).pipe(new StringOutputParser());

        const seoTitlePrompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个SEO标题生成助手，根据用户提供的博客文章内容和风格要求生成3个SEO标题。'],
            ['human', '请根据以下博客文章内容和风格要求生成3个SEO标题。博客文章内容: {article}']
        ]).pipe(this.llm).pipe(new StringOutputParser());
        
        const outLine = await outlinePrompt.invoke({keywords, style});
        const article = await articlePrompt.invoke({outline: outLine});
        const seoTitle = await seoTitlePrompt.invoke({article});
        return {keywords, style, outline: outLine, article, seoTitle }
    }
    // 条件的分支链，智能路由的例子，用户输入一个问题，模型会根据问题的内容和类型来判断应该调用哪个功能模块来处理这个问题，比如翻译、总结、分类等
    async smartRouter(question: string) {
        // 智能路由的例子，用户输入一个问题，模型会根据问题的内容和类型来判断应该调用哪个功能模块来处理这个问题，比如翻译、总结、分类等
       // 第一步分类
        const routerPrompt = ChatPromptTemplate.fromMessages([
            ['system', `分析用户的问题，只输出分类标签：
                技术问题-TECH
                退款问题-REFUND
                订单问题-ORDER
                投诉建议-COMPLAINT
                其他-OTHER`],
            ['human', '{question}']
        ]).pipe(this.llm).pipe(new StringOutputParser());
        const category = await routerPrompt.invoke({question});

        // 第二步根据分类结果调用不同的处理模块，
        const systemMap: Record<string, string> = {
            TECH: '你是一个技术支持助手，帮助用户解决技术问题。',
            REFUND: '你是一个客服助手，帮助用户处理退款问题。',
            ORDER: '你是一个订单助手，帮助用户查询和修改订单信息。',
            COMPLAINT: '你是一个投诉处理助手，帮助用户提交和跟进投诉建议。',
            OTHER: '你是一个通用助手，帮助用户解答各种问题。'
        };
        // const label = await routerPrompt.invoke({question});
        const systemMessage = systemMap[category] || systemMap['OTHER'];
        // 第三步把系统角色信息和用户问题一起传给模型，让模型根据不同的角色信息来生成不同的回答内容
        const answerPrompt = ChatPromptTemplate.fromMessages([
            ['system', systemMessage],
            ['human', '{question}']
        ]).pipe(this.llm).pipe(new StringOutputParser());
        const answer = await answerPrompt.invoke({question});
        return {question, category, answer};
    }

}

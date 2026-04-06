import { Injectable } from '@nestjs/common';
import {ChatOllama} from '@langchain/ollama';
import type { Response } from 'express'
import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import{ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate} from '@langchain/core/prompts';
import {config} from '../config'
@Injectable()
export class PromptsService {
     // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    }); 

    // 多消息对话模板，适合需要上下文的对话场景，模型会根据之前的消息内容进行回答
    async translate(text: string, targetLanguage: string) {
        // fromMessages 接受一个消息数组，每个消息由一个角色（system、user、assistant）和内容组成，模板中可以使用占位符 {text} 和 {targetLanguage} 来动态替换用户输入的文本和目标语言
        const prompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个翻译助手，,只输出翻译结果 帮助用户将文本翻译成指定的语言。'],
            ['user', '请把以下的内容翻译成 {targetLanguage}: {text}']
        ]);
        // aimessage   response.content
        // pipe 把  prompt llm parser 串联一起
        // prompt.invoke({text, targetLanguage}) 会先把用户输入的文本和目标语言替换到模板中，生成一个完整的消息，
        // 然后传递给 llm 进行处理，最后通过 StringOutputParser 解析模型的输出，得到最终的翻译结果
        const chian = prompt.pipe(this.llm).pipe(new StringOutputParser());
        const result = await chian.invoke({
            text,
            targetLanguage
        });
        return {original: text, translation: result};
    }   

    async summarize(text: string, maxWords: number) {
         // 这里的 maxWords 是用户输入的最大字数限制，模型会根据这个限制来生成总结内容
        const prompt = ChatPromptTemplate.fromTemplate('请把以下内容总结成不超过 {maxWords} 个字的版本: {text}');
        
        const chian = prompt.pipe(this.llm).pipe(new StringOutputParser());
        const res = await chian.invoke({
            text,
            maxWords
        });
        return {original: text, maxWords, summary: res};
    }

    async classify(text: string) {
        // 数组的例子
        const examples = [
            {text: '今天天气真好，我们去公园玩吧', label: '积极'},
            {text: '我讨厌这个产品，太差了', label: '消极'},
            {text: '这个电影还行，有些地方不错', label: '中立'},
            {text: '这很失望，我不会买了 ', label: '消极'},
        ]
        const examplePrompt = PromptTemplate.fromTemplate('输入：{text}\n输出：{label}');

        const fewShotPrompt = new FewShotPromptTemplate({
            examples,
            examplePrompt,
            prefix: '请根据输入的文本内容进行情感分类，输出积极、消极或中立',
            suffix: '输入：{text}\n输出：',
            inputVariables: ['text'],

        }); 
        const formattedPrompt = await fewShotPrompt.format({text:text});
        const res = await this.llm.invoke(formattedPrompt);
        return {text, label: res.content};
    }
    // 代码审查的例子，输入一段代码和编程语言，模型会帮你找出其中的错误和改进建议
    async codeReview(code: string, language: string) {
        const prompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个资深{language}代码审查助手，帮助用户找出代码中的错误和改进建议。'],
            ['human', '请帮我审查以下的 {language} 代码，并指出其中的错误和改进建议：\n{code}']
        ])
        const chian = prompt.pipe(this.llm).pipe(new StringOutputParser());
        const res = await chian.invoke({
            code,
            language
        });
        return {language, code, review: res};
    }
}

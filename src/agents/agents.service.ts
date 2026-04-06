import { Injectable } from '@nestjs/common';
import {ChatOllama} from '@langchain/ollama';
import type { Response } from 'express'
import {AIMessage, HumanMessage, SystemMessage, ToolMessage} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {tool} from '@langchain/core/tools';
import { z} from 'zod';
import {config} from '../config'
@Injectable()
export class AgentsService {
     // 创建 chatOllama 实例
    private llm = new ChatOllama({
        model: config.ollama.chatModel, // Ollama 模型名称
        temperature: config.ollama.temperature, // 生成文本的随机程度
        baseUrl: config.ollama.host, // Ollama 服务器地址
        think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
        numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
    }); 

    // tool 把普通的js函数包装成模型能识别的格式  
    // name 是工具的名称(模型调用工具时会使用这个名称)，
    //  description 是工具的描述(告诉模型这个工具是干什么的)， 
    //  schema 定义了工具的输入参数 (zod格式 告诉模型调用这个工具时需要提供哪些参数，以及参数的类型和描述)，
    
    // 工具1 ： 查询商品库存和价格的工具，输入参数是商品名字，输出是一个字符串，包含商品的库存和价格信息
    private checkProductTool = tool(
        async ({productName}: {productName: string})=>{
            const products: Record<string, { stock: number; price: number;category: string }> = {
                'iPhone 18': { stock: 10, price: 7999, category: '手机' },
                'iPhone 18 pro': { stock: 10, price: 9999, category: '手机' },
                'MacBook Pro': { stock: 5, price: 19999, category: '电脑' },
                'AirPods Pro': { stock: 20, price: 1249, category: '电脑' },
                'Nike Air Max': { stock: 15, price: 149, category: '衣服' },
                'Adidas Ultraboost': { stock: 8, price: 180, category: '衣服' },
            }

            const product = products[productName];
            if(!product) {
                return `没有找到${productName}的相关信息`;
            }
            if(product.stock === 0) {
                return `商品: ${productName}, 当前缺货`;
            }
            return `商品: ${productName}, 库存: ${product.stock}, 价格: ${product.price}元, 分类: ${product.category}`;
        },
        {
            name: 'check_product',
            description: '查询商品库存和价格的工具，输入参数是商品名字，输出是一个字符串，包含商品的库存和价格信息',
            schema: z.object({
                productName: z.string().describe('要查询的商品名称: 例如: iPhone 18, MacBook Pro, Nike Air Max等'),
            })
        }

    )
    // 工具2： 创建订单
    private createOrderTool = tool(
        async ({productName, quantity, customerName}: {
            productName: string
            quantity: number
            customerName: string
        })=>{
            const prices: Record<string, number> = {
                'iPhone 18': 7999,
                'iPhone 18 pro': 9999,
                'MacBook Pro': 19999,
                'AirPods Pro': 1249,
                'Nike Air Max': 149,
                'Adidas Ultraboost': 180,
            }
            const unitPrice = prices[productName] ?? 0;
            const totalPrice = unitPrice * quantity;

            if(!unitPrice) {
                return `无法创建订单，未找到${productName}的价格信息`;
            }
            // 这里直接返回一个字符串，模拟创建订单的结果，实际项目中会调用数据库或者其他服务来创建订单
            return `成功创建订单: 商品 ${productName}, 数量 ${quantity}, 客户 ${customerName}`;
            // 订单- id, productName, quantity, customerName, totalPrice, createdAt
            const orderId = `ORDER-${Date.now().toString().slice(-6)}`;
            return `成功创建订单: 订单ID ${orderId}, 商品 ${productName}, 数量 ${quantity}, 客户 ${customerName}, 总价 ${totalPrice}元`;

        },
        {
            name: 'create_order',
            description: '创建订单的工具，输入参数是商品名字和数量，客户的名字，输出是一个字符串，包含订单创建的结果',
            schema: z.object({
                productName: z.string().describe('要创建订单的商品名称'),
                quantity: z.number().describe('要创建订单的商品数量'),
                customerName: z.string().describe('客户的姓名'),
            })
        }
    )
    // 工具3： 查询订单状态
    private checkOrderTool = tool(
       async ({orderId}: {orderId: string})=>{
            // 模拟订单的状态，实际项目中会查询数据库或者其他服务来获取订单状态
            const statuses = ['待支付', '已支付', '待发货', '已发货', '已完成', '已取消'];

            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const extra = status === '已取消' ? '订单因库存不足被取消' : '';
            return `订单ID ${orderId} 的当前状态是: ${status}`;
        },
        {
            name: 'check_order',
            description: '查询订单状态的工具，输入参数是订单ID，输出是一个字符串，包含订单的当前状态',
            schema: z.object({
                orderId: z.string().describe('要查询状态的订单ID, 例如: ORDER-123456'),
            })
        }
    )
    // 工具4： 申请退款
    private refundTool = tool(
        async ({orderId, reason}: {orderId: string, reason: string})=>{
            // 这里直接返回一个字符串，模拟申请退款的结果，实际项目中会调用数据库或者其他服务来处理退款申请
            const refundId = `REFUND-${Date.now().toString().slice(-6)}`;
            return `成功提交退款申请: 退款ID ${refundId}, 订单ID ${orderId}, 退款原因: ${reason}`;
        },
        {
            name: 'refund_tool',
            description: '申请退款的工具，输入参数是订单ID和退款原因，输出是一个字符串，包含退款申请的结果',
            schema: z.object({
                orderId: z.string().describe('要申请退款的订单ID, 例如: ORDER-123456'),
                reason: z.string().describe('申请退款的原因'),
            })
        }
    )

    // Agenet执行逻辑
    async runAgent(message: string) {

        const tools = [this.checkProductTool, this.createOrderTool, this.checkOrderTool, this.refundTool];
        const toolMap: Record<string, any> = {
            check_product: this.checkProductTool,
            create_order: this.createOrderTool,
            check_order: this.checkOrderTool,
            refund_tool: this.refundTool,
        };
        // bindTools 方法可以把工具绑定到 llm 上，这样模型在生成回答时就可以调用这些工具了，
        // 模型会根据用户的输入和对话的上下文来判断什么时候需要调用工具，以及调用哪个工具，并且把工具的输出结果整合到最终的回答中返回给用户
        // 注册成功后 模型回复里面会包含 tool_calls 字段，告诉我们模型调用了哪些工具，以及每个工具的输入参数是什么，我们就可以根据这个信息来调用对应的工具函数，获取工具的输出结果，然后把结果返回给模型，让模型继续生成回答
        const llmWithToolsthis= this.llm.bindTools(tools);

        // 消息历史： Agent 每一轮都能看到 完整的对话 + 工具调用结果
        const messages: any[] = [
            // 设定系统角色，告诉模型它是一个智能客服助手，能够处理查询商品信息、创建订单、查询订单状态和申请退款等任务
            new SystemMessage(`你是一个[极速购]电商平台的AI智能客服助手，帮助用户查询商品信息，创建订单，查询订单状态和申请退款。
                你可以使用以下的工具帮助客户：
                - check_product: 查询商品库存和价格的工具，输入参数是商品名字，输出是一个字符串，包含商品的库存和价格信息
                - create_order: 创建订单的工具，输入参数是商品名字和数量，客户的名字，输出是一个字符串，包含订单创建的结果
                - check_order: 查询订单状态的工具，输入参数是订单ID，输出是一个字符串，包含订单的当前状态
                - refund_tool: 申请退款的工具，输入参数是订单ID和退款原因，输出是一个字符串，包含退款申请的结果
                工作原则：
                1. 先用工具获取真实信息，再给用户回复
                2. 下单前必须先查询库存，确认有货后才能下单
                3. 下单的时候要知道用户的姓名， 如果用户没有提供姓名，要先询问用户的姓名
                4. 回答简洁友好，使用中文
                `),
            new HumanMessage(message)
        ]

        // 记录一下每步执行的过程（用于前端展示 调试）
        const steps: string[] = [];
        let roundCount = 0;

        // 定义一个递归函数来处理模型的回答和工具调用
        while(roundCount < 6) { // 限制最大轮数，防止死循环
            roundCount++;
            console.log(`Agent 演示----- 第${roundCount}轮:`);

            const response = await llmWithToolsthis.invoke(messages);
            messages.push(response); // 把模型的回答添加到消息历史中，让模型在下一轮回答时可以看到之前的对话内容和工具调用结果
            // tool_calls 是模型回答里一个特殊的字段，
            // 表示模型在这一轮回答中调用了哪些工具，以及每个工具的输入参数是什么，
            // 我们可以根据这个信息来调用对应的工具函数，获取工具的输出结果，然后把结果返回给模型，让模型继续生成回答
            // 模型有了答案， 退出循环，返回结果给前端
            if(!response.tool_calls || response.tool_calls.length === 0) {
                steps.push(`【最终回答】模型回答: ${response.content}`);
                break;
            }
            // 模型决定调用工具， 依次执行所有工具的调用
            for (const toolCall of response.tool_calls) {
                steps.push(`模型调用工具: ${toolCall.name}，输入参数: ${JSON.stringify(toolCall.args)}`);
                console.log('模型调用工具---', toolCall.name, toolCall.args);

                const toolFunc = toolMap[toolCall.name]; // 从工具映射表中找到对应的工具函数
                if(!toolFunc) {
                    const errorMsg = `未找到工具函数: ${toolCall.name}`;
                    steps.push(`【错误】${errorMsg}`);
                    messages.push(new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id ?? '' })); // 把错误信息也添加到消息历史中，让模型知道发生了什么问题
                    continue;
                }
                // 调用工具函数，获取结果
                const toolResult = await toolFunc.invoke(toolCall.args); // 调用工具函数，获取结果
                steps.push(`工具执行结果: ${toolResult}`);
                console.log('工具执行结果---', toolResult);

                // 把工具的结果作为新的消息添加到消息历史中，让模型在下一轮回答时可以看到这个结果
                messages.push(new ToolMessage({ content: String(toolResult), tool_call_id: toolCall.id ?? '' }));
            }
        }
        const finalResponse = [...messages].reverse().find(msg => msg instanceof AIMessage) || '很抱歉，我无法处理您的请求。';
        return { 
            message,
            steps,
            totalRounds: roundCount,
            answer: finalResponse instanceof AIMessage ? finalResponse.content : finalResponse
            
        }
    }
}

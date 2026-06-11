import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { ArticleService } from './service/article/langgraph.service';

@Controller('langgraph')
export class LanggraphController {
    constructor(private readonly langgraphService: LanggraphService,
      private readonly articleService: ArticleService
    ) {}

    // 工作流一：无记忆简单问答
    @Post('simple-chat')
    simpleChat(@Body() body: { message: string }) {
      return this.langgraphService.simpleChat(body.message);
    }

    // 工作流二：有记忆多轮对话
    @Post('memory-chat/:threadId')
    memoryChat(@Param('threadId') threadId: string, @Body() body: { message: string }) {
      return this.langgraphService.memoryChat(threadId, body.message);
    }

     // 工作流二：查看对话历史
    @Get('memory-chat/:threadId/history')
    getHistory(@Param('threadId') threadId: string) {
      return this.langgraphService.getHistory(threadId);
    }

    // 工作流三：文章摘要流水线
    @Post('article')
    processArticle(@Body() body: { article: string }) {
      return this.articleService.process(body.article)
    }
}

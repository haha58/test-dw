import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { ArticleService } from './service/article/langgraph.service';
import { RoutingService } from './service/routing/routing.service';
import { ParallelService } from './service/parallel/parallel.service';
import { SupervisorService } from './service/supervisor/supervisor.service';
import { PipelineService } from './service/pipeline/pipeline.service';

@Controller('langgraph')
export class LanggraphController {
    constructor(private readonly langgraphService: LanggraphService,
      private readonly articleService: ArticleService,
      private readonly routingService: RoutingService,
      private readonly parallelService: ParallelService,
      private readonly supervisorService: SupervisorService,
      private readonly pipelineService: PipelineService
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

    // 工作流四：路由流水线
    @Post('route')
    route(@Body() body: { input: string }) {
      return this.routingService.handle(body.input)
    }

    // 工作流五：并行流水线
    @Post('parallel')
    parallel(@Body() body: { task: string }) {
      return this.parallelService.parallelChat(body.task)
    }

    // 工作流六：超级管理员流水线
    @Post('supervisor')
    supervisor(@Body() body: { input: string }) {
      return this.supervisorService.run(body.input)
    }

    // 工作流七：流水线流程
    @Post('pipeline')
    pipeline(@Body() body: { topic: string }) {
      return this.pipelineService.createContent(body.topic)
    }
}

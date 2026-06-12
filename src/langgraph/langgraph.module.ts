import { Module } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { LanggraphController } from './langgraph.controller';
import { ArticleService } from './service/article/langgraph.service';
import { ReactAgentService } from './service/react-agent/react-agent.service';
import { RoutingService } from './service/routing/routing.service';
import { ParallelService } from './service/parallel/parallel.service';
import { SupervisorService } from './service/supervisor/supervisor.service';
import { PipelineService } from './service/pipeline/pipeline.service';
import { CodeReviewService } from './service/code-review/code-review.service';
import { EmailApprovalService } from './service/email-approval/email-approval.service';

@Module({
  providers: [LanggraphService, ArticleService, ReactAgentService, RoutingService, ParallelService, SupervisorService, PipelineService, CodeReviewService, EmailApprovalService],
  controllers: [LanggraphController]
})
export class LanggraphModule {}

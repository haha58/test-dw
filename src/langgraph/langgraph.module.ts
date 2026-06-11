import { Module } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { LanggraphController } from './langgraph.controller';
import { ArticleService } from './service/article/langgraph.service';
import { ReactAgentService } from './service/react-agent/react-agent.service';
import { RoutingService } from './service/routing/routing.service';
import { ParallelService } from './service/parallel/parallel.service';

@Module({
  providers: [LanggraphService, ArticleService, ReactAgentService, RoutingService, ParallelService],
  controllers: [LanggraphController]
})
export class LanggraphModule {}

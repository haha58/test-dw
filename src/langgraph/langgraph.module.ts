import { Module } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { LanggraphController } from './langgraph.controller';
import { ArticleService } from './service/article/langgraph.service';
import { ReactAgentService } from './service/react-agent/react-agent.service';

@Module({
  providers: [LanggraphService, ArticleService, ReactAgentService],
  controllers: [LanggraphController]
})
export class LanggraphModule {}

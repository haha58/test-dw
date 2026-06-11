import { Module } from '@nestjs/common';
import { LanggraphService } from './service/langgraph/langgraph.service';
import { LanggraphController } from './langgraph.controller';

@Module({
  providers: [LanggraphService],
  controllers: [LanggraphController]
})
export class LanggraphModule {}

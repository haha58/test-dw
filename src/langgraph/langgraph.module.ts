import { Module } from '@nestjs/common';
import { LanggraphService } from './langgraph.service';
import { LanggraphController } from './langgraph.controller';

@Module({
  providers: [LanggraphService],
  controllers: [LanggraphController]
})
export class LanggraphModule {}

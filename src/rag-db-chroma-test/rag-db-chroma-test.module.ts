import { Module } from '@nestjs/common';
import { RagDbChromaTestController } from './rag-db-chroma-test.controller';
import { RagDbChromaTestService } from './rag-db-chroma-test.service';

@Module({
  controllers: [RagDbChromaTestController],
  providers: [RagDbChromaTestService]
})
export class RagDbChromaTestModule {}

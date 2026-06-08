import { Module } from '@nestjs/common';
import { RagTestController } from './rag-test.controller';
import { RagTestService } from './rag-test.service';

@Module({
  controllers: [RagTestController],
  providers: [RagTestService]
})
export class RagTestModule {}

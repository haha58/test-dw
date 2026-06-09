import { Module } from '@nestjs/common';
import { RagDbTestController } from './rag-db-test.controller';
import { RagDbTestService } from './rag-db-test.service';

@Module({
  controllers: [RagDbTestController],
  providers: [RagDbTestService]
})
export class RagDbTestModule {}

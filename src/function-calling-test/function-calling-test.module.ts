import { Module } from '@nestjs/common';
import { FunctionCallingTestController } from './function-calling-test.controller';
import { FunctionCallingTestService } from './function-calling-test.service';

@Module({
  controllers: [FunctionCallingTestController],
  providers: [FunctionCallingTestService]
})
export class FunctionCallingTestModule {}

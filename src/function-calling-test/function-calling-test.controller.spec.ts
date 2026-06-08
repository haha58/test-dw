import { Test, TestingModule } from '@nestjs/testing';
import { FunctionCallingTestController } from './function-calling-test.controller';

describe('FunctionCallingTestController', () => {
  let controller: FunctionCallingTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FunctionCallingTestController],
    }).compile();

    controller = module.get<FunctionCallingTestController>(FunctionCallingTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

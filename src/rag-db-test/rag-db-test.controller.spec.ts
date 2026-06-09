import { Test, TestingModule } from '@nestjs/testing';
import { RagDbTestController } from './rag-db-test.controller';

describe('RagDbTestController', () => {
  let controller: RagDbTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagDbTestController],
    }).compile();

    controller = module.get<RagDbTestController>(RagDbTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

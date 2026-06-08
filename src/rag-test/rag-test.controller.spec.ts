import { Test, TestingModule } from '@nestjs/testing';
import { RagTestController } from './rag-test.controller';

describe('RagTestController', () => {
  let controller: RagTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagTestController],
    }).compile();

    controller = module.get<RagTestController>(RagTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

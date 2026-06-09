import { Test, TestingModule } from '@nestjs/testing';
import { RagDbChromaTestController } from './rag-db-chroma-test.controller';

describe('RagDbChromaTestController', () => {
  let controller: RagDbChromaTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagDbChromaTestController],
    }).compile();

    controller = module.get<RagDbChromaTestController>(RagDbChromaTestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

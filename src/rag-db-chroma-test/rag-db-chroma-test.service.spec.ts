import { Test, TestingModule } from '@nestjs/testing';
import { RagDbChromaTestService } from './rag-db-chroma-test.service';

describe('RagDbChromaTestService', () => {
  let service: RagDbChromaTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagDbChromaTestService],
    }).compile();

    service = module.get<RagDbChromaTestService>(RagDbChromaTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

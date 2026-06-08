import { Test, TestingModule } from '@nestjs/testing';
import { RagTestService } from './rag-test.service';

describe('RagTestService', () => {
  let service: RagTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagTestService],
    }).compile();

    service = module.get<RagTestService>(RagTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

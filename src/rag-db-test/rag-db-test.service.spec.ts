import { Test, TestingModule } from '@nestjs/testing';
import { RagDbTestService } from './rag-db-test.service';

describe('RagDbTestService', () => {
  let service: RagDbTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagDbTestService],
    }).compile();

    service = module.get<RagDbTestService>(RagDbTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

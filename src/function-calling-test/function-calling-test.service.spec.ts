import { Test, TestingModule } from '@nestjs/testing';
import { FunctionCallingTestService } from './function-calling-test.service';

describe('FunctionCallingTestService', () => {
  let service: FunctionCallingTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FunctionCallingTestService],
    }).compile();

    service = module.get<FunctionCallingTestService>(FunctionCallingTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

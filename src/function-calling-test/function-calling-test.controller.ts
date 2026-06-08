import { Body, Controller, Post } from '@nestjs/common';
import { FunctionCallingTestService } from './function-calling-test.service';

@Controller('function-calling-test')
export class FunctionCallingTestController {
    constructor(private readonly functionCallingTestService: FunctionCallingTestService) {}

    @Post('run')
    run(@Body() body: { message: string }) {
        return this.functionCallingTestService.run(body.message);
    }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { RagTestService } from 'src/rag-test/rag-test.service';
import { LoadDto } from './dto/load.dto';

@Controller('rag-test')
export class RagTestController {
    constructor(private readonly ragTestService: RagTestService ) {}

    @Post('load')
    load(@Body() body:LoadDto) {
        return this.ragTestService.load(body.documents);
    }

    @Post('query')
    query(@Body() body: { question: string; topK: number }) {
        return this.ragTestService.query(body.question, body.topK);
    }
}

import { Body, Controller, Post } from '@nestjs/common';
import { PromptsService } from './prompts.service';

@Controller('prompts')
export class PromptsController {

    constructor(private readonly promptsService: PromptsService) { }

    @Post('translate')
    translate(@Body() body: { text: string, targetLanguage: string }) {
        return this.promptsService.translate(body.text, body.targetLanguage);
    }
    @Post('summarize')
    summarize(@Body() body: { text: string, maxWords: number }) {
        return this.promptsService.summarize(body.text, body.maxWords);
    }

    @Post('classify')
    classify(@Body() body: { text: string }) {
        return this.promptsService.classify(body.text);
    }

    @Post('code-review')
    codeReview(@Body() body: { code: string; language: string }) {
        return this.promptsService.codeReview(body.code, body.language);
    }

}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestController } from './test/testController';
import { TestService } from './test/testService';
import { DemoModule } from './demo/demo.module';
import { ConfigModule } from '@nestjs/config';
// import { UserController } from './user/user.controller';
// import { UserService } from './user/user.service';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostModule } from './post/post.module';
import { ModelsModule } from './models/models.module';
import { PromptsModule } from './prompts/prompts.module';
import { ChainsModule } from './chains/chains.module';
import { AgentsModule } from './agents/agents.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';
import { FunctionCallingModule } from './function-calling/function-calling.module';

@Module({
  imports: [DemoModule, UserModule, OrderModule, PrismaModule, PostModule,
    ConfigModule.forRoot({
      isGlobal: true, // 👈 关键
    }),
    ModelsModule,
    PromptsModule,
    ChainsModule,
    AgentsModule,
    MemoryModule,
    RagModule,
    FunctionCallingModule,],
  controllers: [AppController, TestController],
  providers: [AppService, TestService,],
})
export class AppModule {}

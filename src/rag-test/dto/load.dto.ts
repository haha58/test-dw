// src/demo/dto/create-user.dto.ts

// DTO 就是一个普通的 TypeScript 类
// 用来描述 POST 请求体里有哪些字段、每个字段是什么类型

export interface IDocument {
    id: string,
    content: string,
    source: string,
}
export class LoadDto {
    documents: IDocument[]
}
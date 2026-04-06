
export const config = {
    ollama: {
        // 这里的 host 是 Ollama 服务器的地址，默认是 http://localhost:11434
        host: 'http://localhost:11434',
        // 这里的 chatModel 是 Ollama 上已经安装好的模型名称，embedModel 是用于向量化的模型名称
        chatModel: 'qwen3.5:0.8b',
        // 这里的 chatModel 是 Ollama 上已经安装好的模型名称，embedModel 是用于向量化的模型名称
        embedModel: 'tmxbai-embed-large:lates',
        // 这里的 temperature 是生成文本的随机程度，值越大生成的文本越随机，值越小生成的文本越确定
        temperature: 0.3,
    }
}
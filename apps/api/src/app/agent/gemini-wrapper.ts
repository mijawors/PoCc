import { GoogleGenerativeAI } from '@google/generative-ai';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseMessage, AIMessage } from '@langchain/core/messages';

/**
 * Wrapper for Google Generative AI that works with LangChain
 * Uses the new @google/generative-ai SDK which supports latest models
 */
export class GeminiChatWrapper extends Runnable<BaseMessage[], AIMessage> {
    private genAI: GoogleGenerativeAI;
    private modelName: string;

    lc_namespace = ['langchain', 'chat_models', 'gemini'];

    constructor(apiKey: string, modelName: string = 'models/gemma-3-1b') {
        super();
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = modelName;
    }

    async invoke(messages: BaseMessage[], config?: RunnableConfig): Promise<AIMessage> {
        const model = this.genAI.getGenerativeModel({ model: this.modelName });

        // Convert LangChain messages to Gemini format
        const contents = messages.map(msg => ({
            role: msg._getType() === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.content.toString() }]
        }));

        // Call Gemini API
        const result = await model.generateContent({
            contents: contents
        });

        const response = result.response;
        const text = response.text();

        return new AIMessage({ content: text });
    }
}

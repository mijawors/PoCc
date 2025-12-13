import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { HfInference } from '@huggingface/inference';

export class HuggingFaceChatWrapper extends Runnable<BaseMessage[], BaseMessage> {
    lc_namespace: string[];
    constructor(
        private readonly hf: HfInference,
        private readonly model: string,
    ) {
        super();
    }

    async invoke(input: BaseMessage[], _options?: RunnableConfig): Promise<BaseMessage> {
        const messages = input.map(msg => ({
            role: this.mapRole(msg),
            content: msg.content.toString(),
        }));

        const response = await this.hf.chatCompletion({
            model: this.model,
            messages,
            max_tokens: 1024,
        });

        return new AIMessage(response.choices[0].message.content ?? '');
    }

    private mapRole(message: BaseMessage): 'user' | 'assistant' | 'system' {
        switch (message._getType()) {
            case 'human': return 'user';
            case 'ai': return 'assistant';
            case 'system': return 'system';
            default: return 'user';
        }
    }
}
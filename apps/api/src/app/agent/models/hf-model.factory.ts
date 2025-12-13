import { HfInference } from '@huggingface/inference';
import { HuggingFaceChatWrapper } from './hf-chat.wrapper';
import { HF_MODELS } from './hf-models';

export class HuggingFaceModelFactory {
    static create(modelName = HF_MODELS.QWEN_25_7B) {
        return new HuggingFaceChatWrapper(
            new HfInference(process.env.HUGGINGFACEHUB_API_KEY),
            modelName,
        );
    }
}
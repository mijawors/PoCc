import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StateGraph, END } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HfInference } from '@huggingface/inference';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';

// Define the state interface for our agent graph
interface AgentState {
    projectName: string;
    description: string;
    requirements: string[];
    status: string;
}

export type ModelProvider = 'openai' | 'gemini' | 'xai' | 'huggingface';

export const RecommendedHFModels = {
    Qwen25_7B: 'Qwen/Qwen2.5-7B-Instruct',
    Llama32_3B: 'meta-llama/Llama-3.2-3B-Instruct',
    Mistral_7B: 'mistralai/Mistral-7B-Instruct-v0.2',
    Phi3_Mini: 'microsoft/Phi-3-mini-4k-instruct',
    Gemma2_9B: 'google/gemma-2-9b-it',
};

class HuggingFaceChatWrapper extends Runnable<BaseMessage[], BaseMessage> {
    lc_namespace = ['langchain', 'chat_models', 'huggingface'];

    constructor(private hf: HfInference, private model: string) {
        super();
    }

    async invoke(input: BaseMessage[], options?: RunnableConfig): Promise<BaseMessage> {
        const messages = input.map(m => ({
            role: this.getRole(m),
            content: m.content.toString()
        }));

        const response = await this.hf.chatCompletion({
            model: this.model,
            messages: messages,
            max_tokens: 1024,
        });

        return new HumanMessage(response.choices[0].message.content || '');
    }

    private getRole(message: BaseMessage): 'user' | 'assistant' | 'system' {
        if (message._getType() === 'human') return 'user';
        if (message._getType() === 'ai') return 'assistant';
        if (message._getType() === 'system') return 'system';
        return 'user';
    }
}

@Injectable()
export class AgentService {

    private getModel(provider: ModelProvider, modelName?: string): BaseChatModel | Runnable {
        switch (provider) {
            case 'gemini':
                return new ChatGoogleGenerativeAI({
                    model: modelName || 'gemini-pro',
                    maxOutputTokens: 2048,
                    apiKey: process.env['GOOGLE_API_KEY'],
                });
            case 'xai':
                return new ChatOpenAI({
                    modelName: modelName || 'grok-beta',
                    temperature: 0.7,
                    apiKey: process.env['XAI_API_KEY'],
                    configuration: {
                        baseURL: 'https://api.x.ai/v1',
                    },
                });
            case 'huggingface':
                return new HuggingFaceChatWrapper(
                    new HfInference(process.env['HUGGINGFACEHUB_API_KEY']),
                    modelName || RecommendedHFModels.Qwen25_7B
                );
            case 'openai':
            default:
                return new ChatOpenAI({
                    temperature: 0.7,
                    modelName: modelName || 'gpt-4o',
                    apiKey: process.env['OPENAI_API_KEY'],
                });
        }
    }

    async analyzeProject(name: string, description: string, provider: ModelProvider = 'openai', modelName?: string) {
        const model = this.getModel(provider, modelName);

        // 1. Define the Node: Analyst Agent
        const analystNode = async (state: AgentState) => {
            console.log(`🕵️ Analyst Agent is thinking using ${provider}...`);

            const promptPath = path.join(__dirname, 'assets', 'prompts', 'analyst.md');
            const systemPrompt = await fs.promises.readFile(promptPath, 'utf-8');

            const messages = [
                new SystemMessage(systemPrompt),
                new HumanMessage(
                    `Project Name: ${state.projectName}
           Description: ${state.description}
           
           Generate requirements:`
                ),
            ];

            const response = await model.invoke(messages);

            let requirements: string[] = [];
            try {
                // Simple parsing of the JSON response
                const content = response.content.toString();
                console.log('📝 Raw response from model:', content);

                // Clean up markdown code blocks if present
                const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log('🧹 Cleaned response:', jsonString);

                requirements = JSON.parse(jsonString);
                console.log('✅ Parsed requirements:', requirements);
            } catch (e) {
                console.error('❌ Failed to parse requirements', e);
                console.error('Response content was:', response.content.toString());
                requirements = ['Failed to generate requirements automatically.'];
            }

            return {
                ...state,
                requirements,
                status: 'ANALYZED',
            };
        };

        // 2. Define the Graph
        const workflow = new StateGraph<AgentState>({
            channels: {
                projectName: { reducer: (x, y) => y ?? x ?? "" },
                description: { reducer: (x, y) => y ?? x ?? "" },
                requirements: { reducer: (x, y) => y ?? x ?? [] },
                status: { reducer: (x, y) => y ?? x ?? "PENDING" },
            }
        })
            .addNode('analyst', analystNode)
            .setEntryPoint('analyst')
            .addEdge('analyst', END);

        // 3. Compile the Graph
        const app = workflow.compile();

        // 4. Run the Graph
        const result = await app.invoke({
            projectName: name,
            description: description,
            requirements: [],
            status: 'PENDING',
        });

        console.log('🔍 Final LangGraph result:', JSON.stringify(result, null, 2));

        return result;
    }
    async generateBackendCode(requirements: string[], provider: ModelProvider = 'openai', modelName?: string) {
        const model = this.getModel(provider, modelName);
        console.log(`👨‍💻 Backend Generator is coding using ${provider}...`);

        const promptPath = path.join(__dirname, 'assets', 'prompts', 'backend-generator.md');
        const systemPrompt = await fs.promises.readFile(promptPath, 'utf-8');

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(
                `You have ${requirements.length} requirements to implement. Generate complete NestJS code for EACH ONE.

Requirements List:
${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

IMPORTANT: 
- Generate a separate feature module for EACH requirement above
- Each feature should have: Controller, Service, DTO, Entity/Interface, Module
- That means you should generate approximately ${requirements.length * 5} files total
- Make all code FULLY FUNCTIONAL with real implementations

Generate the complete NestJS code now:`
            ),
        ];

        const response = await model.invoke(messages);

        try {
            const content = response.content.toString();
            const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('Failed to parse generated code', e);
            return [];
        }
    }
}

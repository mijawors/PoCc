import { Injectable } from '@nestjs/common';
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

    private getModel(provider: ModelProvider): BaseChatModel | Runnable {
        switch (provider) {
            case 'gemini':
                return new ChatGoogleGenerativeAI({
                    model: 'gemini-pro',
                    maxOutputTokens: 2048,
                    apiKey: process.env['GOOGLE_API_KEY'],
                });
            case 'xai':
                return new ChatOpenAI({
                    modelName: 'grok-beta', // or grok-1
                    temperature: 0.7,
                    apiKey: process.env['XAI_API_KEY'],
                    configuration: {
                        baseURL: 'https://api.x.ai/v1',
                    },
                });
            case 'huggingface':
                return new HuggingFaceChatWrapper(
                    new HfInference(process.env['HUGGINGFACEHUB_API_KEY']),
                    'mistralai/Mistral-7B-Instruct-v0.3'
                );
            case 'openai':
            default:
                return new ChatOpenAI({
                    temperature: 0.7,
                    modelName: 'gpt-4o',
                    apiKey: process.env['OPENAI_API_KEY'],
                });
        }
    }

    async analyzeProject(name: string, description: string, provider: ModelProvider = 'openai') {
        const model = this.getModel(provider);

        // 1. Define the Node: Analyst Agent
        const analystNode = async (state: AgentState) => {
            console.log(`🕵️ Analyst Agent is thinking using ${provider}...`);

            const messages = [
                new SystemMessage(
                    `You are an expert Business Analyst and Product Owner. 
           Your goal is to analyze a project idea and break it down into high-level functional requirements.
           Return ONLY a JSON array of strings, where each string is a requirement.
           Example: ["User authentication", "Dashboard view", "Payment integration"]`
                ),
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
                // Clean up markdown code blocks if present
                const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
                requirements = JSON.parse(jsonString);
            } catch (e) {
                console.error('Failed to parse requirements', e);
                requirements = ['Failed to generate requirements automatically.'];
            }

            return {
                requirements,
                status: 'ANALYZED',
            };
        };

        // 2. Define the Graph
        const workflow = new StateGraph<AgentState>({
            channels: {
                projectName: { reducer: (x: string) => x ?? "" },
                description: { reducer: (x: string) => x ?? "" },
                requirements: { reducer: (x: string[]) => x ?? [] },
                status: { reducer: (x: string) => x ?? "PENDING" },
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

        return result;
    }
    async generateBackendCode(requirements: string[], provider: ModelProvider = 'openai') {
        const model = this.getModel(provider);
        console.log(`👨‍💻 Backend Generator is coding using ${provider}...`);

        const messages = [
            new SystemMessage(
                `You are a Senior NestJS Developer.
                 Your task is to generate a simple, working NestJS implementation based on the provided requirements.
                 Generate the following files:
                 1. A Controller
                 2. A Service
                 3. A Module
                 4. A DTO
                 
                 Return ONLY a JSON array of objects with "filename" and "code" properties.
                 Example:
                 [
                   { "filename": "feature.controller.ts", "code": "..." },
                   { "filename": "feature.service.ts", "code": "..." }
                 ]
                 Do not use markdown blocks. Return raw JSON.`
            ),
            new HumanMessage(
                `Requirements:
                 ${requirements.join('\n')}
                 
                 Generate NestJS code:`
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

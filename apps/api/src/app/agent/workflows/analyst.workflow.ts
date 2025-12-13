import { StateGraph, END } from '@langchain/langgraph';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { AgentState } from '../types/agent-state.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Runnable } from '@langchain/core/runnables';

export async function runAnalystWorkflow(
    model: Runnable<BaseMessage[], BaseMessage>,
    input: AgentState,
) {
    const analystNode = async (state: AgentState) => {
        const prompt = await fs.readFile(
            path.join(__dirname, './assets/prompts/analyst.md'),
            'utf-8',
        );

        const response = await model.invoke([
            new SystemMessage(prompt),
            new HumanMessage(
                `Project: ${state.projectName}\nDescription: ${state.description}`,
            ),
        ]);

        const cleaned = response.content
            .toString()
            .replace(/```json|```/g, '')
            .trim();

        return {
            ...state,
            requirements: JSON.parse(cleaned),
            status: 'ANALYZED',
        };
    };

    const graph = new StateGraph<AgentState>({
        channels: {
            projectName: { reducer: (_, y) => y },
            description: { reducer: (_, y) => y },
            requirements: { reducer: (_, y) => y },
            status: { reducer: (_, y) => y },
        },
    })
        .addNode('analyst', analystNode)
        .setEntryPoint('analyst')
        .addEdge('analyst', END);

    return graph.compile().invoke(input as any);
}
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface InterviewResult {
    needsMoreInfo: boolean;
    refinedDescription: string;
    questions?: string[];
}

export async function runInterviewerWorkflow(
    model,
    description: string,
    conversationHistory: { role: 'agent' | 'user'; message: string }[],
): Promise<InterviewResult> {
    const prompt = await fs.readFile(
        path.join(__dirname, './assets/prompts/interviewer.md'),
        'utf-8',
    );

    const history = conversationHistory.length
        ? `Conversation history: ${conversationHistory
            .map(h => `${h.role === 'agent' ? 'Interviewer' : 'User'}: ${h.message}`)
            .join('\n')}`
        : '';

    const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage(
            `Project description: ${description}${history}

Return JSON only.`,
        ),
    ]);

    const cleaned = response.content
        .toString()
        .replace(/```json|```/g, '')
        .trim();

    return JSON.parse(cleaned);
}
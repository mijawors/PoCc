import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GeneratedFile {
    path: string;
    content: string;
}

export async function runBackendGeneratorWorkflow(
    model,
    requirements: string[],
): Promise<GeneratedFile[]> {
    const prompt = await fs.readFile(
        path.join(__dirname, './assets/prompts/backend-generator.md'),
        'utf-8',
    );

    const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage(
            `Generate NestJS backend code.
Requirements: ${requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Return JSON only.`,
        ),
    ]);

    const cleaned = response.content
        .toString()
        .replace(/```json | ```/g, '')
        .trim();

    return JSON.parse(cleaned);
}
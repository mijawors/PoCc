export interface AgentState {
    projectName: string;
    description: string;
    requirements: string[];
    status: 'PENDING' | 'ANALYZED';
}
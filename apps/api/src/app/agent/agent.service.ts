import { Injectable } from "@nestjs/common";
import { HuggingFaceModelFactory } from "./models/hf-model.factory";
import { runAnalystWorkflow } from "./workflows/analyst.workflow";
import { runBackendGeneratorWorkflow } from "./workflows/backend-generator.workflow";
import { runInterviewerWorkflow } from "./workflows/interviewer.workflow";

@Injectable()
export class AgentService {

    private createModel() {
        return HuggingFaceModelFactory.create();
    }

    async analyzeProject(name: string, description: string) {
        return runAnalystWorkflow(
            this.createModel(),
            {
                projectName: name,
                description,
                requirements: [],
                status: 'PENDING',
            },
        );
    }

    async conductInterview(description: string, history: any[]) {
        return runInterviewerWorkflow(
            this.createModel(),
            description,
            history,
        );
    }

    async generateBackendCode(requirements: string[]) {
        return runBackendGeneratorWorkflow(
            this.createModel(),
            requirements,
        );
    }
}
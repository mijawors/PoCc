import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { AgentService } from './agent/agent.service';
import { Project } from '@prisma/client';

@Injectable()
export class AppService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly agentService: AgentService,
    ) { }

    getData(): { message: string } {
        return { message: 'Hello API' };
    }

    // -----------------------------
    // CREATE PROJECT
    // -----------------------------
    async createProject(name: string, description: string): Promise<Project> {
        const project = await this.prisma.project.create({
            data: {
                name,
                description,
                status: 'INTERVIEWING',
                conversationHistory: [],
                interviewComplete: false,
            },
        });

        try {
            const interviewResult = await this.agentService.conductInterview(
                description,
                [],
            );

            if (interviewResult.needsMoreInfo) {
                await this.prisma.project.update({
                    where: { id: project.id },
                    data: {
                        status: 'AWAITING_ANSWER',
                        conversationHistory: [
                            {
                                role: 'agent',
                                message: interviewResult.questions?.join('\n\n') ?? '',
                            },
                        ] as any,
                    },
                });
            } else {
                await this.startAnalysis(
                    project.id,
                    interviewResult.refinedDescription,
                );
            }
        } catch (error) {
            console.error('❌ Interview failed, skipping:', error);
            await this.startAnalysis(project.id, description);
        }

        return project;
    }

    // -----------------------------
    // ANALYSIS
    // -----------------------------
    private async startAnalysis(
        projectId: string,
        description: string,
    ): Promise<void> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) return;

        await this.prisma.project.update({
            where: { id: projectId },
            data: { status: 'ANALYZING' },
        });

        // fire-and-forget (background)
        this.agentService
            .analyzeProject(project.name, description)
            .then(async (result) => {
                await this.prisma.project.update({
                    where: { id: projectId },
                    data: {
                        status: 'AWAITING_REQUIREMENTS_APPROVAL',
                        pendingRequirements: result.requirements as any,
                    },
                });
            })
            .catch(async (error) => {
                console.error('❌ Analysis failed:', error);
                await this.prisma.project.update({
                    where: { id: projectId },
                    data: { status: 'FAILED' },
                });
            });
    }

    // -----------------------------
    // QUERIES
    // -----------------------------
    async getAllProjects(): Promise<Project[]> {
        return this.prisma.project.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async getProject(id: string): Promise<Project | null> {
        return this.prisma.project.findUnique({ where: { id } });
    }

    // -----------------------------
    // REQUIREMENTS APPROVAL
    // -----------------------------
    async approveRequirements(
        projectId: string,
        approved: boolean,
    ): Promise<Project> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        if (!approved) {
            return this.prisma.project.update({
                where: { id: projectId },
                data: {
                    status: 'REJECTED',
                    pendingRequirements: null,
                },
            });
        }

        const updatedProject = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                requirements: project.pendingRequirements,
                pendingRequirements: null,
                status: 'GENERATING_CODE',
            },
        });

        const requirements = project.pendingRequirements as string[];

        // fire-and-forget
        this.agentService
            .generateBackendCode(requirements)
            .then(async (code) => {
                await this.prisma.project.update({
                    where: { id: projectId },
                    data: {
                        status: 'AWAITING_CODE_APPROVAL',
                        pendingCode: JSON.parse(JSON.stringify(code)), // ✅ FIX
                    },
                });
            })
            .catch(async (error) => {
                console.error('❌ Code generation failed:', error);
                await this.prisma.project.update({
                    where: { id: projectId },
                    data: { status: 'FAILED' },
                });
            });

        return updatedProject;
    }

    // -----------------------------
    // CODE APPROVAL
    // -----------------------------
    async approveCode(
        projectId: string,
        approved: boolean,
    ): Promise<Project> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        if (!approved) {
            return this.prisma.project.update({
                where: { id: projectId },
                data: {
                    status: 'REJECTED',
                    pendingCode: null,
                },
            });
        }

        return this.prisma.project.update({
            where: { id: projectId },
            data: {
                generatedCode: project.pendingCode,
                pendingCode: null,
                status: 'COMPLETED',
            },
        });
    }

    // -----------------------------
    // INTERVIEW CONTINUATION
    // -----------------------------
    async submitAnswer(
        projectId: string,
        answer: string,
    ): Promise<Project | null> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        const updatedHistory = [
            ...(project.conversationHistory as any[]),
            { role: 'user', message: answer },
        ];

        await this.prisma.project.update({
            where: { id: projectId },
            data: {
                conversationHistory: updatedHistory as any,
                status: 'INTERVIEWING',
            },
        });

        this.agentService
            .conductInterview(project.description, updatedHistory)
            .then(async (result) => {
                if (result.needsMoreInfo) {
                    await this.prisma.project.update({
                        where: { id: projectId },
                        data: {
                            status: 'AWAITING_ANSWER',
                            conversationHistory: [
                                ...updatedHistory,
                                {
                                    role: 'agent',
                                    message: result.questions?.join('\n\n') ?? '',
                                },
                            ] as any,
                        },
                    });
                } else {
                    await this.prisma.project.update({
                        where: { id: projectId },
                        data: {
                            interviewComplete: true,
                            refinedDescription: result.refinedDescription,
                        },
                    });

                    await this.startAnalysis(
                        projectId,
                        result.refinedDescription,
                    );
                }
            })
            .catch(async (error) => {
                console.error('❌ Interview continuation failed:', error);
                await this.prisma.project.update({
                    where: { id: projectId },
                    data: { status: 'FAILED' },
                });
            });

        return this.getProject(projectId);
    }

    // -----------------------------
    // SKIP INTERVIEW
    // -----------------------------
    async skipInterview(projectId: string): Promise<Project | null> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        await this.prisma.project.update({
            where: { id: projectId },
            data: {
                interviewComplete: true,
                refinedDescription: project.description,
            },
        });

        await this.startAnalysis(projectId, project.description);

        return this.getProject(projectId);
    }
}
import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { AgentService } from './agent/agent.service';
import { Project } from '@prisma/client';

@Injectable()
export class AppService {
  constructor(
    private prisma: PrismaService,
    private agentService: AgentService
  ) { }

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async createProject(name: string, description: string, provider: 'openai' | 'gemini' | 'xai' | 'huggingface' = 'openai', model?: string): Promise<Project> {
    // 1. Create Project in DB
    const project = await this.prisma.project.create({
      data: {
        name,
        description,
        status: 'ANALYZING',
      },
    });

    // 2. Run Analyst Agent and STOP (don't continue to code generation)
    this.agentService.analyzeProject(name, description, provider, model).then(async (result) => {
      console.log('✅ Analysis Complete:', result.requirements);

      // Save to pendingRequirements and wait for user approval
      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'AWAITING_REQUIREMENTS_APPROVAL',
          pendingRequirements: result.requirements as any
        }
      });
    }).catch(async (error) => {
      console.error('❌ Analysis failed:', error);
      await this.prisma.project.update({
        where: { id: project.id },
        data: { status: 'FAILED' }
      });
    });

    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProject(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async approveRequirements(projectId: string, approved: boolean): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!approved) {
      // User rejected requirements
      return this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'REJECTED',
          pendingRequirements: null
        }
      });
    }

    // User approved - move pending to approved and start code generation
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        requirements: project.pendingRequirements,
        pendingRequirements: null,
        status: 'GENERATING_CODE'
      }
    });

    // Trigger Backend Generator
    const requirements = project.pendingRequirements as string[];
    // Get provider and model from project (we'll need to add these fields later)
    const provider = 'huggingface'; // TODO: store provider in project
    const model = undefined; // TODO: store model in project

    this.agentService.generateBackendCode(requirements, provider, model).then(async (code) => {
      console.log('✅ Code Generation Complete');
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'AWAITING_CODE_APPROVAL',
          pendingCode: code
        }
      });
    }).catch(async (error) => {
      console.error('❌ Code generation failed:', error);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' }
      });
    });

    return updatedProject;
  }

  async approveCode(projectId: string, approved: boolean): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!approved) {
      // User rejected code
      return this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'REJECTED',
          pendingCode: null
        }
      });
    }

    // User approved - move pending to approved and mark as completed
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        generatedCode: project.pendingCode,
        pendingCode: null,
        status: 'COMPLETED'
      }
    });
  }
}

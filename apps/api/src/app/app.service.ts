import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AgentService } from './agent.service';
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

  async createProject(name: string, description: string, provider: 'openai' | 'gemini' = 'openai'): Promise<Project> {
    // 1. Create Project in DB
    const project = await this.prisma.project.create({
      data: {
        name,
        description,
        status: 'ANALYZING',
      },
    });

    // 2. Trigger Agent Analysis (Async)
    this.agentService.analyzeProject(name, description, provider).then(async (result) => {
      console.log('✅ Analysis Complete:', result.requirements);

      // Update Project with results (appending to description for now as PoC)
      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'REQUIREMENTS_READY',
          description: `${description}\n\n📋 Requirements:\n${(result.requirements as string[]).map(r => '- ' + r).join('\n')}`
        }
      });

      // 3. Trigger Backend Generator
      this.agentService.generateBackendCode(result.requirements as string[], provider).then(async (code) => {
        console.log('✅ Code Generation Complete');
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            status: 'COMPLETED',
            generatedCode: code
          }
        });
      });
    });

    return project;
  }

  async getProjects(): Promise<Project[]> {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}

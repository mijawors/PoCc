import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('projects')
  createProject(@Body() body: { name: string; description: string; provider?: 'openai' | 'gemini' }) {
    return this.appService.createProject(body.name, body.description, body.provider);
  }

  @Get('projects')
  getProjects() {
    return this.appService.getProjects();
  }
}

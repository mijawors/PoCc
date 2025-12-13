import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    getData() {
        return this.appService.getData();
    }

    @Post('projects')
    createProject(@Body() body: { name: string; description: string }) {
        return this.appService.createProject(body.name, body.description);
    }

    @Get('projects')
    getAllProjects() {
        return this.appService.getAllProjects();
    }

    @Get('projects/:id')
    getProject(@Param('id') id: string) {
        return this.appService.getProject(id);
    }

    @Post('projects/:id/approve-requirements')
    approveRequirements(
        @Param('id') id: string,
        @Body() body: { approved: boolean }
    ) {
        return this.appService.approveRequirements(id, body.approved);
    }

    @Post('projects/:id/approve-code')
    approveCode(
        @Param('id') id: string,
        @Body() body: { approved: boolean }
    ) {
        return this.appService.approveCode(id, body.approved);
    }

    @Post('projects/:id/submit-answer')
    submitAnswer(
        @Param('id') id: string,
        @Body() body: { answer: string }
    ) {
        return this.appService.submitAnswer(id, body.answer);
    }

    @Post('projects/:id/skip-interview')
    skipInterview(@Param('id') id: string) {
        return this.appService.skipInterview(id);
    }
}

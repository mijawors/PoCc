import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { TranslateModule, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-project-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TranslatePipe],
  templateUrl: './project-wizard.component.html',
  styleUrl: './project-wizard.component.css',
})
export class ProjectWizard {
  name = '';
  description = '';
  provider = 'gemini'; // Default to Gemini (free)
  model = ''; // Selected model
  projects: any[] = [];
  activeProject: any = null;
  showProjectList = false;
  currentAnswer = ''; // User's answer to interview questions
  private refreshInterval: any;

  // Available models for HuggingFace
  huggingfaceModels = [
    { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen 2.5 7B (Recommended)' },
    { value: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B' },
    { value: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B v0.2' },
    { value: 'microsoft/Phi-3-mini-4k-instruct', label: 'Phi-3 Mini' },
    { value: 'google/gemma-2-9b-it', label: 'Gemma 2 9B' },
  ];

  constructor(private http: HttpClient) {
    this.loadProjects();
    // Auto-refresh every 2 seconds to catch status changes
    this.refreshInterval = setInterval(() => {
      this.loadProjects();
      if (this.activeProject) {
        this.refreshActiveProject();
      }
    }, 2000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  createProject() {
    this.http
      .post<any>('/api/projects', {
        name: this.name,
        description: this.description,
        provider: this.provider,
        model: this.model || undefined
      })
      .subscribe((project) => {
        this.name = '';
        this.description = '';
        this.model = '';
        this.activeProject = project; // Set as active project
        this.loadProjects();
      });
  }

  loadProjects() {
    this.http.get<any[]>('/api/projects').subscribe((projects) => {
      this.projects = projects;
    });
  }

  refreshActiveProject() {
    if (!this.activeProject) return;
    this.http.get<any>(`/api/projects/${this.activeProject.id}`).subscribe((project) => {
      this.activeProject = project;
    });
  }

  selectProject(project: any) {
    this.activeProject = project;
    this.showProjectList = false;
  }

  clearActiveProject() {
    this.activeProject = null;
  }

  toggleProjectList() {
    this.showProjectList = !this.showProjectList;
  }

  approveRequirements(approved: boolean) {
    if (!this.activeProject) return;

    this.http.post(`/api/projects/${this.activeProject.id}/approve-requirements`, { approved })
      .subscribe(() => {
        this.refreshActiveProject();
        this.loadProjects();
      });
  }

  approveCode(approved: boolean) {
    if (!this.activeProject) return;

    this.http.post(`/api/projects/${this.activeProject.id}/approve-code`, { approved })
      .subscribe(() => {
        this.refreshActiveProject();
        this.loadProjects();
      });
  }

  submitAnswer() {
    if (!this.activeProject || !this.currentAnswer) return;

    this.http.post(`/api/projects/${this.activeProject.id}/submit-answer`, {
      answer: this.currentAnswer
    }).subscribe(() => {
      this.currentAnswer = '';
      this.refreshActiveProject();
    });
  }

  skipInterview() {
    if (!this.activeProject) return;

    if (confirm('Are you sure you want to skip the interview and proceed with the current information?')) {
      this.http.post(`/api/projects/${this.activeProject.id}/skip-interview`, {})
        .subscribe(() => {
          this.refreshActiveProject();
        });
    }
  }
}

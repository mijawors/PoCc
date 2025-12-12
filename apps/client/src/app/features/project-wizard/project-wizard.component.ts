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
  provider = 'openai';
  projects: any[] = [];
  activeProject: any = null; // Currently active project being worked on
  showProjectList = false; // Toggle for project history
  private refreshInterval: any;

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
        provider: this.provider
      })
      .subscribe((project) => {
        this.name = '';
        this.description = '';
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
}

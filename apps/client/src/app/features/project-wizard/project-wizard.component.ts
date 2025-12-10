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

  constructor(private http: HttpClient) {
    this.loadProjects();
  }

  createProject() {
    this.http
      .post('/api/projects', { name: this.name, description: this.description, provider: this.provider })
      .subscribe(() => {
        this.name = '';
        this.description = '';
        this.loadProjects();
      });
  }

  loadProjects() {
    this.http.get<any[]>('/api/projects').subscribe((projects) => {
      this.projects = projects;
    });
  }
}

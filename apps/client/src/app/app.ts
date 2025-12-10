import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProjectWizard } from './features/project-wizard/project-wizard.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
  imports: [RouterModule, ProjectWizard],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'client';

  constructor(private translate: TranslateService) {
    this.translate.addLangs(['en']);
    this.translate.setDefaultLang('en');
    this.translate.use('en');
  }
}

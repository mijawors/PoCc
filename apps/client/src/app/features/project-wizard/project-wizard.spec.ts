import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectWizard } from './project-wizard.component';

describe('ProjectWizard', () => {
  let component: ProjectWizard;
  let fixture: ComponentFixture<ProjectWizard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectWizard],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectWizard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

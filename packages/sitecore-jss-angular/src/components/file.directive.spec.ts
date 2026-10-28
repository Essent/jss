import { Component, DebugElement, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FileDirective } from './file.directive';
import { FileField } from './rendering-field';
import { JSS_DIRECTIVES } from '../lib.module';

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-file',
  template: `
    <a *scFile="field()"></a>
  `,
})
class TestComponent {
  readonly field = input<FileField | undefined>(undefined);
}

describe('<a *scFile />', () => {
  let fixture: ComponentFixture<TestComponent>;
  let de: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [],
      imports: [FileDirective, TestComponent],
    });

    fixture = TestBed.createComponent(TestComponent);

    fixture.detectChanges();

    de = fixture.debugElement.query(By.css('a'));
  });

  it('should render nothing with missing field', () => {
    expect(de.nativeElement.href).toBe('');
  });

  it('should render nothing with missing value', () => {
    const field = {
      editable: 'lorem',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();
    expect(de.nativeElement.href).toBe('');
  });

  it('should render with src directly on provided field', () => {
    const field = {
      src: '/lorem',
      title: 'ipsum',
    };

    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    expect(de.nativeElement.href).toContain(field.src);
    expect(de.nativeElement.innerHTML).toContain(field.title);
  });

  it('should render display name if no title', () => {
    const field = {
      value: {
        src: '/lorem',
        displayName: 'ipsum',
      },
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    expect(de.nativeElement.innerHTML).toContain(field.value.displayName);
  });
});

import { Component, DebugElement, TemplateRef, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { generalLinkField as eeLinkData } from '../test-data/ee-data';
import { RouterLinkDirective } from './router-link.directive';
import { RouterTestingModule } from '@angular/router/testing';
import { LinkField } from './rendering-field';
import { JSS_DIRECTIVES } from '../lib.module';

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-router-link',
  template: `
    <a
      *scRouterLink="field(); editable: editable(); attrs: attrs()"
      class="external-css-class"
      id="my-link"
    ></a>
  `,
})
class TestComponent {
  readonly field = input<LinkField | undefined>(undefined);
  readonly editable = input(true);
  readonly attrs = input({});
}

const emptyLinkFieldEditingTemplateId = 'emptyLinkFieldEditingTemplate';
const emptyLinkFieldEditingTemplate = '<span>[This is a *custom* empty field template]</span>';
const emptyLinkFieldEditingTemplateDefaultTestString =
  '<span sc-default-empty-text-field-editing-placeholder="">[No text in field]</span>';

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-empty-template-router-link',
  template: `
    <a
      *scRouterLink="
        field();
        editable: editable();
        attrs: attrs();
        emptyFieldEditingTemplate: ${emptyLinkFieldEditingTemplateId}
      "
      class="external-css-class"
      id="my-link"
    ></a>
    <ng-template #${emptyLinkFieldEditingTemplateId}>
      ${emptyLinkFieldEditingTemplate}
    </ng-template>
  `,
})
class TestEmptyTemplateComponent {
  readonly field = input<LinkField>();
  readonly editable = input(true);
  readonly attrs = input({});
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>();
}

describe('<a *scRouterLink />', () => {
  let fixture: ComponentFixture<TestComponent>;
  let de: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [],
      imports: [
        RouterTestingModule,
        RouterLinkDirective,
        TestComponent,
        TestEmptyTemplateComponent,
      ],
    });

    fixture = TestBed.createComponent(TestComponent);
    de = fixture.debugElement;

    fixture.detectChanges();
  });

  it('should render nothing with missing field', () => {
    expect(de.children.length).toBe(0);
  });

  it('should render nothing with missing editable and value', () => {
    const field = {};
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    expect(de.children.length).toBe(0);
  });

  it('should render editable with an editable value', () => {
    const field = {
      editableFirstPart: '<a class="yo" href="/services">Lorem',
      editableLastPart: '</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    expect(de.nativeElement.querySelector('span').innerHTML).toContain(field.editableFirstPart);
  });

  it('should render value with editing explicitly disabled', () => {
    const field = {
      value: {
        href: '/lorem',
        text: 'ipsum',
      },
      editable: '<a href="/services" class="yo">Lorem</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();

    const rendered = de.query(By.css('a'));
    expect(rendered.nativeElement.href).toContain(field.value.href);
    expect(rendered.nativeElement.innerHTML).toBe(field.value.text);
  });

  it('should render with href directly on provided field', () => {
    const field = {
      href: '/lorem',
      text: 'ipsum',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    const rendered = de.query(By.css('a'));
    expect(rendered.nativeElement.href).toContain(field.href);
    expect(rendered.nativeElement.innerHTML).toBe(field.text);
  });

  it('should render ee HTML', () => {
    const field = {
      editableFirstPart: eeLinkData,
      editableLastPart: '</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    const rendered = de.nativeElement.querySelector('span');
    expect(rendered).not.toBeNull();
    expect(rendered.innerHTML).toContain('<input');
    expect(rendered.innerHTML).toContain('chrometype="field"');
  });

  it('should render all value attributes', () => {
    const field = {
      value: {
        anchor: 'sample-anchor',
        href: '/lorem',
        text: 'ipsum',
        class: 'my-link',
        title: 'My Link',
        target: '_blank',
      },
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    const rendered = de.query(By.css('a'));
    expect(rendered.nativeElement.href).toContain(`${field.value.href}#${field.value.anchor}`);
    expect(rendered.nativeElement.className).toBe('external-css-class my-link');
    expect(rendered.nativeElement.title).toContain(field.value.title);
    expect(rendered.nativeElement.target).toContain(field.value.target);
  });

  it('should render other attributes on wrapper span with other props provided with editable', () => {
    const field = {
      editableFirstPart: '<a href="/services" class="yo">Lorem',
      editableLastPart: '</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    const rendered = de.nativeElement.querySelector('span');
    expect(rendered.id).toBe('my-link');
  });

  it('should apply attributes from attrs on wrapper span when rendering in editable mode', () => {
    const field = {
      editableFirstPart: '<a href="/services" class="yo">Lorem',
      editableLastPart: '</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('attrs', { title: 'footip' });
    fixture.detectChanges();

    const rendered = de.nativeElement.querySelector('span');
    expect(rendered.title).toBe('footip');
  });

  it('should merge attributes from attrs on link when rendering standard (non-editable mode) field', () => {
    const field = {
      value: {
        href: '/lorem',
        text: 'ipsum',
        class: 'my-link',
        title: 'My Link',
        target: '_blank',
      },
    };
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('attrs', { title: 'footip' });
    fixture.detectChanges();

    const rendered = de.query(By.css('a'));
    expect(rendered.nativeElement.target).toBe('_blank');
    expect(rendered.nativeElement.title).toBe('footip');
    expect(rendered.nativeElement.className).toBe('external-css-class my-link');
  });

  describe('editMode metadata', () => {
    const testMetadata = {
      contextItem: {
        id: '{09A07660-6834-476C-B93B-584248D3003B}',
        language: 'en',
        revision: 'a0b36ce0a7db49418edf90eb9621e145',
        version: 1,
      },
      fieldId: '{414061F4-FBB1-4591-BC37-BFFA67F745EB}',
      fieldType: 'link',
      rawValue: 'Test1',
    };

    it('should render default empty field component when field value href is not present', () => {
      const field = {
        value: { src: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplateDefaultTestString);
    });

    it('should render default empty field component when field href is not present', () => {
      const field = {
        hred: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplateDefaultTestString);
    });

    it('should render custom empty field component when provided, when field value href is not present', () => {
      fixture = TestBed.createComponent(TestEmptyTemplateComponent);
      fixture.detectChanges();

      de = fixture.debugElement;

      const field = {
        value: { href: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplate);
    });

    it('should render custom empty field component when provided, when field href is not present', () => {
      fixture = TestBed.createComponent(TestEmptyTemplateComponent);
      fixture.detectChanges();

      de = fixture.debugElement;

      const field = {
        href: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplate);
    });

    it('should render nothing when field value href is not present, when editing is explicitly disabled', () => {
      const field = {
        value: { href: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.componentRef.setInput('editable', false);
      fixture.detectChanges();
      expect(de.children.length).toBe(0);
    });

    it('should render nothing when field href is empty, when editing is explicitly disabled', () => {
      const field = {
        href: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.componentRef.setInput('editable', false);
      fixture.detectChanges();
      expect(de.children.length).toBe(0);
    });
  });
});

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-router-link-children',
  template: `
    <a *scRouterLink="field(); editable: editable(); attrs: attrs()" id="my-link"
      >@if (true) {
      <span>hello world</span>
      }</a
    >
  `,
})
class TestWithChildrenComponent {
  readonly field = input<LinkField>();
  readonly editable = input(true);
  readonly attrs = input({});
}

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-empty-template-link',
  template: `
    <a
      *scRouterLink="
        field();
        editable: editable();
        attrs: attrs();
        emptyFieldEditingTemplate: ${emptyLinkFieldEditingTemplateId}
      "
      id="my-link"
      ><span *ngIf="true">hello world</span></a
    >
    <ng-template #${emptyLinkFieldEditingTemplateId}>
      ${emptyLinkFieldEditingTemplate}
    </ng-template>
  `,
})
class TestEmptyTemplateWithChildrenComponent {
  readonly field = input<LinkField>();
  readonly editable = input(true);
  readonly attrs = input({});
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>();
}

describe('<a *scRouterLink>children</a>', () => {
  let fixture: ComponentFixture<TestComponent>;
  let de: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [],
      imports: [
        RouterTestingModule,
        RouterLinkDirective,
        TestWithChildrenComponent,
        TestEmptyTemplateWithChildrenComponent,
      ],
    });

    fixture = TestBed.createComponent(TestWithChildrenComponent);
    de = fixture.debugElement;

    fixture.detectChanges();
  });

  it('should render children with an editable value', () => {
    const field = {
      editableFirstPart: '<a class="yo" href="/services">Lorem',
      editableLastPart: '</a>',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    expect(de.nativeElement.innerHTML).toContain('hello world');
  });

  it('should render children with href directly on provided field', () => {
    const field = {
      href: '/lorem',
      text: 'ipsum',
    };
    fixture.componentRef.setInput('field', field);
    fixture.detectChanges();

    const rendered = de.query(By.css('a'));
    expect(rendered.nativeElement.innerHTML).toContain('<span>hello world</span>');
  });

  describe('editMode metadata', () => {
    const testMetadata = {
      contextItem: {
        id: '{09A07660-6834-476C-B93B-584248D3003B}',
        language: 'en',
        revision: 'a0b36ce0a7db49418edf90eb9621e145',
        version: 1,
      },
      fieldId: '{414061F4-FBB1-4591-BC37-BFFA67F745EB}',
      fieldType: 'link',
      rawValue: 'Test1',
    };

    it('should render default empty field component when field value href is not present', () => {
      const field = {
        value: { src: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplateDefaultTestString);
    });

    it('should render default empty field component when field href is not present', () => {
      const field = {
        hred: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplateDefaultTestString);
    });

    it('should render custom empty field component when provided, when field value href is not present', () => {
      fixture = TestBed.createComponent(TestEmptyTemplateWithChildrenComponent);
      fixture.detectChanges();

      de = fixture.debugElement;

      const field = {
        value: { href: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplate);
    });

    it('should render custom empty field component when provided, when field href is not present', () => {
      fixture = TestBed.createComponent(TestEmptyTemplateWithChildrenComponent);
      fixture.detectChanges();

      de = fixture.debugElement;

      const field = {
        href: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.detectChanges();

      const rendered = de.nativeElement.innerHTML;
      expect(rendered).toContain(emptyLinkFieldEditingTemplate);
    });

    it('should render nothing when field value href is not present, when editing is explicitly disabled', () => {
      const field = {
        value: { href: undefined },
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.componentRef.setInput('editable', false);
      fixture.detectChanges();
      expect(de.children.length).toBe(0);
    });

    it('should render nothing when field href is empty, when editing is explicitly disabled', () => {
      const field = {
        href: undefined,
        metadata: testMetadata,
      };
      fixture.componentRef.setInput('field', field);
      fixture.componentRef.setInput('editable', false);
      fixture.detectChanges();
      expect(de.children.length).toBe(0);
    });
  });
});

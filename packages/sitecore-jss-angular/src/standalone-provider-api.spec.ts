import { DatePipe } from '@angular/common';
import {
  Component,
  inject,
  InjectionToken,
  input,
  makeEnvironmentProviders,
  NgModule,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ROUTES } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentRendering } from '@sitecore-jss/sitecore-jss/layout';
import { JSS_DIRECTIVES, JssModule, provideJss, provideJssComponents } from './lib.module';
import {
  ComponentNameAndModule,
  DYNAMIC_COMPONENT,
  PLACEHOLDER_LAZY_COMPONENTS,
} from './services/placeholder.token';

const LAZY_COMPONENT_MESSAGE = new InjectionToken<string>('LAZY_COMPONENT_MESSAGE');

@Component({
  selector: 'test-standalone-lazy-jumbotron',
  standalone: true,
  template: '{{ message }} {{ rendering()?.componentName }} {{ forwardedMessage() }}',
})
class TestStandaloneLazyJumbotronComponent {
  readonly rendering = input<ComponentRendering>();
  readonly forwardedMessage = input<string>();
  readonly message = inject(LAZY_COMPONENT_MESSAGE, { optional: true }) ?? 'standalone';
}

@NgModule({ imports: [JssModule.forChild(TestStandaloneLazyJumbotronComponent)] })
class TestLazyNgModule {}

@Component({
  standalone: true,
  imports: JSS_DIRECTIVES,
  template:
    '<sc-placeholder name="main" [rendering]="rendering" [inputs]="inputs"></sc-placeholder>',
})
class TestLazyPlaceholderHostComponent {
  rendering: ComponentRendering = {} as ComponentRendering;
  inputs: { [key: string]: unknown } = {};
}

describe('JSS standalone provider API', () => {
  it('provides the JSS root services with provideJss', () => {
    TestBed.configureTestingModule({ providers: [provideJss()] });

    expect(TestBed.inject(DatePipe)).toBeDefined();
  });

  describe('lazy component loading', () => {
    const lazyComponents: ComponentNameAndModule[] = [
      {
        path: 'StandaloneDirect',
        loadChildren: async () => TestStandaloneLazyJumbotronComponent,
      },
      {
        path: 'StandaloneMap',
        loadChildren: async () => ({ StandaloneMap: TestStandaloneLazyJumbotronComponent }),
      },
      {
        path: 'StandaloneProviders',
        loadChildren: async () =>
          makeEnvironmentProviders([
            { provide: DYNAMIC_COMPONENT, useValue: TestStandaloneLazyJumbotronComponent },
            { provide: LAZY_COMPONENT_MESSAGE, useValue: 'environment provider applied' },
          ]),
      },
      {
        path: 'NgModule',
        loadChildren: async () => TestLazyNgModule,
      },
    ];

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [RouterTestingModule, TestLazyPlaceholderHostComponent],
        providers: [provideJssComponents([], lazyComponents)],
      });
    });

    it('keeps lazy entries for placeholders without registering them as routes', () => {
      const routes = (TestBed.inject(ROUTES) as unknown[][]).flat() as Array<{ path?: string }>;
      expect(TestBed.inject(PLACEHOLDER_LAZY_COMPONENTS)).toBe(lazyComponents);
      expect(routes.some((route) => route?.path === 'StandaloneDirect')).toBeFalse();
    });

    [
      { componentName: 'StandaloneDirect', expectedMessage: 'standalone' },
      { componentName: 'StandaloneMap', expectedMessage: 'standalone' },
      { componentName: 'NgModule', expectedMessage: 'standalone' },
      {
        componentName: 'StandaloneProviders',
        expectedMessage: 'environment provider applied',
      },
    ].forEach(({ componentName, expectedMessage }) => {
      it(`loads ${componentName} into an environment injector`, async () => {
        const fixture = TestBed.createComponent(TestLazyPlaceholderHostComponent);
        fixture.componentInstance.rendering = ({
          componentName: 'Host',
          placeholders: {
            main: [{ componentName }],
          },
        } as unknown) as ComponentRendering;
        fixture.componentInstance.inputs = { forwardedMessage: 'setInput applied' };
        fixture.detectChanges();

        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const lazyComponent = fixture.debugElement.query(
          By.directive(TestStandaloneLazyJumbotronComponent)
        );
        expect(lazyComponent).not.toBeNull();
        expect(lazyComponent.nativeElement.textContent).toContain(expectedMessage);
        expect(lazyComponent.nativeElement.textContent).toContain(componentName);
        expect(lazyComponent.nativeElement.textContent).toContain('setInput applied');
      });
    });
  });
});

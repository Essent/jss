import {
  Component,
  DestroyRef,
  ENVIRONMENT_INITIALIZER,
  inject,
  InjectionToken,
  input,
  makeEnvironmentProviders,
  NgModule,
  Provider,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, ROUTES } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentRendering } from '@sitecore-jss/sitecore-jss/layout';
import { JSS_DIRECTIVES, JssModule, provideJssComponents } from './lib.module';
import { RenderComponentComponent } from './components/render-component.component';
import { JssComponentFactoryService } from './services/jss-component-factory.service';
import {
  ComponentNameAndModule,
  DYNAMIC_COMPONENT,
  PLACEHOLDER_LAZY_COMPONENTS,
} from './services/placeholder.token';

@NgModule({})
class TestLazyNgModule {}

const CHILD_VALUE = new InjectionToken<string>('child component value');

@Component({
  standalone: true,
  template: '{{ childValue }}',
})
class TrackingComponent {
  readonly rendering = input<ComponentRendering>();
  readonly data = input<unknown>();
  readonly childValue = inject(CHILD_VALUE, { optional: true });
}

@Component({
  standalone: true,
  template: '',
})
class ThrowingComponent {
  constructor() {
    throw new Error('component construction failed');
  }
}

@Component({
  standalone: true,
  imports: JSS_DIRECTIVES,
  template: '<sc-placeholder name="main" [rendering]="rendering"></sc-placeholder>',
})
class PlaceholderHostComponent {
  rendering: ComponentRendering = makePlaceholderRendering('Lazy');
}

@Component({
  standalone: true,
  imports: JSS_DIRECTIVES,
  template: `
    <sc-placeholder name="main" [rendering]="rendering">
      <ng-template renderEach let-rendering="rendering">
        <sc-render-component [rendering]="rendering"></sc-render-component>
      </ng-template>
    </sc-placeholder>
  `,
})
class RenderEachHostComponent {
  rendering: ComponentRendering = makePlaceholderRendering('Lazy');
}

/**
 * Creates a layout rendering that contains one child component.
 * @param {string} componentName The name of the child component.
 */
function makePlaceholderRendering(componentName: string): ComponentRendering {
  return {
    componentName: 'Host',
    placeholders: {
      main: [{ componentName }],
    },
  } as ComponentRendering;
}

/**
 * Creates environment providers that report when their injector is destroyed.
 * @param {jasmine.Spy} destroySpy The spy to call during injector destruction.
 * @param {unknown} [dynamicComponent] The optional value for DYNAMIC_COMPONENT.
 */
function makeTrackedProviders(destroySpy: jasmine.Spy, dynamicComponent?: unknown) {
  const providers: Provider[] = [
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(DestroyRef).onDestroy(destroySpy),
    },
    { provide: CHILD_VALUE, useValue: 'from component injector' },
  ];
  if (dynamicComponent !== undefined) {
    providers.push({ provide: DYNAMIC_COMPONENT, useValue: dynamicComponent });
  }
  return makeEnvironmentProviders(providers);
}

/**
 * Creates one lazy component registration for a test.
 * @param {string} path The name used to register the component.
 * @param {ComponentNameAndModule['loadChildren']} loadChildren The loader to call.
 * @param {Partial<ComponentNameAndModule>} [extras] Optional guards and resolvers.
 */
function lazyComponent(
  path: string,
  loadChildren: ComponentNameAndModule['loadChildren'],
  extras: Partial<ComponentNameAndModule> = {}
): ComponentNameAndModule {
  return { path, loadChildren, ...extras };
}

/**
 * Runs change detection until asynchronous component loading completes.
 * @param {ComponentFixture<T>} fixture The fixture to render.
 */
async function renderFixture<T>(fixture: ComponentFixture<T>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('per-render component injector cleanup', () => {
  it('destroys the injector when DYNAMIC_COMPONENT is missing', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy))];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();

    await expectAsync(
      TestBed.inject(JssComponentFactoryService).getComponent({
        componentName: 'Lazy',
      } as ComponentRendering)
    ).toBeRejected();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the injector when the component name is missing from the map', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () =>
        makeTrackedProviders(destroySpy, { Other: TrackingComponent })
      ),
    ];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();

    await expectAsync(
      TestBed.inject(JssComponentFactoryService).getComponent({
        componentName: 'Lazy',
      } as ComponentRendering)
    ).toBeRejected();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the injector when the component map value is not a function', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () =>
        makeTrackedProviders(destroySpy, { Lazy: 'not a component' })
      ),
    ];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();

    await expectAsync(
      TestBed.inject(JssComponentFactoryService).getComponent({
        componentName: 'Lazy',
      } as ComponentRendering)
    ).toBeRejected();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys resolved sibling injectors and preserves the rejection from getComponents', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const originalError = new Error('lazy load failed');
    const lazyComponents = [
      lazyComponent('Good', async () => makeTrackedProviders(destroySpy, TrackingComponent)),
      lazyComponent('Bad', async () => Promise.reject(originalError)),
    ];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();

    let receivedError: unknown;
    try {
      await TestBed.inject(JssComponentFactoryService).getComponents([
        { componentName: 'Good' } as ComponentRendering,
        { componentName: 'Bad' } as ComponentRendering,
      ]);
    } catch (error) {
      receivedError = error;
    }

    expect(receivedError).toBe(originalError);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the injector when the placeholder destroys its component', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent)),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, PlaceholderHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await renderFixture(fixture);

    expect(destroySpy).not.toHaveBeenCalled();
    fixture.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the injector when placeholder component creation throws', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, ThrowingComponent)),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, PlaceholderHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await renderFixture(fixture);

    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('destroys injectors for renderings filtered out by a guard', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent), {
        canActivate: () => false,
      }),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, PlaceholderHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await renderFixture(fixture);

    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('destroys injectors when a guard redirects', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent), {
        canActivate: () => TestBed.inject(Router).parseUrl('/'),
      }),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, PlaceholderHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await renderFixture(fixture);

    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('destroys injectors when data resolution rejects', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent), {
        resolve: { value: { resolve: () => Promise.reject(new Error('resolver failed')) } },
      }),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, PlaceholderHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await renderFixture(fixture);

    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('destroys the unused placeholder injector in renderEach and the rendered injector on teardown', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent)),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, RenderEachHostComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(RenderEachHostComponent);
    await renderFixture(fixture);

    expect(fixture.debugElement.query(By.directive(TrackingComponent))).not.toBeNull();
    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(2);
  });

  it('passes and destroys the injector in sc-render-component', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, TrackingComponent)),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, RenderComponentComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(RenderComponentComponent);
    fixture.componentRef.setInput('rendering', { componentName: 'Lazy' } as ComponentRendering);
    await renderFixture(fixture);

    const component = fixture.debugElement.query(By.directive(TrackingComponent));
    expect(component.componentInstance.childValue).toBe('from component injector');
    expect(destroySpy).not.toHaveBeenCalled();
    fixture.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the injector when sc-render-component creation throws', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const lazyComponents = [
      lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, ThrowingComponent)),
    ];
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, RenderComponentComponent],
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const fixture = TestBed.createComponent(RenderComponentComponent);
    fixture.detectChanges();
    fixture.componentRef.setInput('rendering', { componentName: 'Lazy' } as ComponentRendering);
    const render = ((fixture.componentInstance as unknown) as {
      _render: () => Promise<void>;
    })._render();

    await expectAsync(render).toBeRejected();
    expect(destroySpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});

describe('JSS lazy route registration', () => {
  const routerLazyComponents: ComponentNameAndModule[] = [
    lazyComponent('Standalone', async () => TrackingComponent),
    lazyComponent('Map', async () => ({ Map: TrackingComponent })),
    lazyComponent('Providers', async () => makeEnvironmentProviders([])),
    lazyComponent('NgModule', async () => TestLazyNgModule),
  ];

  it('does not register ROUTES from provideJssComponents', async () => {
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], routerLazyComponents)],
    }).compileComponents();

    expect(TestBed.inject(ROUTES, null)).toBeNull();
    expect(TestBed.inject(PLACEHOLDER_LAZY_COMPONENTS)).toBe(routerLazyComponents);
  });

  it('keeps placeholder entries and adapts router loaders in JssModule.withComponents', async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, JssModule.withComponents([], routerLazyComponents)],
    }).compileComponents();

    expect(TestBed.inject(PLACEHOLDER_LAZY_COMPONENTS)).toBe(routerLazyComponents);

    const routeGroups = TestBed.inject(ROUTES) as unknown[];
    const findRoute = (path: string) => {
      const routeGroup = routeGroups.find(
        (group) =>
          Array.isArray(group) &&
          (group as Array<{ path?: string }>).some((route) => route.path === path)
      ) as Array<{ path: string; loadChildren: () => Promise<unknown> }> | undefined;
      return routeGroup?.find((route) => route.path === path);
    };

    for (const path of ['Standalone', 'Map', 'Providers']) {
      const route = findRoute(path);
      expect(route).toBeDefined();
      expect(await route!.loadChildren()).toEqual([]);
    }

    const moduleRoute = findRoute('NgModule');
    expect(moduleRoute).toBeDefined();
    expect(await moduleRoute!.loadChildren()).toBe(TestLazyNgModule);
  });
});

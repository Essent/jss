import {
  Component,
  DestroyRef,
  ENVIRONMENT_INITIALIZER,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  input,
  makeEnvironmentProviders,
  NgModule,
  Provider,
  Type,
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

/**
 * Holds callbacks that outlive the rendered component, like NgRx effect sources.
 */
@Injectable({ providedIn: 'root' })
class AppLifetimeSources {
  readonly sources: Array<() => string> = [];
}

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
  imports: [JSS_DIRECTIVES],
  template: '<sc-placeholder name="main" [rendering]="rendering"></sc-placeholder>',
})
class PlaceholderHostComponent {
  rendering: ComponentRendering = makePlaceholderRendering('Lazy');
}

@Component({
  standalone: true,
  imports: [JSS_DIRECTIVES],
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
 * Like NgRx provideEffects(), the initializer registers a source in a root service
 * that keeps using the lazy injector.
 * @param {jasmine.Spy} destroySpy The spy to call during injector destruction.
 * @param {unknown} [dynamicComponent] The optional value for DYNAMIC_COMPONENT.
 */
function makeTrackedProviders(destroySpy: jasmine.Spy, dynamicComponent?: unknown) {
  const providers: Provider[] = [
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const injector = inject(Injector);
        inject(DestroyRef).onDestroy(destroySpy);
        inject(AppLifetimeSources).sources.push(() => injector.get(CHILD_VALUE));
      },
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
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges(false);
  await fixture.whenStable();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges(false);
}

/**
 * Checks that every source registered by lazy providers can still use its injector.
 */
function expectAppLifetimeSourcesUsable() {
  const { sources } = TestBed.inject(AppLifetimeSources);
  expect(sources.length).toBeGreaterThan(0);
  sources.forEach((source) => expect(source()).toBe('from component injector'));
}

describe('lazy component injector lifetime', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('creates a new injector for each render, like the NgModule path', async () => {
    const lazyComponents = [
      lazyComponent('Lazy', async () =>
        makeTrackedProviders(jasmine.createSpy('destroy'), TrackingComponent)
      ),
    ];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();
    const factory = TestBed.inject(JssComponentFactoryService);

    const first = await factory.getComponent({ componentName: 'Lazy' } as ComponentRendering);
    const second = await factory.getComponent({ componentName: 'Lazy' } as ComponentRendering);

    expect(first.componentInjector).toBeDefined();
    expect(second.componentInjector).toBeDefined();
    expect(second.componentInjector).not.toBe(first.componentInjector);
  });

  [
    {
      scenario: 'the placeholder destroys its component',
      host: PlaceholderHostComponent as Type<unknown>,
      component: TrackingComponent as Type<unknown>,
      extras: {},
    },
    {
      scenario: 'placeholder component creation throws',
      host: PlaceholderHostComponent,
      component: ThrowingComponent,
      extras: {},
    },
    {
      scenario: 'a guard denies the rendering',
      host: PlaceholderHostComponent,
      component: TrackingComponent,
      extras: { canActivate: () => false },
    },
    {
      scenario: 'a guard redirects',
      host: PlaceholderHostComponent,
      component: TrackingComponent,
      extras: { canActivate: () => TestBed.inject(Router).parseUrl('/') },
    },
    {
      scenario: 'data resolution rejects',
      host: PlaceholderHostComponent,
      component: TrackingComponent,
      extras: {
        resolve: { value: { resolve: () => Promise.reject(new Error('resolver failed')) } },
      },
    },
    {
      scenario: 'renderEach renders the component with sc-render-component',
      host: RenderEachHostComponent,
      component: TrackingComponent,
      extras: {},
    },
  ].forEach(({ scenario, host, component, extras }) => {
    it(`keeps the injector usable when ${scenario}`, async () => {
      const destroySpy = jasmine.createSpy('destroy');
      const lazyComponents = [
        lazyComponent('Lazy', async () => makeTrackedProviders(destroySpy, component), extras),
      ];
      await TestBed.configureTestingModule({
        imports: [RouterTestingModule, host],
        providers: [provideJssComponents([], lazyComponents)],
      }).compileComponents();
      const fixture = TestBed.createComponent(host);
      await renderFixture(fixture);

      fixture.destroy();

      expect(destroySpy).not.toHaveBeenCalled();
      expectAppLifetimeSourcesUsable();
    });
  });

  it('passes the injector to sc-render-component and keeps it after teardown', async () => {
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
    fixture.destroy();
    expect(destroySpy).not.toHaveBeenCalled();
    expectAppLifetimeSourcesUsable();
  });

  it('keeps resolved sibling injectors and preserves the rejection from getComponents', async () => {
    const destroySpy = jasmine.createSpy('destroy');
    const originalError = new Error('lazy load failed');
    const lazyComponents = [
      lazyComponent('Good', async () => makeTrackedProviders(destroySpy, TrackingComponent)),
      lazyComponent('Bad', async () => Promise.reject(originalError)),
    ];
    await TestBed.configureTestingModule({
      providers: [provideJssComponents([], lazyComponents)],
    }).compileComponents();

    await expectAsync(
      TestBed.inject(JssComponentFactoryService).getComponents([
        { componentName: 'Good' } as ComponentRendering,
        { componentName: 'Bad' } as ComponentRendering,
      ])
    ).toBeRejectedWith(originalError);
    expect(destroySpy).not.toHaveBeenCalled();
  });
});

describe('lazy component injector errors', () => {
  afterEach(() => TestBed.resetTestingModule());

  [
    {
      scenario: 'DYNAMIC_COMPONENT is missing',
      dynamicComponent: undefined,
      parentProviders: [] as Provider[],
      error: /Lazy providers for component "Lazy" do not provide DYNAMIC_COMPONENT/,
    },
    {
      scenario: 'only a parent injector provides DYNAMIC_COMPONENT',
      dynamicComponent: undefined,
      parentProviders: [{ provide: DYNAMIC_COMPONENT, useValue: TrackingComponent }],
      error: /Lazy providers for component "Lazy" do not provide DYNAMIC_COMPONENT/,
    },
    {
      scenario: 'the component map does not contain the component name',
      dynamicComponent: { Other: TrackingComponent },
      parentProviders: [],
      error: /component map does not contain "Lazy"/,
    },
    {
      scenario: 'the component map value is not a function',
      dynamicComponent: { Lazy: 'not a component' },
      parentProviders: [],
      error: /component map entry for "Lazy" is not a component type/,
    },
  ].forEach(({ scenario, dynamicComponent, parentProviders, error }) => {
    it(`rejects with a JSS error when ${scenario}`, async () => {
      const lazyComponents = [
        lazyComponent('Lazy', async () =>
          makeTrackedProviders(jasmine.createSpy('destroy'), dynamicComponent)
        ),
      ];
      await TestBed.configureTestingModule({
        providers: [provideJssComponents([], lazyComponents), ...parentProviders],
      }).compileComponents();

      await expectAsync(
        TestBed.inject(JssComponentFactoryService).getComponent({
          componentName: 'Lazy',
        } as ComponentRendering)
      ).toBeRejectedWithError(error);
    });
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

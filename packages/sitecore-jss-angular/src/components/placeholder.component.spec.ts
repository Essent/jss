import { Location, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DebugElement,
  inject,
  Injectable,
  input,
  Input,
  TemplateRef,
  output,
  viewChild,
} from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RedirectCommand, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ComponentRendering } from '@sitecore-jss/sitecore-jss/layout';
import { JssModule } from '../lib.module';
import { JssStateService } from '../services/jss-state.service';
import { JssCanActivate, JssCanActivateFn, JssResolve } from '../services/placeholder.token';
import { convertedData as eeData } from '../test-data/ee-data';
import * as lazyLoadingData from '../test-data/lazy-loading/data';
import { LazyComponent } from '../test-data/lazy-loading/lazy-component.component';
import * as metadataData from '../test-data/metadata-data';
import {
  convertedDevData as nonEeDevData,
  convertedLayoutServiceData as nonEeLsData,
  sxaRenderingData,
  sxaRenderingDoubleDigitDynamicPlaceholderData,
  sxaRenderingDynamicPlaceholderData,
} from '../test-data/non-ee-data';
import { cleanHtml } from '../test-utils';
import { MissingComponentComponent } from './missing-component.component';
import { PlaceholderComponent } from './placeholder.component';
import { TextDirective } from './text.directive';
import { JSS_DIRECTIVES } from '../lib.module';

/**
 * Waits until lazily loaded placeholder components finish rendering.
 * @param {ComponentFixture<T>} fixture The fixture whose placeholder rendering to await.
 */
async function waitForAsyncRender<T>(fixture: ComponentFixture<T>) {
  let previousPlaceholderCount = -1;
  let stablePasses = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.changeDetectorRef.detectChanges();

    const placeholders = fixture.debugElement.queryAll(By.directive(PlaceholderComponent));
    const allPlaceholdersLoaded = placeholders.every(
      (placeholder) => !placeholder.componentInstance.isLoading
    );
    if (allPlaceholdersLoaded && placeholders.length === previousPlaceholderCount) {
      stablePasses++;
      if (stablePasses === 2) return;
    } else {
      stablePasses = 0;
    }
    previousPlaceholderCount = placeholders.length;
  }
}

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-placeholder',
  template: `
    <sc-placeholder [name]="name()" [rendering]="rendering()">
      <img *scPlaceholderLoading src="loading.gif" />
    </sc-placeholder>
  `,
})
class TestPlaceholderComponent {
  readonly rendering = input<ComponentRendering | undefined>(undefined);
  readonly name = input<string | undefined>(undefined);
  readonly data = input<unknown>();
}

@Component({
  selector: 'test-download-callout',
  standalone: true,
  template: `
    {{ rendering()?.fields?.linkText?.value }}
  `,
})
class TestDownloadCalloutComponent {
  rendering = input.required<ComponentRendering>();
  data = input();
}

@Component({
  standalone: true,
  imports: [PlaceholderComponent],
  selector: 'test-home',
  styles: ['sc-placeholder[name="page-content"] { background-color: red }'],
  template: `
    <sc-placeholder name="page-header" [rendering]="rendering()"></sc-placeholder>
    <sc-placeholder name="page-content" [rendering]="rendering()"></sc-placeholder>
  `,
})
class TestHomeComponent {
  readonly rendering = input<ComponentRendering>();
  readonly data = input<unknown>();
}

@Component({
  standalone: true,
  selector: 'test-jumbotron',
  template: '',
})
class TestJumbotronComponent {
  readonly rendering = input<ComponentRendering>();
  readonly data = input<unknown>();
}

describe('<sc-placeholder />', () => {
  let fixture: ComponentFixture<TestPlaceholderComponent>;
  let de: DebugElement;
  let comp: TestPlaceholderComponent;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          TestDownloadCalloutComponent,
          TestHomeComponent,
          TestJumbotronComponent,
          RouterTestingModule,
          JssModule.withComponents(
            [
              { name: 'DownloadCallout', type: TestDownloadCalloutComponent },
              { name: 'Home', type: TestHomeComponent },
              { name: 'Jumbotron', type: TestJumbotronComponent },
            ],
            [
              {
                path: 'LazyComponent',
                loadChildren: () =>
                  import('../test-data/lazy-loading/lazy-loading.module').then(
                    (m) => m.TestLazyLoadingModule
                  ),
              },
            ]
          ),
          TestPlaceholderComponent,
        ],
        providers: [JssStateService],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(TestPlaceholderComponent);
    de = fixture.debugElement;

    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(comp).toBeDefined();
  });

  it('should show a loader while no rendering is defined yet', () => {
    const img = de.nativeElement.getElementsByTagName('img')[0];
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('loading.gif');
  });

  const testData = [
    { label: 'Dev data', data: nonEeDevData },
    { label: 'LayoutService data - EE off', data: nonEeLsData },
    { label: 'LayoutService data - EE on', data: eeData },
  ];

  testData.forEach((dataSet) => {
    describe(`with ${dataSet.label}`, () => {
      it(
        'should render a placeholder with given key',
        waitForAsync(async () => {
          const component = (dataSet.data.sitecore.route.placeholders
            .main as ComponentRendering[]).find((c) => c.componentName);
          const phKey = 'page-content';
          fixture.componentRef.setInput('name', phKey);
          fixture.componentRef.setInput('rendering', component!);
          fixture.detectChanges();

          await waitForAsyncRender(fixture);

          const downloadCallout = de.query(By.directive(TestDownloadCalloutComponent));
          expect(downloadCallout).not.toBeNull();
          expect(downloadCallout.nativeElement.innerHTML).toContain('Download');

          const lazyComponent = de.query(By.directive(LazyComponent));
          expect(lazyComponent).not.toBeNull();
          expect(lazyComponent.nativeElement.innerHTML).toContain('Push');

          const img = de.nativeElement.getElementsByTagName('img')[0];
          expect(img).not.toBeDefined();
        })
      );

      it(
        'should render nested placeholders',
        waitForAsync(async () => {
          const component = dataSet.data.sitecore.route;
          const phKey = 'main';
          fixture.componentRef.setInput('name', phKey);
          fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
          fixture.detectChanges();

          // because nested placeholders result in additional async loading _after_ whenStable,
          // we have to check for stability AGAIN internally
          await waitForAsyncRender(fixture);

          await waitForAsyncRender(fixture);

          const downloadCallout = de.query(By.directive(TestDownloadCalloutComponent));
          expect(downloadCallout).not.toBeNull();
          expect(downloadCallout.nativeElement.innerHTML).toContain('Download');
        })
      );
    });
  });

  it(
    'should populate the "key" attribute of placeholder chrome',
    waitForAsync(async () => {
      const component = eeData.sitecore.route;
      const phKey = 'main';

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      const eeChrome = de.nativeElement.querySelector(
        `[chrometype="placeholder"][kind="open"][id="${phKey}"]`
      );
      expect(eeChrome).not.toBeNull();

      const keyAttribute = eeChrome.getAttribute('key');
      expect(keyAttribute).toBeDefined();
      expect(keyAttribute).toBe(phKey);
    })
  );

  it(
    'should copy parent style attribute',
    waitForAsync(async () => {
      const component = nonEeDevData.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      // let's grab the style name from the parent
      let parentKey = '';
      const homeComp = de.query(By.directive(TestHomeComponent));
      const homeAttributes = homeComp.nativeElement.attributes;
      if (homeAttributes.length) {
        const parentAttribute = homeComp.nativeElement.attributes.item(0).name;
        parentKey = parentAttribute.replace('_nghost-', '');
      }

      await waitForAsyncRender(fixture);

      const downloadCallout = de.query(By.directive(TestDownloadCalloutComponent));
      expect(downloadCallout.nativeElement.attributes.item(0).name).toEqual(
        `_ngcontent-${parentKey}`
      );
    })
  );

  it(
    'should skip rendering unknown components',
    waitForAsync(async () => {
      const phKey = 'main';
      const route = {
        placeholders: {
          main: [
            {
              componentName: 'Home',
            },
            {
              componentName: 'whatisthis',
            },
          ],
        },
      };

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (route as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const homeDiv = de.query(By.directive(TestHomeComponent));
      expect(homeDiv).not.toBeNull();
    })
  );

  it(
    'should skip rendering components with no name',
    waitForAsync(async () => {
      const phKey = 'main';
      const route = {
        placeholders: {
          main: [
            {
              componentName: 'Home',
            },
            {
              componentName: null,
            },
          ],
        },
      };

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (route as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const homeDiv = de.query(By.directive(TestHomeComponent));
      expect(homeDiv).not.toBeNull();
    })
  );

  it(
    'should render null for unknown placeholder',
    waitForAsync(async () => {
      const phKey = 'unknown';
      const route = {
        placeholders: {
          main: [
            {
              componentName: 'Home',
            },
          ],
        },
      };

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (route as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      const element = de.query(By.css('sc-placeholder')).nativeElement;
      expect(element.children.length).toBe(0);
    })
  );
});

@Component({
  standalone: true,
  imports: [PlaceholderComponent],
  selector: 'test-parent',
  template: `
    <sc-placeholder
      [name]="name()"
      [rendering]="rendering()"
      [inputs]="inputs"
      [outputs]="outputs"
    ></sc-placeholder>
    {{ clickMessage }}
  `,
})
class TestParentComponent {
  readonly rendering = input<ComponentRendering | undefined>(undefined);
  readonly data = input<unknown>();
  readonly name = input<string | undefined>(undefined);
  clickMessage = '';
  public inputs = {
    childMessage: '',
    childNumber: () => 40 + 2,
  };
  public outputs = {
    childEvent: (childEvent: string) => {
      this.clickMessage = childEvent;
    },
  };
  @Input() set childMessage(message: string) {
    this.inputs.childMessage = message;
  }
}

@Component({
  standalone: true,
  selector: 'test-child',
  template: `
    {{ childMessage() }}
    {{ childNumber()() }}
    <button (click)="triggerEvent()">Button</button>
  `,
})
class TestChildComponent {
  readonly rendering = input<ComponentRendering>();
  readonly data = input<unknown>();
  readonly childMessage = input<string>();
  readonly childNumber = input<number>();
  readonly childEvent = output<string>();

  triggerEvent() {
    this.childEvent.emit('dolor');
  }
}

describe('<sc-placeholder /> with input/output binding', () => {
  let fixture: ComponentFixture<TestParentComponent>;
  let de: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TestParentComponent,
        TestChildComponent,
        RouterTestingModule,
        JssModule.withComponents([
          { name: 'Parent', type: TestParentComponent },
          { name: 'Child', type: TestChildComponent },
        ]),
      ],
      providers: [JssStateService],
    });

    fixture = TestBed.createComponent(TestParentComponent);
    de = fixture.debugElement;

    fixture.detectChanges();
  });

  it(
    'should bind inputs to children',
    waitForAsync(async () => {
      const expectedMessage = 'lorem';
      const functionResult = 42;
      const changedMessage = 'ipsum';

      fixture.componentRef.setInput('rendering', ({
        placeholders: {
          children: [
            {
              componentName: 'Child',
            },
          ],
        },
      } as unknown) as ComponentRendering);
      fixture.componentRef.setInput('name', 'children');
      fixture.componentRef.setInput('childMessage', expectedMessage);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      const childComponent = de.query(By.directive(TestChildComponent));
      expect(childComponent.nativeElement.innerHTML).toContain(expectedMessage);
      expect(childComponent.nativeElement.innerHTML).toContain(functionResult);
      fixture.componentRef.setInput('childMessage', changedMessage);
      fixture.detectChanges();
      expect(childComponent.nativeElement.innerHTML).toContain(changedMessage);
    })
  );

  it(
    'should bind inputs to multiple',
    waitForAsync(async () => {
      const expectedMessage = 'lorem';

      fixture.componentRef.setInput('rendering', ({
        placeholders: {
          children: [
            {
              componentName: 'Child',
            },
            {
              componentName: 'Child',
            },
            {
              componentName: 'Child',
            },
          ],
        },
      } as unknown) as ComponentRendering);
      fixture.componentRef.setInput('name', 'children');
      fixture.componentRef.setInput('childMessage', expectedMessage);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      const childComponents = de.queryAll(By.directive(TestChildComponent));
      expect(childComponents.length).toBe(3);
      childComponents.forEach((childComponent) => {
        expect(childComponent.nativeElement.innerHTML).toContain(expectedMessage);
      });
    })
  );

  it(
    'should bind outputs to children',
    waitForAsync(async () => {
      fixture.componentRef.setInput('rendering', ({
        placeholders: {
          children: [
            {
              componentName: 'Child',
            },
          ],
        },
      } as unknown) as ComponentRendering);
      fixture.componentRef.setInput('name', 'children');
      fixture.detectChanges();
      await waitForAsyncRender(fixture);

      const button = de.query(By.css('button'));
      button.nativeElement.click();
      fixture.detectChanges();

      expect(de.nativeElement.innerHTML).toContain('dolor');
    })
  );
});

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'test-lazy-placeholder',
  template: `
    <sc-placeholder
      name="main"
      [rendering]="rendering()"
      (loaded)="loaded = $event"
      (failed)="failed = $event"
    >
      <img *scPlaceholderLoading src="loading.gif"
    /></sc-placeholder>
  `,
})
class TestLazyPlaceholderComponent {
  readonly rendering = input<ComponentRendering | undefined>(undefined);
  loaded: string | undefined;
  failed: Error | undefined;
}

@Injectable()
class MockUrlTreeGuard implements JssCanActivate {
  private readonly router = inject(Router);

  canActivate() {
    return this.router.parseUrl('/404');
  }
}

@Injectable()
class MockRedirectCommandGuard implements JssCanActivate {
  private readonly router = inject(Router);

  canActivate() {
    return new RedirectCommand(this.router.parseUrl('/404'));
  }
}

@Component({
  imports: [JSS_DIRECTIVES],
  standalone: true,
  selector: 'not-found',
  template: `
    404
  `,
})
class NotFoundComponent {}

@Injectable()
class MockUnexpectedErrorGuard implements JssCanActivate {
  canActivate(): string {
    throw Error('something broke');
  }
}

@Component({
  selector: 'test-jumbotron',
  template: '<h1>Our best offer to date</h1>',
})
export class TestLazyJumbotronComponent {}

describe('<sc-placeholder /> with lazy loaded modules', () => {
  let fixture: ComponentFixture<TestLazyPlaceholderComponent>;
  let de: DebugElement;
  let comp: TestLazyPlaceholderComponent;

  const loadChildrenFunc = () =>
    import('../test-data/lazy-loading/lazy-loading.module').then(
      (module) => module.TestLazyLoadingModule
    );

  const createFunctionGuard = (canActivate: ReturnType<JssCanActivateFn>): JssCanActivateFn => () =>
    canActivate;

  const mockSyncResolver: JssResolve<string> = {
    resolve() {
      return 'Sync';
    },
  };

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          RouterTestingModule.withRoutes([{ path: '404', component: NotFoundComponent }]),
          JssModule.withComponents(
            [],
            [
              {
                path: 'Jumbotron',
                loadChildren: loadChildrenFunc,
              },
              {
                path: 'JumbotronResolve',
                loadChildren: loadChildrenFunc,
                resolve: { sync: mockSyncResolver },
              },
              {
                path: 'JumbotronCanActivate',
                loadChildren: loadChildrenFunc,
                canActivate: [createFunctionGuard(true)],
              },
              {
                path: 'JumbotronCanActivateUrlTree',
                loadChildren: loadChildrenFunc,
                canActivate: [MockUrlTreeGuard],
              },
              {
                path: 'JumbotronCanActivateRedirectCommand',
                loadChildren: loadChildrenFunc,
                canActivate: [MockRedirectCommandGuard],
              },
              {
                path: 'JumbotronCanActivateUrlString',
                loadChildren: loadChildrenFunc,
                canActivate: [createFunctionGuard('/404')],
              },
              {
                path: 'JumbotronCanActivateUnknown',
                loadChildren: loadChildrenFunc,
                canActivate: [MockUnexpectedErrorGuard],
              },
            ]
          ),
          TestLazyPlaceholderComponent,
          NotFoundComponent,
        ],
        providers: [MockUrlTreeGuard, MockRedirectCommandGuard, MockUnexpectedErrorGuard],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(TestLazyPlaceholderComponent);
    de = fixture.debugElement;

    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(comp).toBeDefined();
  });

  it('should show a loader while no rendering is defined yet', () => {
    const img = de.nativeElement.getElementsByTagName('img')[0];
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('loading.gif');
  });

  lazyLoadingData.testDataSuccess.forEach((dataSet) => {
    describe(dataSet.label, () => {
      it(
        'should render a Jumbotron in placeholder',
        waitForAsync(async () => {
          fixture.componentRef.setInput('rendering', dataSet.data);

          await waitForAsyncRender(fixture);

          await waitForAsyncRender(fixture);

          const jumbotron = de.query(By.directive(LazyComponent));
          expect(jumbotron).not.toBeNull();
          expect(jumbotron.nativeElement.innerHTML).toContain('Hello world');

          const img = de.nativeElement.getElementsByTagName('img')[0];
          expect(img).not.toBeDefined();
        })
      );
    });
  });

  lazyLoadingData.testDataNavigation.forEach((dataSet) => {
    describe(dataSet.label, () => {
      it(
        'should navigate to url',
        waitForAsync(async () => {
          fixture.componentRef.setInput('rendering', dataSet.data);

          await waitForAsyncRender(fixture);

          await waitForAsyncRender(fixture);

          const location = TestBed.inject(Location);
          expect(location.path()).toBe('/404');
        })
      );
    });
  });
  lazyLoadingData.testDataError.forEach((dataSet) => {
    describe(dataSet.label, () => {
      it(
        'should emit failure',
        waitForAsync(async () => {
          fixture.componentRef.setInput('rendering', dataSet.data);

          await waitForAsyncRender(fixture);

          await waitForAsyncRender(fixture);

          expect(comp.failed).toEqual(new Error('something broke'));
        })
      );
    });
  });
});

@Component({
  standalone: true,
  imports: [NgTemplateOutlet, TextDirective],
  selector: 'test-rich-text',
  template: `
    <ng-template #default>
      <span class="default">Rich text</span>
    </ng-template>

    <ng-template #withTitle>
      <div class="title" *scText="rendering().fields.Title"></div>
      <div class="text" *scText="rendering().fields.Text"></div>
    </ng-template>

    <div class="rendering-variant {{ rendering().params.styles }}">
      <ng-container [ngTemplateOutlet]="variant"></ng-container>
    </div>
  `,
})
class TestRichTextComponent {
  readonly rendering = input.required<ComponentRendering>();
  readonly data = input<unknown>();
  readonly defaultVariant = viewChild<TemplateRef<any>>('default');
  readonly withTitleVariant = viewChild<TemplateRef<any>>('withTitle');
  public get variant(): TemplateRef<any> | undefined {
    return this.rendering().params?.FieldNames === 'WithTitle'
      ? this.withTitleVariant()
      : this.defaultVariant();
  }
}

describe('SXA components', () => {
  let fixture: ComponentFixture<TestPlaceholderComponent>;
  let de: DebugElement;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          TestRichTextComponent,
          RouterTestingModule,
          JssModule.withComponents([{ name: 'RichText', type: TestRichTextComponent }]),
          TestPlaceholderComponent,
        ],
        providers: [JssStateService],
      });

      fixture = TestBed.createComponent(TestPlaceholderComponent);
      de = fixture.debugElement;

      fixture.detectChanges();
    })
  );

  it(
    'should render',
    waitForAsync(async () => {
      const component = sxaRenderingData.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const richText = de.query(By.directive(TestRichTextComponent));
      expect(richText).not.toBeNull();
      expect(richText.nativeElement.innerHTML).toContain('rendering-variant');

      const container = de.query(By.css('.rendering-variant'));
      expect(container).not.toBeNull();
      expect(container.attributes.class).toEqual(
        'col-9|col-sm-10|col-md-12|col-lg-6|col-xl-7|col-xxl-8 rendering-variant test-css-class-x'
      );

      const title = de.query(By.css('.title'));
      expect(title).not.toBeNull();
      expect(title.nativeElement.innerHTML).toEqual('Rich Text Rendering Variant');

      const text = de.query(By.css('.text'));
      expect(text).not.toBeNull();
      expect(text.nativeElement.innerHTML).toEqual('Test RichText');
    })
  );

  it(
    'should render another rendering variant',
    waitForAsync(async () => {
      const component = sxaRenderingData.sitecore.route;
      const phKey = 'main-second';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const richText = de.query(By.directive(TestRichTextComponent));
      expect(richText).not.toBeNull();
      expect(richText.nativeElement.innerHTML).toContain('rendering-variant');

      const container = de.query(By.css('.rendering-variant'));
      expect(container).not.toBeNull();
      expect(container.attributes.class).toEqual(
        'col-9|col-sm-10|col-md-12|col-lg-6|col-xl-7|col-xxl-8 rendering-variant test-css-class-y'
      );

      const span = de.query(By.css('.default'));
      expect(span).not.toBeNull();
      expect(span.nativeElement.innerHTML).toEqual('Rich text');
    })
  );

  it(
    'should render with container-{*} type dynamic placeholder',
    waitForAsync(async () => {
      const component = sxaRenderingDynamicPlaceholderData.sitecore.route;
      const phKey = 'container-1';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const richText = de.query(By.directive(TestRichTextComponent));
      expect(richText).not.toBeNull();
      expect(richText.nativeElement.innerHTML).toContain('rendering-variant');
    })
  );

  it(
    'should render with dynamic-1-{*} type dynamic placeholder',
    waitForAsync(async () => {
      const component = sxaRenderingDoubleDigitDynamicPlaceholderData.sitecore.route;
      const phKey = 'dynamic-1-{*}';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const richText = de.query(By.directive(TestRichTextComponent));
      expect(richText).not.toBeNull();
      expect(richText.nativeElement.innerHTML).toContain('rendering-variant');
    })
  );
});

describe('Placeholder Metadata:', () => {
  const {
    layoutData,
    layoutDataWithEmptyPlaceholder,
    layoutDataWithUnknownComponent,
  } = metadataData;

  @Component({
    standalone: true,
    imports: [PlaceholderComponent],
    selector: 'test-nest',
    template: `
      <div class="nested-test-wrapper">
        <sc-placeholder name="logo" [rendering]="nestedRendering"></sc-placeholder>
      </div>
    `,
  })
  class TestNestingComponent {
    readonly rendering = input<ComponentRendering>();
    readonly data = input<unknown>();
    nestedRendering: ComponentRendering = layoutData.sitecore.route.placeholders.main[0];
  }

  @Component({
    standalone: true,
    selector: 'logo',
    template: `
      <div class="Logo-deep"></div>
    `,
  })
  class LogoComponent {
    readonly rendering = input<ComponentRendering>();
    readonly data = input<unknown>();
  }

  let fixture: ComponentFixture<TestPlaceholderComponent>;
  let de: DebugElement;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          TestNestingComponent,
          LogoComponent,
          RouterTestingModule,
          JssModule.withComponents([
            { name: 'Home', type: TestNestingComponent },
            { name: 'Logo', type: LogoComponent },
          ]),
          TestPlaceholderComponent,
        ],
        providers: [],
      }).compileComponents();

      fixture = TestBed.createComponent(TestPlaceholderComponent);
      de = fixture.debugElement;

      const jssContext = de.injector.get(JssStateService);
      jssContext.setState(layoutData);

      fixture.detectChanges();
    })
  );

  it(
    'should render code blocks around nested placeholder components with DEFAULT_PLACEHOLDER_UID',
    waitForAsync(async () => {
      const component = layoutData.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);

      fixture.detectChanges();
      await waitForAsyncRender(fixture);

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const renderedHTML = de.nativeElement.innerHTML;

      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="main_00000000-0000-0000-0000-000000000000"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<test-nest>',
        '<div class="nested-test-wrapper">',
        '<sc-placeholder name="logo">',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="logo_nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="deep123"></code>',
        '<logo>',
        '<div class="Logo-deep"></div>',
        '</logo>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
        '</div>',
        '</test-nest>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    })
  );

  it(
    'should render code blocks around nested placeholder components with provided placeholder ID',
    waitForAsync(async () => {
      const component = layoutData.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', {
        uid: '1234',
        ...((component as unknown) as ComponentRendering),
      });

      fixture.detectChanges();
      await waitForAsyncRender(fixture);

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const renderedHTML = de.nativeElement.innerHTML;

      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="main_1234"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<test-nest>',
        '<div class="nested-test-wrapper">',
        '<sc-placeholder name="logo">',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="logo_nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="deep123"></code>',
        '<logo>',
        '<div class="Logo-deep"></div>',
        '</logo>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
        '</div>',
        '</test-nest>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    })
  );

  it('should render code blocks even if placeholder is empty', () =>
    waitForAsync(async () => {
      const component = layoutDataWithEmptyPlaceholder.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);

      fixture.detectChanges();
      await waitForAsyncRender(fixture);

      const elements = de.queryAll(By.css('code'));

      expect(de.query(By.css('div.sc-jss-empty-placeholder'))).toBeDefined();

      expect(elements.length).toBe(4);
      const renderedHTML = de.nativeElement.innerHTML;

      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="main_00000000-0000-0000-0000-000000000000"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    }));

  it(
    'should render missing component with code blocks if component is not registered',
    waitForAsync(async () => {
      const component = layoutDataWithUnknownComponent.sitecore.route;
      const phKey = 'main';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);

      fixture.detectChanges();
      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);
      const elements = de.queryAll(By.css('code'));

      expect(elements.length).toBe(4);

      const renderedHTML = de.nativeElement.innerHTML;
      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="main_00000000-0000-0000-0000-000000000000"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<sc-missing-component><div style="background: darkorange; outline: 5px solid orange; padding: 10px; color: white; max-width: 500px;"><h2>Unknown</h2><p>JSS component is missing Angular component implementation.</p></div></sc-missing-component>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
      expect(de.query(By.directive(MissingComponentComponent))).toBeDefined();
    })
  );
});

describe('Placeholder Metadata: dynamic placeholder:', () => {
  const { layoutData, layoutDataForNestedDynamicPlaceholder } = metadataData;

  @Component({
    standalone: true,
    imports: [PlaceholderComponent],
    selector: 'test-nest',
    template: `
      <div class="nested-test-wrapper">
        <sc-placeholder name="logo" [rendering]="nestedRendering"></sc-placeholder>
      </div>
    `,
  })
  class TestNestingComponent {
    readonly rendering = input<ComponentRendering>();
    readonly data = input<unknown>();
    nestedRendering: ComponentRendering = layoutData.sitecore.route.placeholders.main[0];
  }

  @Component({
    standalone: true,
    selector: 'logo',
    template: `
      <div class="Logo-deep"></div>
    `,
  })
  class LogoComponent {
    readonly rendering = input<ComponentRendering>();
    readonly data = input<unknown>();
  }

  let fixture: ComponentFixture<TestPlaceholderComponent>;
  let de: DebugElement;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          TestNestingComponent,
          LogoComponent,
          RouterTestingModule,
          JssModule.withComponents([
            { name: 'Home', type: TestNestingComponent },
            { name: 'Logo', type: LogoComponent },
          ]),
          TestPlaceholderComponent,
        ],
        providers: [],
      }).compileComponents();

      fixture = TestBed.createComponent(TestPlaceholderComponent);
      de = fixture.debugElement;
      const jssContext = de.injector.get(JssStateService);
      jssContext.setState(layoutData);

      fixture.detectChanges();
    })
  );

  it(
    'should render code blocks with DEFAULT_PLACEHOLDER_UID value when dynamic placeholder is used and uid is not present',
    waitForAsync(async () => {
      const layoutData = layoutDataForNestedDynamicPlaceholder('container-{*}');
      const component = layoutData.sitecore.route;
      const phKey = 'container-1';

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);
      fixture.detectChanges();
      // double await is needed for nested/deep placeholders to render all components. Just Angular things?
      await waitForAsyncRender(fixture);

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);

      const renderedHTML = de.nativeElement.innerHTML;

      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="container-{*}_00000000-0000-0000-0000-000000000000"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<test-nest>',
        '<div class="nested-test-wrapper">',
        '<sc-placeholder name="logo">',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="logo_nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="deep123"></code>',
        '<logo>',
        '<div class="Logo-deep"></div>',
        '</logo>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
        '</div>',
        '</test-nest>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    })
  );

  it(
    'should render code blocks with provided uid value when dynamic placeholder is used',
    waitForAsync(async () => {
      const layoutData = layoutDataForNestedDynamicPlaceholder('container-{*}');
      const component = layoutData.sitecore.route;
      const phKey = 'container-1';

      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', {
        uid: '1234',
        ...((component as unknown) as ComponentRendering),
      });
      fixture.detectChanges();
      // double await is needed for nested/deep placeholders to render all components. Just Angular things?
      await waitForAsyncRender(fixture);

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);
      const elements = de.queryAll(By.css('code'));

      expect(elements.length).toBe(8);

      const renderedHTML = de.nativeElement.innerHTML;
      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="container-{*}_1234"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<test-nest>',
        '<div class="nested-test-wrapper">',
        '<sc-placeholder name="logo">',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="logo_nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="deep123"></code>',
        '<logo>',
        '<div class="Logo-deep"></div>',
        '</logo>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
        '</div>',
        '</test-nest>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    })
  );

  it(
    'should render code blocks double digit dynamic placeholder',
    waitForAsync(async () => {
      const layoutData = layoutDataForNestedDynamicPlaceholder('container-1-{*}');
      const component = layoutData.sitecore.route;
      const phKey = 'container-1-2';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);

      fixture.detectChanges();
      // double await is needed for nested/deep placeholders to render all components
      await waitForAsyncRender(fixture);

      await waitForAsyncRender(fixture);

      expect(de.children.length).toBe(1);
      const elements = de.queryAll(By.css('code'));

      expect(elements.length).toBe(8);
      const renderedHTML = de.nativeElement.innerHTML;
      const cleanedRenderedHTML = cleanHtml(renderedHTML);

      const expectedHTML = [
        '<sc-placeholder>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="container-1-{*}_00000000-0000-0000-0000-000000000000"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="nested123"></code>',
        '<test-nest>',
        '<div class="nested-test-wrapper">',
        '<sc-placeholder name="logo">',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="placeholder" id="logo_nested123"></code>',
        '<code type="text/sitecore" class="scpm" kind="open" chrometype="rendering" id="deep123"></code>',
        '<logo>',
        '<div class="Logo-deep"></div>',
        '</logo>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
        '</div>',
        '</test-nest>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="rendering"></code>',
        '<code type="text/sitecore" class="scpm" kind="close" chrometype="placeholder"></code>',
        '</sc-placeholder>',
      ].join('');

      expect(cleanedRenderedHTML).toEqual(expectedHTML);
    })
  );

  it(
    'should retain correct name of dynamic placeholder',
    waitForAsync(async () => {
      const layoutData = layoutDataForNestedDynamicPlaceholder('container-{*}');
      const component = layoutData.sitecore.route;
      const phKey = 'container-2';
      fixture.componentRef.setInput('name', phKey);
      fixture.componentRef.setInput('rendering', (component as unknown) as ComponentRendering);

      fixture.detectChanges();
      await waitForAsyncRender(fixture);
      const placeholder = de.query(By.css('sc-placeholder')).componentInstance;
      expect(Object.keys(placeholder?.rendering()?.placeholders || [])).toEqual(['container-{*}']);
    })
  );
});

/* eslint-disable @angular-eslint/no-conflicting-lifecycle */
import { NgTemplateOutlet, isPlatformServer } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ComponentRef,
  DoCheck,
  ElementRef,
  Input,
  KeyValueDiffer,
  KeyValueDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  Type,
  ViewContainerRef,
  contentChild,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Data, RedirectCommand, Router, UrlTree } from '@angular/router';
import { constants } from '@sitecore-jss/sitecore-jss';
import { DEFAULT_PLACEHOLDER_UID, MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import {
  ComponentFields,
  ComponentRendering,
  EditMode,
  HtmlElementRendering,
  getDynamicPlaceholderPattern,
  isDynamicPlaceholder,
} from '@sitecore-jss/sitecore-jss/layout';
import { Observable } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { JssCanActivateRedirectError } from '../services/jss-can-activate-error';
import {
  ComponentFactoryResult,
  JssComponentFactoryService,
} from '../services/jss-component-factory.service';
import { JssStateService } from '../services/jss-state.service';
import {
  DATA_RESOLVER,
  DataResolver,
  GUARD_RESOLVER,
  GuardResolver,
  PLACEHOLDER_HIDDEN_RENDERING_COMPONENT,
  PLACEHOLDER_MISSING_COMPONENT_COMPONENT,
} from '../services/placeholder.token';
import { PlaceholderLoadingDirective } from './placeholder-loading.directive';
import { RenderEachDirective } from './render-each.directive';
import { RenderEmptyDirective } from './render-empty.directive';
import { isRawRendering } from './rendering';

export interface FactoryWithData {
  factory: ComponentFactoryResult;
  data?: Data;
}

@Component({
  selector: 'sc-placeholder,[sc-placeholder]',
  template: `
    @if (isLoading) {
    <ng-template [ngTemplateOutlet]="placeholderLoading()?.templateRef"></ng-template>
    }
    <ng-template
      #metadataCodeBlock
      let-kind="kind"
      let-type="chromeType"
      let-renderingId="renderingId"
    >
      <code
        [attr.kind]="kind"
        type="text/sitecore"
        [attr.chrometype]="type"
        class="scpm"
        [attr.id]="getCodeBlockId(kind, renderingId)"
      ></code
    ></ng-template>

    @if(metadataMode){
    <ng-container
      *ngTemplateOutlet="metadataCodeBlock; context: { kind: 'open', chromeType: 'placeholder' }"
    >
    </ng-container>
    }

    <ng-template #view></ng-template>

    @if(metadataMode){
    <ng-container
      *ngTemplateOutlet="metadataCodeBlock; context: { kind: 'close', chromeType: 'placeholder' }"
    ></ng-container>
    }
  `,
  imports: [NgTemplateOutlet],
})
export class PlaceholderComponent implements OnInit, OnChanges, DoCheck, OnDestroy {
  readonly name = input<string>();
  readonly rendering = input.required<ComponentRendering>();
  readonly renderings = input<Array<ComponentRendering | HtmlElementRendering>>();
  readonly outputs = input<{
    [k: string]: (eventType: unknown) => void;
  }>();
  readonly clientOnly = input(false);

  readonly loaded = output<string | undefined>();
  readonly failed = output<Error>();
  readonly renderEachTemplate = contentChild(RenderEachDirective);
  readonly renderEmptyTemplate = contentChild(RenderEmptyDirective);
  readonly placeholderLoading = contentChild(PlaceholderLoadingDirective);
  public isLoading = true;
  metadataMode: boolean;
  chromeType: string;
  private readonly view = viewChild.required('view', { read: ViewContainerRef });
  private readonly metadataNode = viewChild.required('metadataCodeBlock', { read: TemplateRef });
  private readonly differs = inject(KeyValueDiffers);
  private readonly componentFactory = inject(JssComponentFactoryService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly router = inject(Router);
  private readonly missingComponentComponent = inject<Type<unknown>>(
    PLACEHOLDER_MISSING_COMPONENT_COMPONENT
  );
  private readonly hiddenRenderingComponent = inject<Type<unknown>>(
    PLACEHOLDER_HIDDEN_RENDERING_COMPONENT
  );
  private readonly guardResolver = inject<GuardResolver>(GUARD_RESOLVER);
  private readonly dataResolver = inject<DataResolver>(DATA_RESOLVER);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly jssState = inject(JssStateService);

  private _inputs: { [key: string]: unknown };
  private _differ: KeyValueDiffer<string, unknown>;
  private _componentRefs: ComponentRef<unknown>[] = [];
  private placeholderData?: (ComponentRendering<ComponentFields> | HtmlElementRendering)[];
  private destroyed = false;
  private parentStyleAttribute = '';
  private contextSubscription = this.jssState.state.subscribe(({ sitecore }) => {
    this.metadataMode = sitecore?.context.editMode === EditMode.Metadata;
  });

  @Input()
  set inputs(value: { [key: string]: unknown }) {
    this._inputs = value;
    if (!this._differ && value) {
      this._differ = this.differs.find(value).create();
    }
  }

  ngOnInit() {
    this.chromeType = this.name() ? 'placeholder' : 'rendering';
    // just to ensure the element exists
    const elem = this.elementRef.nativeElement;

    if (elem) {
      const attributes: NamedNodeMap = elem.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr: Attr | null = attributes.item(i);
        if (attr && attr.name.indexOf('_ngcontent') !== -1) {
          this.parentStyleAttribute = attr.name;
        }
      }
    }
    this.placeholderData = this.renderings() || this.getPlaceholder() || [];
  }

  ngOnDestroy() {
    this.destroyed = true;
    this._componentRefs = [];
    if (this.contextSubscription) {
      this.contextSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    this.chromeType = changes.name ? 'placeholder' : 'rendering';
    if (changes.rendering || changes.renderings) {
      this.placeholderData = this.renderings() || this.getPlaceholder() || [];
      this._render();
    }
  }

  ngDoCheck() {
    if (!this._differ || !this._inputs || this._componentRefs.length === 0) {
      return;
    }

    const changes = this._differ.diff(this._inputs);
    if (!changes) {
      return;
    }
    const updates: { [key: string]: unknown } = {};
    changes.forEachRemovedItem((change) => (updates[change.key] = null));
    changes.forEachAddedItem((change) => (updates[change.key] = change.currentValue));
    changes.forEachChangedItem((change) => (updates[change.key] = change.currentValue));
    this._componentRefs.forEach((componentInstance) =>
      this._setComponentInputs(componentInstance, updates)
    );
  }

  /**
   * Gets id for Metadata code blocks, in specific format
   * Metadata code blocks will wrap be added around placeholder content and each rendering component
   * to allow for editing integration in Pages.
   * @param {string} kind code block type ("open" or "close"). "open" is added before an element, and "close" added after one.
   * @param {string?} renderingId rendering uid to apply as id to code block
   * @returns {string} formatted id value for code HTML node
   */
  getCodeBlockId = (kind: string, renderingId?: string): string | undefined => {
    const rendering = this.rendering();
    if (rendering && kind === MetadataKind.Open) {
      const placeholderName = this.name();
      const id = renderingId || rendering?.uid;
      if (!renderingId && placeholderName) {
        let phId = '';
        for (const placeholder of Object.keys(rendering.placeholders || [])) {
          if (placeholderName === placeholder) {
            phId = id
              ? `${placeholderName}_${id}`
              : `${placeholderName}_${DEFAULT_PLACEHOLDER_UID}`;
            break;
          }
          // Check if the placeholder is a dynamic placeholder
          if (isDynamicPlaceholder(placeholder)) {
            const pattern = getDynamicPlaceholderPattern(placeholder);
            // Check if the placeholder matches the dynamic placeholder pattern
            if (pattern.test(placeholderName)) {
              phId = id ? `${placeholder}_${id}` : `${placeholder}_${DEFAULT_PLACEHOLDER_UID}`;
              break;
            }
          }
        }
        return phId;
      } else {
        return id;
      }
    }
    return undefined;
  };

  /**
   * Get renderings/components to be rendered for current placeholder name
   * Can modify the inner placeholders collection to adjust to using SXA dynamic placeholders
   * @returns {ComponentRendering<ComponentFields> | HtmlElementRendering[] | null} List of renderings to be rendered
   */
  private getPlaceholder() {
    let phName = this.name()?.slice() || '';
    /**
     * Process (SXA) dynamic placeholders
     * Find and replace the matching dynamic placeholder e.g 'nameOfContainer-{*}' with the requested e.g. 'nameOfContainer-1'.
     * For Metadata EditMode, we need to keep the raw placeholder name in place.
     */
    const rendering = this.rendering();
    rendering?.placeholders &&
      Object.keys(rendering.placeholders).forEach((placeholder) => {
        const patternPlaceholder = isDynamicPlaceholder(placeholder)
          ? getDynamicPlaceholderPattern(placeholder)
          : null;
        if (patternPlaceholder && patternPlaceholder.test(phName)) {
          if (this.metadataMode) {
            phName = placeholder;
          } else {
            rendering.placeholders![phName] = rendering.placeholders![placeholder];
            delete rendering.placeholders![placeholder];
          }
        }
      });

    if (rendering && rendering.placeholders && Object.keys(rendering.placeholders).length > 0) {
      return rendering.placeholders[phName];
    }
    return null;
  }

  private _setComponentInputs(
    componentRef: ComponentRef<unknown>,
    inputs: { [key: string]: unknown }
  ) {
    Object.entries(inputs).forEach(([input, inputValue]) => {
      try {
        componentRef.setInput(input, inputValue);
      } catch (e) {
        // Input doesn't exist on this component, ignore
      }
    });
  }

  private _subscribeComponentOutputs(
    componentInstance: { [key: string]: unknown },
    outputs: { [k: string]: (eventType: unknown) => void }
  ) {
    Object.keys(outputs)
      .filter(
        (output) => componentInstance[output] && componentInstance[output] instanceof Observable
      )
      .forEach((output) =>
        (componentInstance[output] as Observable<unknown>)
          .pipe(takeWhile(() => !this.destroyed))
          .subscribe(outputs[output])
      );
  }

  private async _render() {
    if (this.clientOnly() && isPlatformServer(this.platformId)) {
      return;
    }

    this._componentRefs = [];
    this.view().clear();

    const renderings = this.renderings();
    const renderingValue = this.rendering();
    if (!renderingValue && !renderings) {
      return;
    }

    const name = this.name();
    if (!name && !renderings) {
      console.warn(
        'Placeholder name was not specified, and explicit renderings array was not passed. Placeholder requires either name and rendering, or renderings.'
      );
      this.isLoading = false;
      return;
    }

    const placeholder = this.placeholderData;
    if (!placeholder) {
      console.warn(`Placeholder '${name}' was not found in the current rendering data`);
      this.isLoading = false;
      return;
    }

    // if the placeholder is empty (contains only raw renderings), then we may need to use the empty template if it's defined
    const placeholderIsEmpty = placeholder.every(
      (rendering: ComponentRendering | HtmlElementRendering) => isRawRendering(rendering)
    );

    const renderEmptyTemplate = this.renderEmptyTemplate();
    if (renderEmptyTemplate && placeholderIsEmpty) {
      this.view().createEmbeddedView(renderEmptyTemplate.templateRef, {
        renderings: placeholder,
      });
      this.isLoading = false;
    } else {
      const factories = await this.componentFactory.getComponents(placeholder);
      try {
        const nonGuarded = await this.guardResolver(factories);
        const withData = await this.dataResolver(nonGuarded);
        // not using index to ensure code blocks are rendered at correct positions
        withData.forEach((rendering) => {
          this.metadataMode &&
            this.view().createEmbeddedView(this.metadataNode(), {
              kind: MetadataKind.Open,
              chromeType: 'rendering',
              renderingId: (rendering.factory.componentDefinition as ComponentRendering)?.uid,
            });

          if (this.renderEachTemplate() && !isRawRendering(rendering.factory.componentDefinition)) {
            this._renderTemplatedComponent(rendering.factory.componentDefinition);
          } else {
            this._renderEmbeddedComponent(rendering.factory, rendering.data);
          }

          this.metadataMode &&
            this.view().createEmbeddedView(this.metadataNode(), {
              kind: MetadataKind.Close,
              chromeType: 'rendering',
              renderingId: (rendering.factory.componentDefinition as ComponentRendering)?.uid,
            });
        });

        this.isLoading = false;
        this.changeDetectorRef.markForCheck();
        this.loaded.emit(name);
      } catch (e) {
        this.isLoading = false;
        if (e instanceof JssCanActivateRedirectError) {
          const redirectValue = e.redirectValue;
          if (redirectValue instanceof RedirectCommand) {
            this.router.navigateByUrl(redirectValue.redirectTo);
          } else if (redirectValue instanceof UrlTree) {
            this.router.navigateByUrl(redirectValue);
          } else if (typeof redirectValue === 'string') {
            this.router.navigate([redirectValue]);
          } else {
            this.router.navigate(redirectValue);
          }
        } else {
          this.failed.emit(e as Error);
          console.warn(
            `Placeholder '${name}' was not able to render with the current rendering data and error`,
            e
          );
          return;
        }
      }
    }
  }

  private _renderTemplatedComponent(rendering: ComponentRendering | HtmlElementRendering) {
    // the render-each template takes care of all component mapping etc
    // generally using <sc-render-component> which is about like _renderEmbeddedComponent()
    // as a separate component
    const template = this.renderEachTemplate();
    if (template) {
      this.view().createEmbeddedView(template.templateRef, {
        rendering,
      });
    }
  }

  private _renderEmbeddedComponent(rendering: ComponentFactoryResult, data: Data) {
    if (
      (rendering.componentDefinition as ComponentRendering).componentName ===
      constants.HIDDEN_RENDERING_NAME
    ) {
      rendering.componentImplementation = this.hiddenRenderingComponent;
    }

    if (!rendering.componentImplementation) {
      const componentName = (rendering.componentDefinition as ComponentRendering).componentName;
      console.error(
        `Placeholder ${this.name()} contains unknown component ${componentName}.`,
        `Ensure component is mapped, like:
        JssModule.withComponents([
          { name: '${componentName}', type: ${componentName}Component }
        ])`
      );

      rendering.componentImplementation = this.missingComponentComponent;
    }
    // apply the parent style attribute _ngcontent
    // work-around for https://github.com/angular/angular/issues/12215
    const createdComponentRef = this.view().createComponent(rendering.componentImplementation, {
      ngModuleRef: rendering.componentModuleRef,
    });
    if (this.parentStyleAttribute) {
      this.renderer.setAttribute(
        createdComponentRef.location.nativeElement,
        this.parentStyleAttribute,
        ''
      );
    }

    const componentInstance = createdComponentRef.instance;
    createdComponentRef.setInput('rendering', rendering.componentDefinition);
    if (Object.keys(data).length > 0) {
      createdComponentRef.setInput('data', data);
    }
    if (this._inputs) {
      this._setComponentInputs(createdComponentRef, this._inputs);
    }
    const outputs = this.outputs();
    if (outputs) {
      this._subscribeComponentOutputs(componentInstance, outputs);
    }
    this._componentRefs.push(createdComponentRef);
  }
}

import {
  Component,
  ComponentRef,
  Input,
  KeyValueDiffer,
  KeyValueDiffers,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Type,
  ViewContainerRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ComponentRendering, HtmlElementRendering } from '@sitecore-jss/sitecore-jss/layout';
import { Observable } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import {
  ComponentFactoryResult,
  JssComponentFactoryService,
} from '../services/jss-component-factory.service';
import { PLACEHOLDER_MISSING_COMPONENT_COMPONENT } from '../services/placeholder.token';
import { RawComponent } from './raw.component';
import { isRawRendering } from './rendering';

/**
 * Destroys the injector that provides a lazily loaded standalone component.
 * @param {ComponentFactoryResult['componentInjector']} componentInjector The injector to destroy, if created.
 */
function destroyComponentInjector(componentInjector?: ComponentFactoryResult['componentInjector']) {
  if (componentInjector && !componentInjector.destroyed) {
    componentInjector.destroy();
  }
}

/**
 * Destroys an injector without replacing the error that caused cleanup.
 * @param {ComponentFactoryResult} factory The factory result that owns the injector.
 */
function destroyComponentInjectorAfterError(factory: ComponentFactoryResult) {
  try {
    destroyComponentInjector(factory.componentInjector);
  } catch {
    // Preserve the error that caused the injector cleanup.
  }
}

/**
 * Renders a single JSS component given a rendering definition.
 * Useful inside templated placeholders.
 */
@Component({
  selector: 'sc-render-component',
  template: `
    <ng-template #view></ng-template>
  `,
})
export class RenderComponentComponent implements OnChanges, OnDestroy {
  readonly rendering = input<ComponentRendering | HtmlElementRendering>();
  readonly outputs = input<{
    [k: string]: (eventType: unknown) => void;
  }>();
  private readonly view = viewChild.required('view', { read: ViewContainerRef });

  private readonly differs = inject(KeyValueDiffers);
  private readonly componentFactory = inject(JssComponentFactoryService);
  private readonly missingComponentComponent = inject<
    Type<{
      [key: string]: unknown;
    }>
  >(PLACEHOLDER_MISSING_COMPONENT_COMPONENT);

  private _inputs: { [key: string]: unknown };
  private _differ: KeyValueDiffer<string, unknown>;
  private destroyed = false;

  @Input()
  set inputs(value: { [key: string]: unknown }) {
    this._inputs = value;
    if (!this._differ && value) {
      this._differ = this.differs.find(value).create();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.rendering) {
      this._render();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  private _setComponentInputs(
    componentRef: ComponentRef<unknown>,
    inputs: { [key: string]: unknown }
  ) {
    Object.entries(inputs).forEach(([input, inputValue]) =>
      componentRef.setInput(input, inputValue)
    );
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

  private _render(): Promise<void> {
    const view = this.view();
    view.clear();

    const renderingValue = this.rendering();
    if (!renderingValue) {
      return Promise.resolve();
    }

    const resolveComponent: Promise<ComponentFactoryResult> = isRawRendering(renderingValue)
      ? Promise.resolve({
          componentImplementation: RawComponent,
          componentDefinition: renderingValue,
        })
      : this.componentFactory.getComponent(renderingValue);

    return resolveComponent.then((rendering) => {
      if (this.destroyed) {
        destroyComponentInjectorAfterError(rendering);
        return;
      }

      if (!rendering.componentImplementation) {
        const componentName = (rendering.componentDefinition as ComponentRendering).componentName;
        console.error(
          `Attempted to render unknown component ${componentName}.`,
          `Ensure component is mapped, like:
          JssModule.withComponents([
            { name: '${componentName}', type: ${componentName}Component }
          ])`
        );

        rendering.componentImplementation = this.missingComponentComponent;
      }

      let componentRef: ComponentRef<unknown> | undefined;
      try {
        componentRef = rendering.componentInjector
          ? view.createComponent(rendering.componentImplementation, {
              environmentInjector: rendering.componentInjector,
            })
          : view.createComponent(rendering.componentImplementation);
        componentRef.onDestroy(() => destroyComponentInjector(rendering.componentInjector));
        componentRef.setInput('rendering', rendering.componentDefinition);
        if (this._inputs) {
          this._setComponentInputs(componentRef, this._inputs);
        }
        const outputs = this.outputs();
        if (outputs) {
          this._subscribeComponentOutputs(
            componentRef.instance as { [key: string]: unknown },
            outputs
          );
        }
      } catch (error) {
        if (componentRef) {
          try {
            componentRef.destroy();
          } catch {
            // Preserve the component creation or setup error.
          }
        } else {
          destroyComponentInjectorAfterError(rendering);
        }
        throw error;
      }
    });
  }
}

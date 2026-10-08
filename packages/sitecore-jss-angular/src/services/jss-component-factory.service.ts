import {
  createEnvironmentInjector,
  createNgModule,
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  Injectable,
  Injector,
  NgModuleRef,
  Type,
} from '@angular/core';
import { ComponentRendering, HtmlElementRendering } from '@sitecore-jss/sitecore-jss/layout';
import { RawComponent } from '../components/raw.component';
import { isRawRendering } from '../components/rendering';
import {
  ComponentNameAndModule,
  ComponentNameAndType,
  DYNAMIC_COMPONENT,
  JssCanActivate,
  JssCanActivateFn,
  JssResolve,
  PLACEHOLDER_COMPONENTS,
  PLACEHOLDER_LAZY_COMPONENTS,
} from './placeholder.token';

export interface ComponentFactoryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentImplementation?: Type<any>;
  componentDefinition: ComponentRendering | HtmlElementRendering;
  componentModuleRef?: NgModuleRef<unknown>;
  componentInjector?: EnvironmentInjector;
  canActivate?:
    | JssCanActivate
    | Type<JssCanActivate>
    | JssCanActivateFn
    | Array<JssCanActivate | JssCanActivateFn | Type<JssCanActivate>>;
  resolve?: { [key: string]: JssResolve<any> | Type<JssResolve<any>> };
}

/**
 * Checks whether a lazy load result is an NgModule type.
 * @param {unknown} value The lazy load result.
 */
function isNgModule(value: unknown): value is Type<unknown> {
  return typeof value === 'function' && Object.prototype.hasOwnProperty.call(value, 'ɵmod');
}

/**
 * Checks whether a lazy load result contains Angular environment providers.
 * @param {unknown} value The lazy load result.
 */
function isEnvironmentProviders(value: unknown): value is EnvironmentProviders {
  return typeof value === 'object' && value !== null && 'ɵproviders' in value;
}

/**
 * Destroys the injector that provides a lazily loaded standalone component.
 * @param {EnvironmentInjector | undefined} componentInjector The injector to destroy, if created.
 */
function destroyComponentInjector(componentInjector?: EnvironmentInjector) {
  if (componentInjector && !componentInjector.destroyed) {
    componentInjector.destroy();
  }
}

/**
 * Destroys an injector without replacing the error that caused cleanup.
 * @param {EnvironmentInjector | undefined} componentInjector The injector to destroy, if created.
 */
function destroyComponentInjectorAfterError(componentInjector: EnvironmentInjector | undefined) {
  try {
    destroyComponentInjector(componentInjector);
  } catch {
    // Preserve the error that caused the injector cleanup.
  }
}

@Injectable()
export class JssComponentFactoryService {
  private componentMap: Map<string, ComponentNameAndType>;
  private lazyComponentMap: Map<string, ComponentNameAndModule>;
  private components: ComponentNameAndType[];
  private lazyComponents: ComponentNameAndModule[];
  private injector = inject(Injector);
  private environmentInjector = inject(EnvironmentInjector);

  constructor() {
    this.components = inject(PLACEHOLDER_COMPONENTS);
    this.lazyComponents = inject(PLACEHOLDER_LAZY_COMPONENTS);
    this.componentMap = new Map();
    this.lazyComponentMap = new Map();

    this.components.forEach((c) => this.componentMap.set(c.name, c));

    if (this.lazyComponents) {
      this.lazyComponents.forEach((c) => this.lazyComponentMap.set(c.path, c));
    }
  }

  getComponent(component: ComponentRendering): Promise<ComponentFactoryResult> {
    const loadedComponent = this.componentMap.get(component.componentName);

    if (loadedComponent) {
      return Promise.resolve({
        componentDefinition: this.applySXAParams(component),
        componentImplementation: loadedComponent.type,
        canActivate: loadedComponent.canActivate,
        resolve: loadedComponent.resolve,
      });
    }

    const lazyComponent = this.lazyComponentMap.get(component.componentName);

    if (lazyComponent) {
      return lazyComponent.loadChildren().then((lazyChild) => {
        let componentType: Type<unknown> | undefined;
        let moduleRef: NgModuleRef<unknown> | undefined;
        let componentInjector: EnvironmentInjector | undefined;
        try {
          let dynamicComponentType: Type<unknown> | Record<string, Type<unknown>>;

          if (isNgModule(lazyChild)) {
            moduleRef = createNgModule(lazyChild, this.injector);
            dynamicComponentType = moduleRef.injector.get(DYNAMIC_COMPONENT);
          } else {
            const providers = isEnvironmentProviders(lazyChild)
              ? [lazyChild]
              : [{ provide: DYNAMIC_COMPONENT, useValue: lazyChild }];
            componentInjector = createEnvironmentInjector(providers, this.environmentInjector);
            dynamicComponentType = componentInjector.get(DYNAMIC_COMPONENT);
          }

          if (!dynamicComponentType) {
            throw new Error(
              `JssComponentFactoryService: Lazy load module for component "${lazyComponent.path}" missing DYNAMIC_COMPONENT provider. Missing JssModule.forChild()?`
            );
          }

          if (component.componentName in dynamicComponentType) {
            componentType = (dynamicComponentType as Record<string, Type<unknown>>)[
              component.componentName
            ];
          } else if (typeof dynamicComponentType === 'function') {
            componentType = dynamicComponentType;
          } else {
            throw new Error(
              `JssComponentFactoryService: Lazy load module for component "${lazyComponent.path}" missing DYNAMIC_COMPONENT provider. Missing JssModule.forChild()?`
            );
          }

          if (componentInjector && typeof componentType !== 'function') {
            throw new Error(
              `JssComponentFactoryService: Lazy load module for component "${lazyComponent.path}" missing DYNAMIC_COMPONENT provider. Missing JssModule.forChild()?`
            );
          }

          return {
            componentDefinition: this.applySXAParams(component),
            componentImplementation: componentType,
            componentModuleRef: moduleRef,
            componentInjector,
            canActivate: lazyComponent.canActivate,
            resolve: lazyComponent.resolve,
          };
        } catch (error) {
          destroyComponentInjectorAfterError(componentInjector);
          throw error;
        }
      });
    }

    return Promise.resolve({
      componentDefinition: component,
    });
  }

  getComponents(
    components: Array<ComponentRendering | HtmlElementRendering>
  ): Promise<ComponentFactoryResult[]> {
    // acquire all components and keep them in order while handling their potential async-ness
    const componentPromises = components.map((component) =>
      Promise.resolve().then(() =>
        isRawRendering(component) ? this.getRawComponent(component) : this.getComponent(component)
      )
    );
    let rejected = false;
    let originalError: unknown;
    componentPromises.forEach((promise) => {
      promise.catch((error: unknown) => {
        if (!rejected) {
          rejected = true;
          originalError = error;
        }
      });
    });

    return Promise.allSettled(componentPromises).then((results) => {
      if (rejected) {
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            destroyComponentInjectorAfterError(result.value.componentInjector);
          }
        });
        throw originalError;
      }

      return results.map(
        (result) => (result as PromiseFulfilledResult<ComponentFactoryResult>).value
      );
    });
  }

  private getRawComponent(component: HtmlElementRendering): Promise<ComponentFactoryResult> {
    return Promise.resolve({
      componentImplementation: RawComponent,
      componentDefinition: component,
    });
  }

  private applySXAParams(rendering: ComponentRendering) {
    // Provide aggregated SXA styles on params 'styles'
    const styles = [];
    if (rendering.params?.GridParameters) {
      styles.push(rendering.params.GridParameters.trim());
    }
    if (rendering.params?.Styles) {
      styles.push(rendering.params.Styles.trim());
    }
    if (rendering.params && styles.length > 0) {
      rendering.params.styles = styles.join(' ');
    }
    return rendering;
  }
}

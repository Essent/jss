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
import { isComponentMap, isComponentType, isNgModuleType } from './lazy-component-load-result';

export interface ComponentFactoryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentImplementation?: Type<any>;
  componentDefinition: ComponentRendering | HtmlElementRendering;
  componentModuleRef?: NgModuleRef<unknown>;
  /**
   * Environment injector for a lazy component, component map or EnvironmentProviders result.
   * The factory creates one per render and does not destroy it, like `componentModuleRef`.
   * Lazy providers can register app-lifetime sources (for example NgRx effects) that keep
   * using this injector after the rendered component is destroyed.
   */
  componentInjector?: EnvironmentInjector;
  canActivate?:
    | JssCanActivate
    | Type<JssCanActivate>
    | JssCanActivateFn
    | Array<JssCanActivate | JssCanActivateFn | Type<JssCanActivate>>;
  resolve?: { [key: string]: JssResolve<any> | Type<JssResolve<any>> };
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
        let dynamicComponentType: Type<unknown> | Record<string, Type<unknown>> | null;

        if (isNgModuleType(lazyChild)) {
          moduleRef = createNgModule(lazyChild, this.injector);
          dynamicComponentType = moduleRef.injector.get(DYNAMIC_COMPONENT);
        } else {
          const providers =
            isComponentType(lazyChild) || isComponentMap(lazyChild)
              ? [{ provide: DYNAMIC_COMPONENT, useValue: lazyChild }]
              : [lazyChild as EnvironmentProviders];
          componentInjector = createEnvironmentInjector(providers, this.environmentInjector);
          dynamicComponentType = componentInjector.get(DYNAMIC_COMPONENT, null, { self: true });
        }

        if (!dynamicComponentType) {
          if (componentInjector) {
            throw new Error(
              `JssComponentFactoryService: Lazy providers for component "${component.componentName}" do not provide DYNAMIC_COMPONENT.`
            );
          }
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
          if (componentInjector) {
            throw new Error(
              `JssComponentFactoryService: DYNAMIC_COMPONENT component map does not contain "${component.componentName}" for lazy component "${lazyComponent.path}".`
            );
          }
          throw new Error(
            `JssComponentFactoryService: Lazy load module for component "${lazyComponent.path}" missing DYNAMIC_COMPONENT provider. Missing JssModule.forChild()?`
          );
        }

        if (componentInjector && typeof componentType !== 'function') {
          throw new Error(
            `JssComponentFactoryService: DYNAMIC_COMPONENT component map entry for "${component.componentName}" is not a component type.`
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
    return Promise.all(
      components.map((component) =>
        isRawRendering(component) ? this.getRawComponent(component) : this.getComponent(component)
      )
    );
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

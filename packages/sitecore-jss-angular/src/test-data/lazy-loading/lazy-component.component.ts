import { Component, inject, input } from '@angular/core';
import { ComponentRendering } from '@sitecore-jss/sitecore-jss/layout';
import { MockService } from './mock.service';

/**
 * This component is used to test lazy loading functionality.
 */
@Component({
  selector: 'lazy-component',
  template: `
    {{ rendering()?.fields?.linkText?.value }}
    {{ getText() }}
  `,
})
export class LazyComponent {
  readonly rendering = input<ComponentRendering<any>>();
  readonly data = input<unknown>();

  private mockService: MockService = inject(MockService);

  getText() {
    return this.mockService.get('Hello world');
  }
}

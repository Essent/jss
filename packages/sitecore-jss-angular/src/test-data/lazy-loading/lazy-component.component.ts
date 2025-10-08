import { Component, inject, Input } from '@angular/core';
import { ComponentRendering } from '@sitecore-jss/sitecore-jss/layout';
import { MockService } from './mock.service';

/**
 * This component is used to test lazy loading functionality.
 */
@Component({
  selector: 'lazy-component',
  template: `
    {{ rendering?.fields?.linkText?.value }}
    {{ getText() }}
  `,
})
export class LazyComponent {
  @Input() rendering: ComponentRendering;
  @Input() data: unknown;

  private mockService: MockService = inject(MockService);

  getText() {
    return this.mockService.get('Hello world');
  }
}

import { Directive, TemplateRef, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LinkDirective } from './link.directive';
import { LinkField } from './rendering-field';

@Directive({ selector: '[scRouterLink]' })
export class RouterLinkDirective extends LinkDirective {
  readonly editable = input(true, { alias: 'scRouterLinkEditable' });

  readonly attrs = input<{
    [attr: string]: string;
  }>({}, { alias: 'scRouterLinkAttrs' });

  readonly field = input<LinkField | undefined>(undefined, { alias: 'scRouterLink' });

  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>(undefined, {
    alias: 'scRouterLinkEmptyFieldEditingTemplate',
  });

  private readonly router = inject(Router);

  protected renderTemplate(props: { [prop: string]: string }, linkText: string) {
    const viewRef = this.viewContainer.createEmbeddedView(this.templateRef);

    viewRef.rootNodes.forEach((node) => {
      Object.entries(props).forEach(([key, propValue]) => {
        this.updateAttribute(node, key, propValue);

        if (key === 'href') {
          this.renderer.listen(node, 'click', (event) => {
            this.router.navigateByUrl(propValue);

            // shouldn't prevent default if the link includes a fragment
            if (!propValue.includes('#')) {
              event.preventDefault();
            }
          });
        }
      });

      if (node.childNodes && node.childNodes.length === 0 && linkText) {
        node.textContent = linkText;
      }
    });
  }
}

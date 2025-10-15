import {
  Directive,
  InputSignal,
  OnChanges,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  Type,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import { isAbsoluteUrl } from '@sitecore-jss/sitecore-jss/utils';
import { BaseFieldDirective } from './base-field.directive';
import { DefaultEmptyFieldEditingComponent } from './default-empty-text-field-editing-placeholder.component';
import { RichTextField } from './rendering-field';

@Directive({
  selector: '[scRichText]',
})
export class RichTextDirective extends BaseFieldDirective implements OnChanges {
  readonly editable = input(true, { alias: 'scRichTextEditable' });

  readonly field: InputSignal<RichTextField | undefined> = input<RichTextField | undefined>(
    undefined,
    { alias: 'scRichText' }
  );

  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>(undefined, {
    alias: 'scRichTextEmptyFieldEditingTemplate',
  });

  /**
   * Default component to render in Pages in Metadata edit mode if field value is empty and emptyFieldEditingTemplate is not provided
   */
  protected defaultFieldEditingComponent: Type<unknown> = DefaultEmptyFieldEditingComponent;

  private readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly renderer = inject(Renderer2);
  private readonly router = inject(Router);

  ngOnChanges(changes: SimpleChanges) {
    if (changes.field || changes.editable) {
      this.viewContainer.clear();
      this.updateView();
    }
  }

  private updateView() {
    const field = this.field();
    if (!field || !this.shouldRender()) {
      super.renderEmpty();
      return;
    }

    this.renderMetadata(MetadataKind.Open);
    this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef);
    this.renderMetadata(MetadataKind.Close);

    const html = field.editable && this.editable() ? field.editable : field.value;
    this.viewRef.rootNodes.forEach((node) => {
      node.innerHTML = html;

      if (!node.querySelectorAll) {
        return;
      }

      const links: NodeListOf<HTMLLinkElement> = node.querySelectorAll('a[href]');
      const linksArray: Array<HTMLLinkElement> = [].slice.call(links);

      linksArray.forEach((link) => {
        const href = link.getAttribute('href');
        const target = link.getAttribute('target');

        if (!href || isAbsoluteUrl(href) || target === '_blank' || target === '_top') {
          return;
        }

        this.renderer.listen(link, 'click', (event) => {
          this.router.navigateByUrl(href);
          event.preventDefault();
        });
      });
    });
  }
}

import { DatePipe } from '@angular/common';
import { Directive, inject, Input, OnChanges, SimpleChanges, TemplateRef } from '@angular/core';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import { BaseFieldDirective } from './base-field.directive';
import { DefaultEmptyFieldEditingComponent } from './default-empty-text-field-editing-placeholder.component';
import { DateField } from './rendering-field';

@Directive({
  selector: '[scDate]',
})
export class DateDirective extends BaseFieldDirective implements OnChanges {
  @Input('scDateFormat') format?: string;

  @Input('scDateTimezone') timezone?: string;

  @Input('scDateLocale') locale?: string;

  @Input('scDateEditable') editable = true;

  @Input('scDate') field: DateField;

  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  @Input('scDateEmptyFieldEditingTemplate') emptyFieldEditingTemplate: TemplateRef<unknown>;

  /**
   * Default component to render in Pages in Metadata edit mode if field value is empty and emptyFieldEditingTemplate is not provided
   */
  protected defaultFieldEditingComponent = DefaultEmptyFieldEditingComponent;

  private readonly templateRef: TemplateRef<unknown> = inject(TemplateRef);
  private readonly datePipe: DatePipe = inject(DatePipe);

  constructor() {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.field || changes.format) {
      this.viewContainer.clear();
      this.updateView();
    }
  }

  private updateView() {
    if (!this.shouldRender()) {
      super.renderEmpty();
      return;
    }

    this.renderMetadata(MetadataKind.Open);
    this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef);
    this.renderMetadata(MetadataKind.Close);

    const field = this.field;

    const html = field.editable && this.editable ? field.editable : field.value;
    const setDangerously = field.editable && this.editable;
    this.viewRef.rootNodes.forEach((node) => {
      if (setDangerously) {
        node.innerHTML = html;
      } else {
        node.textContent = this.datePipe.transform(html, this.format, this.timezone, this.locale);
      }
    });
  }
}

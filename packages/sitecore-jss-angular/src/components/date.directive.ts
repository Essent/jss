import { DatePipe } from '@angular/common';
import {
  Directive,
  inject,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  input,
  InputSignal,
} from '@angular/core';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import { BaseFieldDirective } from './base-field.directive';
import { DefaultEmptyFieldEditingComponent } from './default-empty-text-field-editing-placeholder.component';
import { DateField } from './rendering-field';

@Directive({
  selector: '[scDate]',
})
export class DateDirective extends BaseFieldDirective implements OnChanges {
  readonly format = input<string>(undefined, { alias: 'scDateFormat' });

  readonly timezone = input<string>(undefined, { alias: 'scDateTimezone' });

  readonly locale = input<string>(undefined, { alias: 'scDateLocale' });

  readonly editable = input(true, { alias: 'scDateEditable' });

  readonly field: InputSignal<DateField | undefined> = input<DateField | undefined>(undefined, {
    alias: 'scDate',
  });

  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>(undefined, {
    alias: 'scDateEmptyFieldEditingTemplate',
  });

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

    const field = this.field();
    this.renderMetadata(MetadataKind.Open);
    this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef);
    this.renderMetadata(MetadataKind.Close);

    const html = field.editable && this.editable() ? field.editable : field.value;
    const setDangerously = field.editable && this.editable();
    this.viewRef.rootNodes.forEach((node) => {
      if (setDangerously) {
        node.innerHTML = html;
      } else {
        node.textContent = this.datePipe.transform(
          html,
          this.format(),
          this.timezone(),
          this.locale()
        );
      }
    });
  }
}

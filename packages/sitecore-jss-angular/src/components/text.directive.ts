import {
  Directive,
  InputSignal,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  Type,
  inject,
  input,
} from '@angular/core';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import { BaseFieldDirective } from './base-field.directive';
import { DefaultEmptyFieldEditingComponent } from './default-empty-text-field-editing-placeholder.component';
import { TextField } from './rendering-field';

@Directive({
  selector: '[scText]',
})
export class TextDirective extends BaseFieldDirective implements OnChanges {
  readonly editable = input(true, { alias: 'scTextEditable' });

  readonly encode = input(true, { alias: 'scTextEncode' });

  readonly field: InputSignal<TextField | undefined> = input<TextField | undefined>(undefined, {
    alias: 'scText',
  });

  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>(undefined, {
    alias: 'scTextEmptyFieldEditingTemplate',
  });

  /**
   * Default component to render in Pages in Metadata edit mode if field value is empty and emptyFieldEditingTemplate is not provided
   */
  protected defaultFieldEditingComponent: Type<unknown> = DefaultEmptyFieldEditingComponent;

  private templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  ngOnChanges(changes: SimpleChanges) {
    if (changes.field || changes.editable || changes.encode) {
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

    let editable = this.editable();

    // can't use editable value if we want to output unencoded
    const encode = this.encode();
    if (!encode) {
      editable = false;
    }

    const html = field.editable && editable ? field.editable : field.value;
    const setDangerously = (field.editable && editable) || !encode;

    this.viewRef.rootNodes.forEach((node) => {
      if (setDangerously) {
        node.innerHTML = html;
      } else {
        node.textContent = html;
      }
    });
  }
}

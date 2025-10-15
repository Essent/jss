import {
  Directive,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  Type,
  inject,
  input
} from '@angular/core';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';
import { BaseFieldDirective } from '../components/base-field.directive';
import { DefaultEmptyFieldEditingComponent } from '../components/default-empty-text-field-editing-placeholder.component';
import { TextField } from '../components/rendering-field';

@Directive({
  selector: '[scTestBase]',
})
export class TestBaseDirective extends BaseFieldDirective implements OnChanges {
  readonly editable = input(true, { alias: "scTestBaseEditable" });
  readonly field = input<TextField>(undefined, { alias: "scTestBase" });
  readonly emptyFieldEditingTemplate = input<TemplateRef<unknown>>(undefined, { alias: "scTestBaseEmptyFieldEditingTemplate" });
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

    this.renderMetadata(MetadataKind.Open);
    this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef);
    this.renderMetadata(MetadataKind.Close);

    const field = this.field();
    const editable = this.editable();

    const html = field.editable && editable ? field.editable : field.value;

    this.viewRef.rootNodes.forEach((node) => {
      node.textContent = html;
    });
  }
}

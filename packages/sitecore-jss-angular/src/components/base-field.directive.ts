import {
  Directive,
  Type,
  ViewContainerRef,
  EmbeddedViewRef,
  TemplateRef,
  inject,
  InputSignal,
} from '@angular/core';
import { RenderingField } from './rendering-field';
import { GenericFieldValue, isFieldValueEmpty } from '@sitecore-jss/sitecore-jss/layout';
import { FieldMetadataMarkerComponent } from './field-metadata-marker.component';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';

/**
 * Base class that contains common functionality for the field directives.
 */
@Directive()
export abstract class BaseFieldDirective {
  protected viewRef?: EmbeddedViewRef<unknown>;
  protected readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);

  protected abstract field: InputSignal<RenderingField<any> | undefined>;
  protected abstract editable: InputSignal<boolean>;
  /**
   * Custom template to render in Pages in Metadata edit mode if field value is empty
   */
  protected abstract emptyFieldEditingTemplate: InputSignal<TemplateRef<unknown> | undefined>;
  /**
   * Default component to render in Pages in Metadata edit mode if field value is empty and emptyFieldEditingTemplate is not provided
   */
  protected abstract defaultFieldEditingComponent: Type<unknown>;

  /**
   * Determines if directive should render the field as is
   * Returns true if we are in edit mode 'chromes' (field.editable is present) or field is not empty
   */
  protected shouldRender() {
    const field = this.field();
    return !!field?.editable || !isFieldValueEmpty(field);
  }

  /**
   * Renders the empty field markup which is required by Pages in editMode 'metadata' in case field is empty.
   */
  protected renderEmpty() {
    if (this.field()?.metadata && this.editable()) {
      this.renderMetadata(MetadataKind.Open);
      const template = this.emptyFieldEditingTemplate();
      if (template) {
        this.viewContainer.createEmbeddedView(template);
      } else {
        this.viewContainer.createComponent(this.defaultFieldEditingComponent);
      }
      this.renderMetadata(MetadataKind.Close);
    }
  }

  /**
   * Renders a metadata chrome marker for the field. Required by Pages in editMode 'metadata'.
   * @param {string} kind - 'open' or 'close' to indicate the start or end of the metadata chrome
   */
  protected renderMetadata(kind: MetadataKind) {
    const field = this.field();
    if (field?.metadata && this.editable()) {
      const metadataChrome = this.viewContainer.createComponent(FieldMetadataMarkerComponent);
      metadataChrome.setInput('kind', kind);
      if (kind === MetadataKind.Open) {
        metadataChrome.setInput('metadata', field.metadata);
      }
    }
  }
}

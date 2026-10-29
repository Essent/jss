import { Component, input } from '@angular/core';
import { MetadataKind } from '@sitecore-jss/sitecore-jss/editing';

/**
 * Component that renders a field' metadata chrome element.
 */
@Component({
  selector: 'code[scFieldMetadataMarker]',
  template: '{{ metadataString }}',
  host: {
    '[attr.type]': '"text/sitecore"',
    '[attr.chrometype]': '"field"',
    '[class]': '"scpm"',
    '[attr.kind]': 'kind()',
  },
})
export class FieldMetadataMarkerComponent {
  readonly metadata = input<any>();
  readonly kind = input<MetadataKind>(MetadataKind.Open);

  get metadataString(): string {
    const metadata = this.metadata();
    return metadata ? JSON.stringify(metadata) : '';
  }
}

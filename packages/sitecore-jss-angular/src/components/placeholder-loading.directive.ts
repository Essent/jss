import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[scPlaceholderLoading]',
})
export class PlaceholderLoadingDirective {
  templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

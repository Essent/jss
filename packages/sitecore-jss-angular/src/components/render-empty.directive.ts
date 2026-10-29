import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[renderEmpty]',
})
export class RenderEmptyDirective {
  templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

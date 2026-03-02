import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[renderEach]',
})
export class RenderEachDirective {
  templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

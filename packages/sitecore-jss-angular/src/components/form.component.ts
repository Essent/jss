/* eslint-disable prefer-const */
import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { debug, form } from '@sitecore-jss/sitecore-jss';
import { ComponentRendering, LayoutServicePageState } from '@sitecore-jss/sitecore-jss/layout';
import { Subscription } from 'rxjs';
import { JssStateService } from '../services/jss-state.service';
import { EDGE_CONFIG } from '../services/shared.token';

let { executeScriptElements, loadForm, subscribeToFormSubmitEvent } = form;

/**
 * Mock function to replace the form module functions for `testing` purposes.
 * @param {any} formModule - The form module to mock
 */
export const mockFormModule = (formModule: any) => {
  executeScriptElements = formModule.executeScriptElements;
  loadForm = formModule.loadForm;
  subscribeToFormSubmitEvent = formModule.subscribeToFormSubmitEvent;
};

/**
 * Shape of the Form component rendering data.
 * FormId is the rendering parameter that specifies the ID of the Sitecore Form to render.
 */
export type FormRendering = {
  params: {
    FormId: string;
    styles?: string;
  };
} & ComponentRendering;

/**
 * A component that renders a Sitecore Form.
 * It fetches the form markup from the Sitecore Edge service and renders it in the component's template.
 */
@Component({
  selector: 'app-form',
  template: `
    @if (isEditing) { @if (!rendering.params.FormId) {
    <div
      style="background: darkorange; outline: 5px solid orange; padding: 10px; color: white; max-width: 500px;"
    >
      <h2>{{ rendering.componentName }}</h2>
      <p>JSS component is missing FormId rendering parameter.</p>
    </div>
    } @if (hasError) {
    <div class="sc-jss-placeholder-error">There was a problem loading this section</div>
    } }
  `,
})
export class FormComponent implements OnInit, OnDestroy {
  /**
   * The rendering data for the component
   */
  @Input() rendering: FormRendering;
  @Input() data: unknown;

  hasError = false;

  isEditing = false;

  private contextSubscription: Subscription;

  private readonly edgeConfig = inject(EDGE_CONFIG);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly jssState = inject(JssStateService);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadForm();

      this.contextSubscription = this.jssState.state.subscribe(({ sitecore }) => {
        this.isEditing = sitecore?.context.pageState !== LayoutServicePageState.Normal;
      });
    }
  }

  ngOnDestroy() {
    if (this.contextSubscription) {
      this.contextSubscription.unsubscribe();
    }
  }

  /**
   * Fetches the form markup from the Sitecore Edge service and renders it in the component's template.
   */
  async loadForm() {
    const { sitecoreEdgeContextId, sitecoreEdgeUrl } = this.edgeConfig;

    try {
      const content = await loadForm(
        sitecoreEdgeContextId,
        this.rendering.params.FormId,
        sitecoreEdgeUrl
      );

      this.elRef.nativeElement.innerHTML = content;
      this.elRef.nativeElement.className = this.rendering.params?.styles?.trimEnd() || '';
      this.elRef.nativeElement.id = this.rendering.params?.RenderingIdentifier || '';

      const form = this.elRef.nativeElement.querySelector('form');

      if (!form) {
        debug.form(
          `Form '${this.rendering.params.FormId}' was not able to render since form element was not found`
        );
        return;
      }

      executeScriptElements(this.elRef.nativeElement);

      if (!this.isEditing) {
        subscribeToFormSubmitEvent(form, this.rendering.uid);
      }
    } catch {
      this.hasError = true;
    }
  }
}

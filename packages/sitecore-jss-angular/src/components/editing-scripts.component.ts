import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit, Renderer2 } from '@angular/core';
import { getJssPagesClientData } from '@sitecore-jss/sitecore-jss/editing';
import { EditMode, LayoutServicePageState } from '@sitecore-jss/sitecore-jss/layout';
import { isServer } from '@sitecore-jss/sitecore-jss/utils';
import { JssStateService } from '../services/jss-state.service';

/**
 * Component that renders editing scripts and client data for the current page in Sitecore Editor.
 * Only renders scripts when Metadata mode is used.
 */
@Component({
  selector: 'sc-editing-scripts',
  template: '',
})
export class EditingScriptsComponent implements OnInit {
  private readonly renderer: Renderer2 = inject(Renderer2);
  private readonly stateService: JssStateService = inject(JssStateService);
  private readonly document: Document = inject(DOCUMENT);

  ngOnInit(): void {
    const state = this.stateService.stateValue;
    const { pageState, editMode, clientData, clientScripts } = state.sitecore?.context || {};

    // Don't render anything if not in editing mode or not server side
    if (
      pageState === LayoutServicePageState.Normal ||
      pageState === LayoutServicePageState.Preview ||
      !isServer()
    ) {
      return;
    }

    if (editMode === EditMode.Metadata) {
      const jssClientData = { ...clientData, ...getJssPagesClientData() };
      clientScripts?.forEach((src: string) => {
        const scriptElement = this.renderer.createElement('script');
        scriptElement.src = src;
        this.renderer.appendChild(this.document.body, scriptElement);
      });

      Object.keys(jssClientData).forEach((id: string) => {
        const scriptElement = this.renderer.createElement('script');
        scriptElement.id = id;
        scriptElement.type = 'application/json';
        scriptElement.innerHTML = JSON.stringify(jssClientData[id]);
        this.renderer.appendChild(this.document.body, scriptElement);
      });
    }
  }
}

import { NgTemplateOutlet } from '@angular/common';
import { Component, OnChanges, input } from '@angular/core';
import {
  EditFrameDataSource,
  ChromeCommand,
  EditButtonTypes,
  mapButtonToCommand,
} from '@sitecore-jss/sitecore-jss/editing';
import { LayoutServiceContextData, RouteData } from '@sitecore-jss/sitecore-jss/layout';

@Component({
  selector: 'sc-edit-frame,[sc-edit-frame]',
  template: `
    <ng-template #childContent>
      <ng-content></ng-content>
    </ng-template>
    @if (isEditing) {
    <div [class]="frameProps.class" [attr.sc_item]="frameProps.sc_item">
      <span class="scChromeData">{{ chromeData }}</span>
      <ng-container *ngTemplateOutlet="childContent"></ng-container>
    </div>
    } @else {
    <ng-container *ngTemplateOutlet="childContent"></ng-container>
    }
  `,
  imports: [NgTemplateOutlet],
})
export class EditFrameComponent implements OnChanges {
  readonly dataSource = input<EditFrameDataSource>();

  readonly buttons = input<EditButtonTypes[]>();

  readonly title = input<string>();

  readonly tooltip = input<string>();

  readonly cssClass = input<string>();

  readonly parameters = input<Record<string, string | number | boolean | undefined | null>>();

  readonly sitecore = input<
    LayoutServiceContextData & {
      route: RouteData<unknown> | null;
    }
  >();

  isEditing = false;
  frameProps: Record<string, unknown> = {};
  chromeData = '';

  ngOnChanges() {
    const sitecore = this.sitecore();
    if (!sitecore?.context.pageEditing) {
      return;
    }

    this.frameProps.class = 'scLooseFrameZone';
    const cssClass = this.cssClass();
    if (cssClass) {
      this.frameProps.class = `${this.frameProps.class} ${cssClass}`;
    }

    // item uri for edit frame target
    const dataSource = this.dataSource();
    if (dataSource) {
      const route = sitecore.route;
      const databaseName = dataSource.databaseName || route?.databaseName;
      const language = dataSource.language || sitecore.context.language;
      this.frameProps.sc_item = `sitecore://${databaseName}/${dataSource.itemId}?lang=${language}`;
    }

    this.chromeData = this.buildChromeData();
  }

  buildChromeData() {
    const chromeData: Record<string, unknown> = {
      displayName: this.title(),
      expandedDisplayName: this.tooltip(),
    };

    if (this.dataSource()) {
      chromeData.contextItemUri = this.frameProps.sc_item;
    }

    chromeData.commands = this.buttons()?.map(
      (value): ChromeCommand => {
        return mapButtonToCommand(value, this.dataSource()?.itemId, this.parameters());
      }
    );

    return JSON.stringify(chromeData);
  }
}

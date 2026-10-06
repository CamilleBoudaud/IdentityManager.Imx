/*
 * ONE IDENTITY LLC. PROPRIETARY INFORMATION
 *
 * This software is confidential.  One Identity, LLC. or one of its affiliates or
 * subsidiaries, has supplied this software to you under terms of a
 * license agreement, nondisclosure agreement or both.
 *
 * You may not copy, disclose, or use this software except in accordance with
 * those terms.
 *
 *
 * Copyright 2025 One Identity LLC.
 * ALL RIGHTS RESERVED.
 *
 * ONE IDENTITY LLC. MAKES NO REPRESENTATIONS OR
 * WARRANTIES ABOUT THE SUITABILITY OF THE SOFTWARE,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE IMPLIED WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE, OR
 * NON-INFRINGEMENT.  ONE IDENTITY LLC. SHALL NOT BE
 * LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE
 * AS A RESULT OF USING, MODIFYING OR DISTRIBUTING
 * THIS SOFTWARE OR ITS DERIVATIVES.
 *
 */

import { CommonModule } from '@angular/common';
import { Inject, NgModule, inject, provideAppInitializer } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EuiCoreModule, EuiMaterialModule } from '@elemental-ui/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  AppConfigService,
  BusyIndicatorModule,
  CdrModule,
  ClassloggerService,
  DataSourceToolbarModule,
  DataTableModule,
  DataTilesModule,
  DataTreeModule,
  DataViewModule,
  FkAdvancedPickerModule,
  LdsReplaceModule,
  MetadataService,
  QbmModule,
  RouteGuardService,
  SqlWizardApiService,
  StatisticsModule,
  TileModule
} from 'qbm';

import { RouterModule, Routes } from '@angular/router';
import { ReCaptchaV3Service, RecaptchaModule } from 'ng-recaptcha-2';
import { FilterSqlWizardService } from './filter-sqlwizard/filter-sqlwizard.service';
import { PortalMetadataService } from './metadata/portal-metadata.service';
import { PatternItemService } from './pattern-item-list/pattern-item.service';
import { PatternItemsModule } from './pattern-item-list/pattern-items.module';
import { QerService } from './qer.service';
import { QueueStatusComponent } from './queue/queue-status/queue-status.component';
import { ServiceItemsModule } from './service-items/service-items.module';
import { ServiceItemsService } from './service-items/service-items.service';
import { SettingsComponent } from './settings/settings.component';
import { ShoppingCartValidationDetailModule } from './shopping-cart-validation-detail/shopping-cart-validation-detail.module';
import { TilesModule } from './tiles/tiles.module';
import { UserModule } from './user/user.module';
import { BusinessOwnerChartSummaryComponent } from './wport/businessowner-chartsummary/businessowner-chartsummary.component';
import { CreateIdentityComponent } from './wport/create-identity/create-identity.component';
import { IdentitiesToValidateComponent } from './wport/identities-to-validate/identities-to-validate.component';
import { StartComponent } from './wport/start/start.component';

const routes: Routes = [
  {
    path: 'dashboard',
    component: StartComponent,
    canActivate: [RouteGuardService],
    resolve: [RouteGuardService],
  },
  {
    path: 'createidentity',
    component: CreateIdentityComponent,
    canActivate: [RouteGuardService],
    resolve: [RouteGuardService],
  },
  {
    path: 'identities-to-validate',
    component: IdentitiesToValidateComponent,
    canActivate: [RouteGuardService],
    resolve: [RouteGuardService],
  },
];

// @dynamic
@NgModule({
  declarations: [StartComponent, BusinessOwnerChartSummaryComponent, SettingsComponent, CreateIdentityComponent, IdentitiesToValidateComponent],
  imports: [
    RouterModule.forChild(routes),
    CommonModule,
    QbmModule,
    CdrModule,
    TranslateModule,
    FormsModule,
    ServiceItemsModule,
    PatternItemsModule,
    ReactiveFormsModule,
    EuiCoreModule,
    EuiMaterialModule,
    TileModule,
    TilesModule,
    UserModule,
    LdsReplaceModule,
    BusyIndicatorModule,
    DataSourceToolbarModule,
    DataTableModule,
    DataTilesModule,
    DataTreeModule,
    ShoppingCartValidationDetailModule,
    FkAdvancedPickerModule,
    RecaptchaModule,
    DataViewModule,
    QueueStatusComponent,
    StatisticsModule,
  ],
  providers: [
    provideAppInitializer(() => inject(QerService).init()),
    {
      provide: MetadataService,
      useClass: PortalMetadataService,
    },
    {
      provide: SqlWizardApiService,
      useClass: FilterSqlWizardService,
    },
    ServiceItemsService,
    PatternItemService,
    ReCaptchaV3Service,
  ],
})
export class QerModule {
  constructor(
    logger: ClassloggerService,
    private readonly config: AppConfigService,
    @Inject('environment') private readonly environment,
    @Inject('appConfigJson') private readonly appConfigJson,
  ) {
    logger.info(this, '▶️ QerModule loaded');
  }
}

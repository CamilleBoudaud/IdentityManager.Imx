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

import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EuiLoadingService, EuiSidesheetService } from '@elemental-ui/core';

import { PortalAdminPerson, QerProjectConfig } from '@imx-modules/imx-api-qer';
import { ProjectConfig } from '@imx-modules/imx-api-qbm';
import { CompareOperator, FilterType } from '@imx-modules/imx-qbm-dbts';
import { calculateSidesheetWidth, CdrFactoryService } from 'qbm';
import { IdentitiesService } from '../../identities/identities.service';
import { IdentitySidesheetComponent } from '../../identities/identity-sidesheet/identity-sidesheet.component';
import { ProjectConfigurationService } from '../../project-configuration/project-configuration.service';

/** Row shown in the list: the identity plus its current approval state label/color, read dynamically because CCC_ApprovalState is a custom column. */
interface IdentityApprovalRow {
  identity: PortalAdminPerson;
  approvalStateLabel: string;
  approvalStateColor: string;
}

/**
 * HR-only page listing identities awaiting approval (custom column CCC_ApprovalState = 1 "pending"
 * or 3 "rejected", i.e. anything not yet validated). Reachable only from the "Identités à valider"
 * tile on the start page (imx-start), which is itself hidden for non-HR users.
 *
 * Clicking a row opens the standard identity edit sidesheet, where HR sets the new state; the
 * resulting approval/rejection popups are handled by imx-identity-sidesheet itself.
 */
@Component({
  selector: 'imx-identities-to-validate',
  templateUrl: './identities-to-validate.component.html',
  styleUrls: ['./identities-to-validate.component.scss'],
  standalone: false,
})
export class IdentitiesToValidateComponent implements OnInit {
  private static readonly approvalStateColumnName = 'CCC_ApprovalState';
  private static readonly approvalStateLabels: Record<string, string> = {
    '0': '#LDS#Validée',
    '1': '#LDS#En attente',
    '3': '#LDS#Refusée',
  };
  private static readonly approvalStateColors: Record<string, string> = {
    '0': 'green',
    '1': 'orange',
    '3': 'red',
  };

  public rows: IdentityApprovalRow[] = [];
  public isLoading = true;

  private projectConfig: ProjectConfig & QerProjectConfig;

  constructor(
    private readonly identitiesService: IdentitiesService,
    private readonly projectConfigurationService: ProjectConfigurationService,
    private readonly sidesheet: EuiSidesheetService,
    private readonly busyIndicator: EuiLoadingService,
    private readonly translate: TranslateService,
  ) {}

  public async ngOnInit(): Promise<void> {
    this.projectConfig = await this.projectConfigurationService.getConfig();
    await this.reload();
  }

  public async openIdentity(row: IdentityApprovalRow): Promise<void> {
    this.busyIndicator.show();
    let fullIdentity: PortalAdminPerson;
    try {
      fullIdentity = await this.identitiesService.getAdminPerson(row.identity.GetEntity().GetKeys()[0]);
    } finally {
      this.busyIndicator.hide();
    }

    await this.sidesheet
      .open(IdentitySidesheetComponent, {
        title: await this.translate.get('#LDS#Heading Edit Identity').toPromise(),
        subTitle: fullIdentity.GetEntity().GetDisplay(),
        padding: '0px',
        disableClose: true,
        width: calculateSidesheetWidth(1250, 0.7),
        icon: 'contactinfo',
        data: {
          isAdmin: true,
          projectConfig: this.projectConfig,
          selectedIdentity: fullIdentity,
          canEdit: true,
        },
        testId: 'identities-to-validate-identity-sidesheet',
      })
      .afterClosed()
      .toPromise();

    await this.reload();
  }

  private async reload(): Promise<void> {
    this.isLoading = true;
    try {
      const result = await this.identitiesService.getAllPersonAdmin(
        {
          filter: [
            {
              ColumnName: IdentitiesToValidateComponent.approvalStateColumnName,
              Type: FilterType.Compare,
              CompareOp: CompareOperator.NotEqual,
              Value1: '0',
            },
          ],
        },
        new AbortController().signal,
      );

      this.rows = result.Data.map((identity) => {
        const approvalState = this.getApprovalState(identity);
        return {
          identity,
          approvalStateLabel: IdentitiesToValidateComponent.approvalStateLabels[approvalState] ?? '#LDS#Inconnu',
          approvalStateColor: IdentitiesToValidateComponent.approvalStateColors[approvalState] ?? 'gray',
        };
      });
    } finally {
      this.isLoading = false;
    }
  }

  private getApprovalState(identity: PortalAdminPerson): string {
    const value = CdrFactoryService.tryGetColumn(identity.GetEntity(), IdentitiesToValidateComponent.approvalStateColumnName)?.GetValue();
    return value == null ? '' : String(value);
  }
}

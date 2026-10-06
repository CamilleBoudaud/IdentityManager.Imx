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

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { SystemInfo } from '@imx-modules/imx-api-qbm';
import { ProjectConfig, QerProjectConfig, UserConfig } from '@imx-modules/imx-api-qer';
import { imx_SessionService, SplashService, SystemInfoService } from 'qbm';
import { ProjectConfigurationService } from '../../project-configuration/project-configuration.service';
import { PendingItemsType } from '../../user/pending-items-type.interface';
import { UserModelService } from '../../user/user-model.service';
import { DashboardService } from './dashboard.service';

@Component({
  templateUrl: './start.component.html',
  selector: 'imx-start',
  styleUrls: ['./start.component.scss'],
  standalone: false
})
export class StartComponent implements OnInit {
  /**
   * Identifies the "RH" application role, used to gate the HR identity-approval tile.
   * Confirmed via the live /portal/usergroups response: that endpoint returns this role as
   * { Uid: "CCC-0EF23BCEB6E1BA42886C55C800DBBBD2", Name: "CCC_RH" } — a different Uid format than
   * the raw UID_AERole from the PersonInAERole table, and a "CCC_" prefixed name.
   */
  private readonly uidHrRole = 'CCC-0EF23BCEB6E1BA42886C55C800DBBBD2';
  private readonly identHrRole = 'CCC_RH';

  public userConfig: UserConfig;
  public projectConfig: QerProjectConfig & ProjectConfig;
  public pendingItems: PendingItemsType;
  public systemInfo: SystemInfo;
  public viewReady: boolean;
  public userUid: string;
  public isHr = false;

  constructor(
    public readonly router: Router,
    private readonly dashboardService: DashboardService,
    private readonly userModelSvc: UserModelService,
    private readonly systemInfoService: SystemInfoService,
    private readonly sessionService: imx_SessionService,
    private readonly detectRef: ChangeDetectorRef,
    private readonly projectConfigurationService: ProjectConfigurationService,
    private readonly splash: SplashService,
  ) { }

  public async ngOnInit(): Promise<void> {
    this.dashboardService.busyStateChanged.subscribe((busy) => {
      this.viewReady = !busy;
      this.detectRef.detectChanges();
    });
    const busy = this.dashboardService.beginBusy();
    try {
      this.userModelSvc.reloadUserConfig();
      this.userConfig = await this.userModelSvc.getUserConfig();
      this.pendingItems = await this.userModelSvc.getPendingItems();
      this.projectConfig = await this.projectConfigurationService.getConfig();
      this.systemInfo = await this.systemInfoService.get();
      this.userUid = (await this.sessionService.getSessionState()).UserUid || '';
      const groups = await this.userModelSvc.getGroups();
      this.isHr = groups.some((group) => group?.Uid === this.uidHrRole || (group?.Name ?? '').toUpperCase() === this.identHrRole);
    } finally {
      this.splash.close();
      busy.endBusy();
    }
  }

  public ShowPasswordTile(): boolean {
    return this.userConfig?.ShowPasswordTile;
  }

  public ShowPasswordMgmtTile(): boolean {
    return (
      (this.projectConfig.PasswordConfig?.VI_MyData_MyPassword_Visibility && !!this.projectConfig.PasswordConfig?.PasswordMgmtUrl) ?? false
    );
  }

  public GoToMyPassword(): void {
    this.router.navigate(['profile', 'profile-password-questions']);
  }

  public GoToPasswordMgmtWeb(): void {
    let passwordMgmtUrl = this.projectConfig.PasswordConfig?.PasswordMgmtUrl
    if (passwordMgmtUrl) {
      passwordMgmtUrl = passwordMgmtUrl.match(/^https?:/) ? passwordMgmtUrl : '//' + passwordMgmtUrl;
      window.open(passwordMgmtUrl, '_self');
    }
  }

  public GoToShoppingCart(): void {
    this.router.navigate(['shoppingcart']);
  }

  public GoToProductSelection(): void {
    this.router.navigate(['newrequest']);
  }

  public GoToCreateIdentity(): void {
    this.router.navigate(['createidentity']);
  }

  public ShowHrApprovalsTile(): boolean {
    return this.isHr;
  }

  public GoToHrApprovals(): void {
    this.router.navigate(['identities-to-validate']);
  }

  public GoToItshopApprovals(): void {
    this.router.navigate(['itshop', 'approvals']);
  }

  public GoToItShopApprovalInquiries(): void {
    this.router.navigate(['itshop', 'approvals'], { queryParams: { inquiries: true } });
  }

  public GoToMyProcesses(): void {
    this.router.navigate(['/QBM_MyProcesses'], {});
  }

  public GoToRequestsEndingSoon(): void {
    this.router.navigate(['requesthistory'], { queryParams: { showEndingSoon: 1 } });
  }

  public ShowQpmIntegration(): boolean {
    return !!this.projectConfig.PasswordConfig?.QpmBaseUrl;
  }

  public GoToQpm(): void {
    this.router.navigate(['qpmintegration'], {});
  }

  public GoToDashboardEmployeesByRiskIndex(): void {
    // TODO (ADO 207303) this.router.navigate(['/VI_Start_Governance'], { Part: 'Risk' });
  }

  public GoToDashboardOrganization(): void {
    // TODO (ADO 207303) this.router.navigate(['/VI_Start_Governance'], { Part: 'Organization' });
  }

  public GoToDashboardRequests(): void {
    // TODO (ADO 207303) this.router.navigate(['/VI_Start_Governance'], { Part: 'ITShop' });
  }

  public GetCountProductsinShoppingCart(): number {
    return this.pendingItems?.CountProductsInShoppingCart;
  }

  public GetCountInRequestHistory(): number {
    return this.userConfig.CountPendingRequests;
  }

  public GetCountPendingRequests(): number {
    return this.pendingItems?.OpenPWO;
  }

  public GetCountRequestInquiries(): number {
    return this.pendingItems?.OpenInquiries;
  }

  public GetCountNewProcesses(): number {
    return 0; // hide for now
    // return this.pendingItems.NewProcesses;
  }

  public ShowPasswordLink(): boolean {
    // TODO (TFS 805999) not(isnullorempty(getconfig('VI_Common_PasswordWebLink')))
    return true;
  }

  public ShowNewRequestLink(): boolean {
    // Starting a new request is only allowed when the session has an identity and the ITShop(Requests) feature is enabled
    return (this.userConfig?.IsITShopEnabled && !!this.userUid?.length && this.systemInfo.PreProps?.includes('ITSHOP')) || false;
  }
}

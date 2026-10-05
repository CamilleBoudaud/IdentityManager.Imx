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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { EuiLoadingService } from '@elemental-ui/core';

import { PortalCartitem, PortalShopServiceitems } from '@imx-modules/imx-api-qer';
import { IEntityColumn } from '@imx-modules/imx-qbm-dbts';
import { ConfirmationService, imx_SessionService, MessageDialogResult, SnackBarService } from 'qbm';
import { ShelfService } from '../../itshop/shelf.service';
import { ExtendedEntityWrapper } from '../../parameter-data/extended-entity-wrapper.interface';
import { ParameterDataService } from '../../parameter-data/parameter-data.service';
import { PersonService } from '../../person/person.service';
import { ServiceItemsService } from '../../service-items/service-items.service';
import { CartItemsService } from '../../shopping-cart/cart-items.service';
import { RequestableProduct } from '../../shopping-cart/requestable-product.interface';
import { UserModelService } from '../../user/user-model.service';

/**
 * Simplified, self-service "create an identity" page.
 *
 * Shows a dropdown of the products found under the "Identity Creation" service category
 * (identified by its stable UID_AccProductGroup), and, once a product is picked, the
 * interactive request parameters for that product directly on the page. Submitting adds
 * the product to the current user's shopping cart and navigates there.
 */
@Component({
  selector: 'imx-create-identity',
  templateUrl: './create-identity.component.html',
  styleUrls: ['./create-identity.component.scss'],
  standalone: false,
})
export class CreateIdentityComponent implements OnInit, OnDestroy {
  /** UID_AccProductGroup of the "Identity Creation" service category. */
  private readonly uidIdentityCreationCategory = '2ff73067-6dc3-4561-94b9-2b58ce7a2719';

  public products: PortalShopServiceitems[] = [];
  public selectedProduct: PortalShopServiceitems | undefined;
  public columns: IEntityColumn[] = [];
  public cartItemForm = new UntypedFormGroup({});
  public isLoading = false;
  public isLoadingProducts = true;

  private selfUid = '';
  private selfDisplay = '';
  private draftEntityWrapper: ExtendedEntityWrapper<PortalCartitem> | undefined;
  private hasParameters = false;
  private submitted = false;
  private selectionToken = 0;

  constructor(
    private readonly router: Router,
    private readonly serviceItemsService: ServiceItemsService,
    private readonly shelfService: ShelfService,
    private readonly cartItemsProvider: CartItemsService,
    private readonly parameterDataService: ParameterDataService,
    private readonly personProvider: PersonService,
    private readonly userModelSvc: UserModelService,
    private readonly sessionService: imx_SessionService,
    private readonly busyIndicator: EuiLoadingService,
    private readonly snackbar: SnackBarService,
    private readonly confirmationService: ConfirmationService,
  ) {}

  public async ngOnInit(): Promise<void> {
    this.isLoadingProducts = true;
    try {
      this.selfUid = (await this.sessionService.getSessionState()).UserUid || '';
      this.selfDisplay = await this.getPersonDisplay(this.selfUid);

      const collection = await this.serviceItemsService.get({
        UID_AccProductGroup: this.uidIdentityCreationCategory,
        IncludeChildCategories: true,
        UID_Person: this.selfUid,
      });
      this.products = collection?.Data ?? [];
    } finally {
      this.isLoadingProducts = false;
    }
  }

  public ngOnDestroy(): void {
    if (!this.submitted) {
      // Fire and forget: best effort cleanup of an abandoned draft cart item.
      this.discardDraft();
    }
  }

  public async onProductSelected(product: PortalShopServiceitems | undefined): Promise<void> {
    const token = ++this.selectionToken;

    await this.discardDraft();
    this.columns = [];
    this.cartItemForm = new UntypedFormGroup({});
    this.hasParameters = false;
    this.selectedProduct = product;

    if (!product) {
      return;
    }

    this.isLoading = true;
    if (this.busyIndicator.overlayRefs.length === 0) {
      this.busyIndicator.show();
    }
    try {
      const requestable: RequestableProduct = this.serviceItemsService.getServiceItemsForPersons(
        [product],
        [{ DataValue: this.selfUid, DisplayValue: this.selfDisplay }],
      )[0];

      const canRequest = await this.shelfService.setShops([requestable]);
      if (token !== this.selectionToken) {
        return;
      }
      if (!canRequest || !requestable.UidITShopOrg) {
        this.snackbar.open({ key: '#LDS#This product cannot currently be requested.' });
        this.selectedProduct = undefined;
        return;
      }

      const posted = await this.cartItemsProvider.createAndPost(requestable, undefined);
      if (token !== this.selectionToken) {
        // The user has already selected a different product while this call was in flight.
        await this.cartItemsProvider.removeItems(posted.Data);
        return;
      }

      this.hasParameters = this.parameterDataService.hasParameters({
        Parameters: posted.extendedData?.Parameters,
        index: 0,
      });

      const key = this.cartItemsProvider.getKey(posted.Data[0]);
      this.draftEntityWrapper = await this.cartItemsProvider.getInteractiveCartitem(key);
      if (token !== this.selectionToken) {
        await this.discardDraft();
        return;
      }
      this.columns = (this.draftEntityWrapper.parameterCategoryColumns ?? []).map((item) => item.column);
    } finally {
      if (token === this.selectionToken) {
        this.isLoading = false;
      }
      this.busyIndicator.hide();
    }
  }

  public async addToCart(): Promise<void> {
    if (!this.draftEntityWrapper) {
      return;
    }

    this.isLoading = true;
    this.busyIndicator.show();
    try {
      if (this.hasParameters) {
        await this.cartItemsProvider.save(this.draftEntityWrapper);
      }
      this.submitted = true;
      await this.userModelSvc.reloadPendingItems();
    } finally {
      this.isLoading = false;
      this.busyIndicator.hide();
    }

    const goToCart = await this.confirmationService.confirmGeneral({
      Title: '#LDS#Demande enregistrée',
      Message:
        '#LDS#La demande a bien été enregistrée. Validez votre panier pour déclencher la validation RH. Vous serez ensuite notifié pour compléter les demandes de matériels et d’accès depuis l’IT Shop.',
      centerActions: true,
      customButtons: [{ title: '#LDS#OK', action: MessageDialogResult.OkResult, type: 'primary' }],
      identifier: 'create-identity-request-submitted',
    });
    if (goToCart) {
      this.router.navigate(['shoppingcart']);
    }
  }

  public compareProducts = (a: PortalShopServiceitems | undefined, b: PortalShopServiceitems | undefined): boolean =>
    (a?.GetEntity().GetKeys()[0] ?? '') === (b?.GetEntity().GetKeys()[0] ?? '');

  private async discardDraft(): Promise<void> {
    if (this.draftEntityWrapper) {
      const draft = this.draftEntityWrapper;
      this.draftEntityWrapper = undefined;
      try {
        await this.cartItemsProvider.removeItems([draft.typedEntity]);
      } catch {
        // Best effort: if the draft can't be removed here, it can still be cleaned up from the shopping cart later.
      }
    }
  }

  private async getPersonDisplay(uid: string): Promise<string> {
    const person = await this.personProvider.get(uid);
    if (person && person.Data.length) {
      return person.Data[0].GetEntity().GetDisplay();
    }
    return uid;
  }
}

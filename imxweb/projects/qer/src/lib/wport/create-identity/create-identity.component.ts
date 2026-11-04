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
import { AbstractControl, FormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { EuiLoadingService } from '@elemental-ui/core';

import { PortalCartitem, PortalShopServiceitems } from '@imx-modules/imx-api-qer';
import { IEntityColumn, ValType } from '@imx-modules/imx-qbm-dbts';
import { ConfirmationService, imx_SessionService, MessageDialogResult, SnackBarService } from 'qbm';
import { ShelfService } from '../../itshop/shelf.service';
import { ExtendedEntityWrapper } from '../../parameter-data/extended-entity-wrapper.interface';
import {
  // clearDependentColumns, // IAM-Custom (CCC disabled)
  // CONTRACT_TYPE_COLUMN, // IAM-Custom (CCC disabled)
  ENTRY_DATE_COLUMN,
  EXIT_DATE_COLUMN,
  exitDateValidator,
  findColumn,
  // IS_NO_PROFILE_TEMPLATE_COLUMN, // IAM-Custom (CCC disabled)
  isColumnHidden,
} from '../../parameter-data/hidden-columns';
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
  private readonly uidIdentityCreationCategory = '93d6a314-488b-4de8-a1f1-2a4d7e49358d';

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
  /** Form controls for boolean parameters, rendered as "Oui/Non" toggles instead of the default checkbox. */
  private readonly booleanControls = new Map<string, FormControl<boolean>>();
  // IAM-Custom (CCC disabled)
  // /** IAM-Custom: listener on CCC_ContractType, which is not a Yes/No toggle. */
  // private contractTypeSubscription: { unsubscribe: () => void } | undefined;
  /** IAM-Custom: ExitDate editor control, revalidated when EntryDate changes (see exitDateValidator). */
  private exitDateControl: AbstractControl | undefined;
  private entryDateSubscription: { unsubscribe: () => void } | undefined;

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
    // this.contractTypeSubscription?.unsubscribe(); // IAM-Custom (CCC disabled)
    this.entryDateSubscription?.unsubscribe(); // IAM-Custom
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
    this.booleanControls.clear();
    // this.contractTypeSubscription?.unsubscribe(); // IAM-Custom (CCC disabled)
    // this.contractTypeSubscription = undefined; // IAM-Custom (CCC disabled)
    this.entryDateSubscription?.unsubscribe(); // IAM-Custom
    this.entryDateSubscription = undefined;
    this.exitDateControl = undefined;
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
      const columns = (this.draftEntityWrapper.parameterCategoryColumns ?? []).map((item) => item.column);
      // IAM-Custom (CCC disabled): the "profile template" question starts on No, so CCC_ProfilTemplate is hidden at first
      // await findColumn(columns, IS_NO_PROFILE_TEMPLATE_COLUMN)?.PutValue(false);
      // if (token !== this.selectionToken) {
      //   return;
      // }
      this.columns = columns;
      // IAM-Custom (CCC disabled): CCC_Tutor depends on CCC_ContractType, its control is removed when it gets hidden
      // this.contractTypeSubscription = findColumn(columns, CONTRACT_TYPE_COLUMN)?.ColumnChanged.subscribe(() => this.removeHiddenControls());
      // IAM-Custom: ExitDate is checked again against the new EntryDate
      this.entryDateSubscription = findColumn(columns, ENTRY_DATE_COLUMN)?.ColumnChanged.subscribe(() =>
        this.exitDateControl?.updateValueAndValidity(),
      );
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

  /**
   * IAM-Custom: deferred like in BulkItemComponent.addControl: adding a control during change detection
   * changes "cartItemForm.invalid" after it was checked (NG0100 ExpressionChangedAfterItHasBeenCheckedError).
   */
  public addControl(name: string, control: AbstractControl): void {
    // IAM-Custom: an ExitDate before EntryDate or on the same day is refused, with a message under the field
    if (name.toLowerCase() === EXIT_DATE_COLUMN) {
      control.addValidators(exitDateValidator(this.columns));
      this.exitDateControl = control;
    }
    setTimeout(() => this.cartItemForm.addControl(name, control));
  }

  /** IAM-Custom: columns actually rendered, without the hidden ones (see isHidden). */
  public get visibleColumns(): IEntityColumn[] {
    return this.columns.filter((column) => !this.isHidden(column));
  }

  /** IAM-Custom: see isColumnHidden in parameter-data/hidden-columns.ts */
  public isHidden(column: IEntityColumn): boolean {
    return isColumnHidden(column, this.columns, this.booleanControls);
  }

  /** True for columns rendered as a boolean (Oui/Non) toggle instead of the default `imx-entity-column-editor` checkbox. */
  public isBoolean(column: IEntityColumn): boolean {
    return column?.GetMetadata().GetType() === ValType.Bool;
  }

  /** Label for a boolean parameter: the column's DisplayName (and translation) as configured in the database. */
  public getFieldDisplay(column: IEntityColumn): string {
    return column?.GetMetadata().GetDisplay() || '';
  }

  /**
   * Lazily creates (and reuses) the FormControl backing a boolean parameter's Oui/Non toggle.
   * Disabled (greyed out) when the user doesn't have edit rights on the column, same as the
   * default `imx-entity-column-editor` would fall back to a read-only view in that case.
   */
  public getBooleanControl(column: IEntityColumn): FormControl<boolean> {
    let control = this.booleanControls.get(column.ColumnName);
    if (!control) {
      control = new FormControl<boolean>({ value: !!column.GetValue(), disabled: !column.GetMetadata().CanEdit() }, { nonNullable: true });
      control.valueChanges.subscribe((value) => {
        column.PutValue(value);
        // clearDependentColumns(column, this.columns); // IAM-Custom (CCC disabled)
        this.removeHiddenControls(); // IAM-Custom
      });
      this.booleanControls.set(column.ColumnName, control);
      this.cartItemForm.addControl(column.ColumnName, control);
    }
    return control;
  }

  /** IAM-Custom: a hidden column must not keep its control, otherwise it could block "Add to cart". */
  private removeHiddenControls(): void {
    this.columns
      .filter((column) => this.isHidden(column))
      .forEach((column) => {
        this.cartItemForm.removeControl(column.ColumnName);
        this.booleanControls.delete(column.ColumnName);
      });
  }

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

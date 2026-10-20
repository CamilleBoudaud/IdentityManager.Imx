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

import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { AbstractControl, FormControl, UntypedFormGroup } from '@angular/forms';
import { EUI_SIDESHEET_DATA, EuiSidesheetRef } from '@elemental-ui/core';
import { Subscription } from 'rxjs';

import { PortalCartitem } from '@imx-modules/imx-api-qer';
import { CompareOperator, FilterType, IEntityColumn, ValType } from '@imx-modules/imx-qbm-dbts';
import { ConfirmationService, EntityColumnEditorComponent } from 'qbm';
import { clearDependentColumns, HIDE_STANDARD_FIELDS_CATEGORIES, isColumnHidden } from '../../parameter-data/hidden-columns';
import { ServiceItemsService } from '../../service-items/service-items.service';
import { CartItemsService } from '../cart-items.service';
import { CartItemEditParameter } from './cart-item-edit-parameter.interface';

@Component({
  templateUrl: './cart-item-edit.component.html',
  selector: 'imx-cart-item-edit',
  styleUrls: ['./cart-item-edit.component.scss'],
  standalone: false
})
export class CartItemEditComponent implements OnInit, OnDestroy {
  public readonly shoppingCartItem: PortalCartitem;
  public readonly cartItemForm = new UntypedFormGroup({});
  public formGroupIsPending = false;
  public columns: IEntityColumn[];
  private readonly subscriptions: Subscription[] = [];
  public orderReasonType: number;

  private justificationRequiresText: boolean = false;
  /** IAM-Custom: Form controls for boolean parameters, rendered as "Yes/No" toggles instead of the default checkbox. */
  private readonly booleanControls = new Map<string, FormControl<boolean>>();
  /** IAM-Custom: names of the standard request fields (reason, priority, dates...), hidden for some products. */
  private standardColumnNames: string[] = [];
  /** IAM-Custom: undefined until we know whether the product belongs to HIDE_STANDARD_FIELDS_CATEGORIES. */
  private hideStandardColumns: boolean | undefined;

  @ViewChildren(EntityColumnEditorComponent) editors: QueryList<EntityColumnEditorComponent>;

  constructor(
    @Inject(EUI_SIDESHEET_DATA) public readonly data: CartItemEditParameter,
    public readonly cartItemSvc: CartItemsService,
    public readonly sideSheetRef: EuiSidesheetRef,
    confirmation: ConfirmationService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly serviceItemsService: ServiceItemsService,
  ) {
    this.shoppingCartItem = this.data.entityWrapper.typedEntity;

    this.initColumns();
    this.initHideStandardColumns(); // IAM-Custom

    if (data.updated) {
      this.subscriptions.push(
        data.updated.subscribe(() => {
          this.editors.forEach((elem) => elem.update());
          // IAM-Custom: keep the Yes/No toggles in sync with values updated by the server
          this.columns
            .filter((column) => this.booleanControls.has(column.ColumnName))
            .forEach((column) => this.booleanControls.get(column.ColumnName)?.setValue(!!column.GetValue(), { emitEvent: false }));
          changeDetector.detectChanges();
        }),
      );
    }
    this.subscriptions.push(
      sideSheetRef.closeClicked().subscribe(async () => {
        if (this.cartItemForm.dirty && !(await confirmation.confirmLeaveWithUnsavedChanges())) {
          return;
        }

        sideSheetRef.close(false);
      }),
    );
  }

  public async ngOnInit(): Promise<void> {
    this.justificationRequiresText = await this.cartItemSvc.getJustificationTextIsRequired(
      this.shoppingCartItem.UID_QERJustificationOrder.value,
    );

    this.shoppingCartItem.UID_QERJustificationOrder.Column.ColumnChanged.subscribe(async () => {
      this.justificationRequiresText = await this.cartItemSvc.getJustificationTextIsRequired(
        this.shoppingCartItem.UID_QERJustificationOrder.value,
      );
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  public onPendingChanged(value: boolean) {
    this.formGroupIsPending = value;
  }

  /**
   * Adds a control to the card item after creation.
   * Removes old control with the name, to make sure, the new one is added correctly
   * @param name the name of the control
   * @param control the abstract control, that is registered
   */
  public addControlToCartItemForm(name: string, control: AbstractControl): void {
    this.cartItemForm.removeControl(name);
    this.changeDetector.detectChanges();
    this.cartItemForm.addControl(name, control);
    this.changeDetector.detectChanges();
    control.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  public isMandatory(column: IEntityColumn): boolean {
    switch (column.ColumnName) {
      case 'OrderReason':
        return this.orderReasonType === 2 || this.justificationRequiresText;
      case 'UID_QERJustificationOrder':
        return this.orderReasonType === 1;
    }

    return false;
  }

  /** IAM-Custom: columns actually rendered, without the hidden ones (see isHidden). */
  public get visibleColumns(): IEntityColumn[] {
    return this.columns.filter((column) => !this.isHidden(column));
  }

  /**
   * IAM-Custom: see isColumnHidden in parameter-data/hidden-columns.ts.
   * The standard request fields are also hidden for products of HIDE_STANDARD_FIELDS_CATEGORIES,
   * and while this is not known yet, so that they do not appear and then disappear.
   */
  public isHidden(column: IEntityColumn): boolean {
    if (this.hideStandardColumns !== false && this.standardColumnNames.includes(column.ColumnName)) {
      return true;
    }
    return isColumnHidden(column, this.columns, this.booleanControls);
  }

  /** IAM-Custom: True for columns rendered as a boolean (Yes/No) toggle instead of the default `imx-entity-column-editor` checkbox. */
  public isBoolean(column: IEntityColumn): boolean {
    return column?.GetMetadata().GetType() === ValType.Bool;
  }

  /** IAM-Custom: Label for a boolean parameter: the column's DisplayName (and translation) as configured in the database. */
  public getFieldDisplay(column: IEntityColumn): string {
    return column?.GetMetadata().GetDisplay() || '';
  }

  /**
   * IAM-Custom: Lazily creates (and reuses) the FormControl backing a boolean parameter's Yes/No toggle.
   * Disabled (greyed out) when the user doesn't have edit rights on the column.
   */
  public getBooleanControl(column: IEntityColumn): FormControl<boolean> {
    let control = this.booleanControls.get(column.ColumnName);
    if (!control) {
      control = new FormControl<boolean>({ value: !!column.GetValue(), disabled: !column.GetMetadata().CanEdit() }, { nonNullable: true });
      control.valueChanges.subscribe((value) => {
        column.PutValue(value);
        clearDependentColumns(column, this.columns); // IAM-Custom
        this.removeHiddenControls(); // IAM-Custom
      });
      this.booleanControls.set(column.ColumnName, control);
      this.cartItemForm.addControl(column.ColumnName, control);
    }
    return control;
  }

  /** IAM-Custom: a hidden column must not keep its control, otherwise it could block "Save". */
  private removeHiddenControls(): void {
    this.columns
      .filter((column) => this.isHidden(column))
      .forEach((column) => {
        this.cartItemForm.removeControl(column.ColumnName);
        this.booleanControls.delete(column.ColumnName);
      });
  }

  private initColumns(): void {
    let defaultColumns = [this.shoppingCartItem.OrderReason.Column, this.shoppingCartItem.UID_QERJustificationOrder.Column];
    if (!this.data.multiple) {
      defaultColumns.push(this.shoppingCartItem.PWOPriority.Column);
    }
    if (this.shoppingCartItem.RequestType.value === 'Prolongate' && !this.data.multiple) {
      defaultColumns.push(this.shoppingCartItem.ProlongationDate.Column);
    } else if (['Unsubscribe', 'UnsubscribeWithDate'].includes(this.shoppingCartItem.RequestType.value) && !this.data.multiple) {
      defaultColumns.push(this.shoppingCartItem.ValidUntilUnsubscribe.Column);
    } else {
      defaultColumns.push(this.shoppingCartItem.ValidFrom.Column, this.shoppingCartItem.ValidUntil.Column);
    }

    this.orderReasonType = this.shoppingCartItem.OrderReasonType.value;

    this.columns = this.mergeColumns(
      (this.data.entityWrapper.parameterCategoryColumns ?? []).map((item) => item.column),
      defaultColumns,
    );

    // IAM-Custom: standard request fields, hidden for the products of HIDE_STANDARD_FIELDS_CATEGORIES (see isHidden)
    this.standardColumnNames = defaultColumns.map((column) => column.ColumnName);
  }

  /**
   * IAM-Custom: checks whether the requested product belongs to one of HIDE_STANDARD_FIELDS_CATEGORIES,
   * by loading this product only (same filter as ServiceItemsService.getServiceItem) within each category.
   */
  private async initHideStandardColumns(): Promise<void> {
    try {
      for (const uidAccProductGroup of HIDE_STANDARD_FIELDS_CATEGORIES) {
        const serviceItems = await this.serviceItemsService.get({
          UID_AccProductGroup: uidAccProductGroup,
          IncludeChildCategories: true,
          UID_Person: this.shoppingCartItem.UID_PersonOrdered.value,
          filter: [
            {
              ColumnName: 'UID_AccProduct',
              Type: FilterType.Compare,
              CompareOp: CompareOperator.Equal,
              Value1: this.shoppingCartItem.UID_AccProduct.value,
            },
          ],
        });
        if ((serviceItems?.Data?.length ?? 0) > 0) {
          this.hideStandardColumns = true;
          return;
        }
      }
      this.hideStandardColumns = false;
    } catch (error) {
      // If the categories cannot be loaded, the standard fields are shown as in the OOB portal
      console.warn('IAM-Custom: cannot check the service category of the cart item', error);
      this.hideStandardColumns = false;
    }
  }

  private mergeColumns(columns: IEntityColumn[], columnsToAdd: IEntityColumn[]): IEntityColumn[] {
    return [...columns, ...columnsToAdd.filter((columnToAdd) => !columns.find((column) => column.ColumnName === columnToAdd.ColumnName))];
  }
}

/*
 * IAM-Custom: visibility rules for request parameters, shared by the "Create Identity" page
 * (CreateIdentityComponent) and the shopping cart item editor (CartItemEditComponent).
 */

import { FormControl } from '@angular/forms';
import { IEntityColumn } from '@imx-modules/imx-qbm-dbts';

/** IAM-Custom: CCC_ProfilTemplate is only shown when CCC_IsNoProfileTemplate is set to true. */
export const PROFILE_TEMPLATE_COLUMN = 'ccc_profiltemplate';
export const IS_NO_PROFILE_TEMPLATE_COLUMN = 'ccc_isnoprofiletemplate';

/**
 * IAM-Custom: service categories (UID_AccProductGroup) whose products are requested without the standard
 * request fields (reason, standard reason, priority, dates) in the shopping cart. Child categories are included.
 * To hide these fields for another product, move it into one of these categories or add its category here.
 */
export const HIDE_STANDARD_FIELDS_CATEGORIES = [
  '2ff73067-6dc3-4561-94b9-2b58ce7a2719', // Identity Creation
  '191a9c3f-154e-4df8-bf72-6c9dc362dfad', // Équipements informatiques
  'ffe5269d-4486-423c-a3e7-a08453e8490a', // Applications
];

/** IAM-Custom: finds a column by name, ignoring case. */
export function findColumn(columns: IEntityColumn[], columnName: string): IEntityColumn | undefined {
  return columns.find((column) => column.ColumnName.toLowerCase() === columnName);
}

/**
 * IAM-Custom: a column is hidden when its display starts with "hidden_",
 * CCC_ProfilTemplate is hidden unless CCC_IsNoProfileTemplate is true.
 * @param booleanControls the Yes/No toggle controls, they hold the latest value while the column may not be updated yet (PutValue is async)
 */
export function isColumnHidden(column: IEntityColumn, columns: IEntityColumn[], booleanControls: Map<string, FormControl<boolean>>): boolean {
  if (column.GetMetadata().GetDisplay()?.startsWith('hidden_')) {
    return true;
  }
  if (column.ColumnName.toLowerCase() === PROFILE_TEMPLATE_COLUMN) {
    const driver = findColumn(columns, IS_NO_PROFILE_TEMPLATE_COLUMN);
    const value = driver ? (booleanControls.get(driver.ColumnName)?.value ?? driver.GetValue()) : undefined;
    return !(value === true || `${value}`.toLowerCase() === 'true');
  }
  return false;
}

/** IAM-Custom: clears CCC_ProfilTemplate whenever CCC_IsNoProfileTemplate changes. */
export function clearDependentColumns(changedColumn: IEntityColumn, columns: IEntityColumn[]): void {
  if (changedColumn.ColumnName.toLowerCase() === IS_NO_PROFILE_TEMPLATE_COLUMN) {
    findColumn(columns, PROFILE_TEMPLATE_COLUMN)?.PutValue(undefined);
  }
}

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

import { Injectable } from '@angular/core';

import { PortalServicecategories } from '@imx-modules/imx-api-qer';
import { CollectionLoadParameters, EntitySchema, ExtendedTypedEntityCollection } from '@imx-modules/imx-qbm-dbts';

import { QerApiService } from '../../qer-api-client.service';
import { NewRequestOrchestrationService } from '../new-request-orchestration.service';

@Injectable({
  providedIn: 'root',
})
export class NewRequestCategoryApiService {
  /**
   * UID_AccProductGroup of the "Identity Creation" category. Hidden from the generic new-request
   * category tree/search because it is only meant to be requested through the dedicated
   * "Create Identity" tile (imx-create-identity), which fetches its products directly by this UID
   * and does not go through this tree.
   */
  private readonly uidHiddenCategories = ['93d6a314-488b-4de8-a1f1-2a4d7e49358d'];

  constructor(
    private readonly orchestration: NewRequestOrchestrationService,
    private readonly qerApi: QerApiService,
  ) {}

  public get schema(): EntitySchema {
    return PortalServicecategories.GetEntitySchema();
  }

  public async get(parameters: CollectionLoadParameters = {}): Promise<ExtendedTypedEntityCollection<any, unknown>> {
    const result = await this.qerApi.typedClient.PortalShopCategories.Get(parameters, {
      signal: this.orchestration.serviceCategoryAbortController.signal,
    });

    const data = result.Data.filter((category) => !this.uidHiddenCategories.includes(category.UID_AccProductGroup.value));
    return { ...result, Data: data, totalCount: result.totalCount - (result.Data.length - data.length) };
  }
}

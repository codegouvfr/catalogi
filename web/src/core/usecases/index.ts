// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as softwareCatalog from "./softwareCatalog";
import * as softwareDetails from "./softwareDetails";
import * as softwareForm from "./softwareForm";
import * as declarationForm from "./declarationForm";
import * as instanceForm from "./instanceForm";
import * as userAccountManagement from "./userAccountManagement";
import * as sillApiVersion from "./sillApiVersion";
import * as softwareUserAndReferent from "./softwareUserAndReferent";
import * as generalStats from "./generalStats";
import * as userAuthentication from "./userAuthentication";
import * as redirect from "./redirect";
import * as declarationRemoval from "./declarationRemoval";
import * as userProfile from "./userProfile";
import * as source from "./source.slice";
import * as uiConfig from "./uiConfig.slice";
import * as organizationList from "./organizationList";

export const usecases = {
    source,
    softwareCatalog,
    softwareDetails,
    softwareForm,
    uiConfig,
    declarationForm,
    instanceForm,
    userAccountManagement,
    organizationList,
    sillApiVersion,
    softwareUserAndReferent,
    generalStats,
    userAuthentication,
    redirect,
    declarationRemoval,
    userProfile
};

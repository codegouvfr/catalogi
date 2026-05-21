// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import * as account from "./account";
import * as addSoftwareLanding from "./addSoftwareLanding";
import * as declarationForm from "./declarationForm";
import * as home from "./home";
import * as instanceForm from "./instanceForm";
import * as page404 from "./page404";
import * as readme from "./readme";
import * as softwareCatalog from "./softwareCatalog";
import * as softwareDetails from "./softwareDetails";
import * as softwareForm from "./softwareForm";
import * as softwareUserAndReferent from "./softwareUserAndReferent";
import * as terms from "./terms";
import * as redirect from "./redirect";
import * as userProfile from "./userProfile";
import * as organizationList from "./organizationList";
import * as organizationDetails from "./orgnizationDetails";

import { objectKeys } from "tsafe/objectKeys";
import type { UnionToIntersection } from "tsafe";

export const pages = {
    account,
    addSoftwareLanding,
    declarationForm,
    home,
    instanceForm,
    readme,
    organizationList,
    organizationDetails,
    softwareCatalog,
    softwareDetails,
    softwareForm,
    softwareUserAndReferent,
    terms,
    redirect,
    userProfile,
    page404
};

export const routeDefs = {} as UnionToIntersection<
    (typeof pages)[keyof typeof pages]["routeDefs"]
>;

objectKeys(pages).forEach(pageName =>
    Object.assign(routeDefs, pages[pageName].routeDefs)
);

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { ServiceProvider } from "../usecases/readWriteSillData";

export type ServiceProvidersBySillId = Partial<Record<string, ServiceProvider[]>>;

export type GetServiceProviders = {
    (): Promise<ServiceProvidersBySillId>;
    clear: () => void;
};

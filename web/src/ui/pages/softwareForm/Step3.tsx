// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { NonPostableEvt } from "evt";
import type { FormData } from "core/usecases/softwareForm";
import { CustomAttributesForm } from "./CustomAttributeForm";

export type Step2Props = {
    className?: string;
    isCloudNativeSoftware: boolean;
    initialFormData: FormData["step3"] | undefined;
    onSubmit: (formData: FormData["step3"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
};

export function SoftwareFormStep3(props: Step2Props) {
    return <CustomAttributesForm {...props} />;
}

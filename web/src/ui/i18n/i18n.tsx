// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { createI18nApi, declareComponentKeys } from "i18nifty";
import type { Language } from "shared";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { statefulObservableToStatefulEvt } from "powerhooks/tools/StatefulObservable/statefulObservableToStatefulEvt";
import { z } from "zod";
import { createUnionSchema } from "ui/tools/zod/createUnionSchema";

export const languages = ["fr", "en"] as const satisfies Language[];
export { declareComponentKeys };

export const fallbackLanguage = "en";

export type LocalizedString = Parameters<typeof resolveLocalizedString>[0];

const {
    useTranslation,
    resolveLocalizedString,
    useLang,
    $lang,
    useResolveLocalizedString
} = createI18nApi<typeof import("ui/App").i18n>()(
    { languages, fallbackLanguage },
    {
        en: {
            App: {
                yes: "Yes",
                no: "No",
                "not applicable": "Not applicable",
                previous: "Previous",
                next: "Next",
                "add software": "Add Software",
                "update software": "Update Software",
                "add software or service": "Add Software or Service",
                "add instance": "Add Instance",
                "update instance": "Update Instance",
                required: "This field is required",
                "invalid url": 'Invalid URL. It must start with "http"',
                "invalid version": "The value must be numeric (e.g., 2.0.1)",
                all: "All",
                allFeminine: "All",
                loading: "Loading...",
                "no result": "No results",
                search: "Search",
                validate: "Validate",
                "not provided": "Not provided"
            }
        },
        fr: {
            /* spell-checker: disable */
            App: {
                yes: "Oui",
                no: "Non",
                "not applicable": "Non applicable",
                previous: "Précédent",
                next: "Suivant",
                "add software": "Ajouter un logiciel",
                "update software": "Mettre à jour un logiciel",
                "add software or service": "Ajouter un logiciel ou un service",
                "add instance": "Ajouter une instance",
                "update instance": "Modifier une instance",
                required: "Ce champ est requis",
                "invalid url": 'URL invalide. Elle doit commencer par "http"',
                "invalid version": "La valeur doit être numérique (Exemple : 2.0.1)",
                all: "Tous",
                allFeminine: "Toutes",
                loading: "Chargement...",
                "no result": "Aucun Résultat",
                search: "Rechercher",
                validate: "Valider",
                "not provided": "Non Renseigné"
            }
        }
    }
);

export { useTranslation, resolveLocalizedString, useLang, useResolveLocalizedString };

export const evtLang = statefulObservableToStatefulEvt({
    statefulObservable: $lang
});

export const zLocalizedString = z.union([
    z.string(),
    z.record(createUnionSchema(languages), z.string())
]);

{
    type Got = ReturnType<(typeof zLocalizedString)["parse"]>;
    type Expected = LocalizedString;

    assert<Equals<Got, Expected>>();
}

export const softwareCategoriesFrBySoftwareCategoryEn: Record<string, string> = {
    /* spell-checker: disable */
    "Operating Systems": "Systèmes d'exploitation",
    "Web Servers": "Serveurs Web",
    Databases: "Bases de données",
    "Programming Languages": "Langages de programmation",
    "Web Frameworks": "Frameworks Web",
    "Testing & CI/CD": "Tests & CI/CD",
    "Version Control": "Gestion de versions",
    "Virtualization & Containers": "Virtualisation & Conteneurs",
    "IDEs & Text Editors": "IDEs & Éditeurs de texte",
    "Project Management & Collaboration": "Gestion de projets & Collaboration",
    "Content Management Systems": "Systèmes de gestion de contenu",
    "E-Learning & Education": "E-Learning & Éducation",
    "Desktop Applications": "Applications de bureau",
    "Web Applications": "Applications Web",
    "Office & Productivity": "Bureautique & Productivité",
    "Security & Privacy": "Sécurité & Confidentialité",
    "Web Browsers & Extensions": "Navigateurs Web & Extensions",
    "Email Clients & Servers": "Clients de messagerie & Serveurs",
    "API Management & Networking": "Gestion d'API & Réseautage",
    GeoSpatial: "GéoSpatial",
    "Other Development Tools": "Autres outils de développement",
    Miscellaneous: "Divers"
    /* spell-checker: enable */
};

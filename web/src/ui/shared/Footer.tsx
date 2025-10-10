// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { memo, forwardRef } from "react";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { useTranslation } from "react-i18next";
import { Footer as DsfrFooter } from "@codegouvfr/react-dsfr/Footer";
import { routes } from "ui/routes";
import { headerFooterDisplayItem } from "@codegouvfr/react-dsfr/Display";
import { apiUrl } from "urls";
import { useCoreState } from "../../core";

export type Props = {
    className?: string;
    version: string;
};

export const Footer = memo(
    forwardRef<HTMLDivElement, Props>((props, ref) => {
        const { className, version, ...rest } = props;
        const uiConfig = useCoreState("uiConfig", "main")?.uiConfig;

        assert<Equals<typeof rest, {}>>();

        const { t } = useTranslation();

        return (
            <>
                <DsfrFooter
                    ref={ref}
                    className={className}
                    accessibility="fully compliant"
                    termsLinkProps={routes.terms().link}
                    bottomItems={[
                        {
                            text: `catalogi: v${version}`,
                            linkProps: {
                                href: `https://github.com/codegouvfr/sill/tree/v${version}`
                            }
                        },
                        {
                            text: t("footer.contribute"),
                            linkProps: {
                                href: "https://github.com/codegouvfr/sill/issues/new"
                            }
                        },
                        {
                            text: "XML feed",
                            linkProps: {
                                href: `https://code.gouv.fr/data/latest-sill.xml`
                            }
                        },
                        {
                            text: "json",
                            linkProps: {
                                href: `${apiUrl}/catalogi.json`
                            }
                        },
                        {
                            text: "pdf",
                            linkProps: {
                                href: "https://code.gouv.fr/data/sill.pdf"
                            }
                        },
                        {
                            text: "tsv",
                            linkProps: {
                                href: "https://code.gouv.fr/data/sill.tsv"
                            }
                        },
                        headerFooterDisplayItem
                    ]}
                    domains={uiConfig?.footer.domains}
                />
            </>
        );
    })
);

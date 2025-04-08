// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { memo, forwardRef } from "react";
import { assert } from "tsafe/assert";
import type { Equals } from "tsafe";
import { Trans, useTranslation } from "react-i18next";
import { Header as HeaderDsfr, HeaderProps } from "@codegouvfr/react-dsfr/Header";
import { routes } from "ui/routes";
import { useCoreState } from "../../../core";
import { LanguageSelect } from "./LanguageSelect";
import { AuthButtons, UserAuthenticationApi } from "./AuthButtons";

type Props = {
    className?: string;
    routeName: keyof typeof routes | false;
    userAuthenticationApi: UserAuthenticationApi;
};

export const Header = memo(
    forwardRef<HTMLDivElement, Props>((props, ref) => {
        const { className, routeName, userAuthenticationApi, ...rest } = props;
        const uiConfig = useCoreState("uiConfig", "main")?.uiConfig;

        assert<Equals<typeof rest, {}>>();

        const { t } = useTranslation();

        /*
        const { classes, cx } = useStyles({
            "isOnPageMyAccount": routeName === "account"
        });
        */
        const navigations = [];
        if (uiConfig?.header.menu.welcome.enabled) {
            navigations.push({
                isActive: routeName === routes.home.name,
                linkProps: routes.home().link,
                text: t("header.navigation welcome")
            });
        }
        if (uiConfig?.header.menu.catalog.enabled) {
            navigations.push({
                isActive:
                    routeName === routes.softwareCatalog.name ||
                    routeName === routes.softwareDetails.name ||
                    routeName === routes.softwareUsersAndReferents.name,
                linkProps: routes.softwareCatalog().link,
                text: t("header.navigation catalog")
            });
        }
        if (uiConfig?.header.menu.addSoftware.enabled) {
            navigations.push({
                isActive:
                    routeName === routes.addSoftwareLanding.name ||
                    routeName === routes.softwareUpdateForm.name ||
                    routeName === routes.softwareCreationForm.name,
                linkProps: routes.addSoftwareLanding().link,
                text:
                    routeName === routes.softwareUpdateForm.name
                        ? t("header.navigation update software")
                        : t("header.navigation add software")
            });
        }
        if (uiConfig?.header.menu.about.enabled) {
            navigations.push({
                isActive: routeName === routes.readme.name,
                linkProps: routes.readme().link,
                text: t("header.navigation about")
            });
        }
        if (uiConfig?.header.menu.contribute.enabled) {
            navigations.push({
                linkProps: {
                    target: "_blank",
                    href: uiConfig.header.menu.contribute.href
                },
                text: t("header.navigation support request")
            });
        }

        const link: HeaderProps.QuickAccessItem | null =
            uiConfig?.header.link && uiConfig.header.link.enabled
                ? {
                      iconId: "fr-icon-bank-fill",
                      linkProps: uiConfig.header.link.linkProps,
                      text: uiConfig.header.link.text
                  }
                : null;

        const quickAccess: Array<JSX.Element | HeaderProps.QuickAccessItem> = [
            <LanguageSelect />,
            ...(link ? [link] : []),
            <AuthButtons
                isOnPageMyAccount={routeName === "account"}
                userAuthenticationApi={userAuthenticationApi}
            />
        ];

        return (
            <HeaderDsfr
                ref={ref}
                className={className}
                brandTop={<Trans i18nKey={"header.siteTitle"} />}
                serviceTitle={t("header.title")}
                homeLinkProps={{
                    ...routes.home().link,
                    title: t("header.home title")
                }}
                quickAccessItems={quickAccess}
                navigation={navigations}
            />
        );
    })
);

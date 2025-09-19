// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useLang } from "ui/i18n";
import { Trans, useTranslation } from "react-i18next";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { shortEndMonthDate, monthDate } from "ui/datetimeUtils";
import Tooltip from "@mui/material/Tooltip";
import { capitalize } from "tsafe/capitalize";
import { useCoreState } from "../../../core";
import { CnllServiceProviderModal } from "./CnllServiceProviderModal";
import { assert, type Equals } from "tsafe/assert";
import { Identifier, SoftwareType } from "api/dist/src/lib/ApiTypes";
import { SoftwareTypeTable } from "ui/shared/SoftwareTypeTable";
import { LogoURLButton } from "ui/shared/LogoURLButton";
import { ApiTypes } from "api";

//TODO: Do not use optional props (?) use ( | undefined ) instead
// so we are sure that we don't forget to provide some props
export type Props = {
    className?: string;
    softwareName: string;
    softwareCurrentVersion?: string;
    softwareDateCurrentVersion?: number;
    softwareDescription: string;
    registerDate?: number;
    minimalVersionRequired?: string;
    license?: string;
    serviceProviders: ApiTypes.Organization[];
    hasDesktopApp: boolean | undefined;
    isAvailableAsMobileApp: boolean | undefined;
    isPresentInSupportMarket: boolean | undefined;
    isFromFrenchPublicService: boolean | undefined;
    isRGAACompliant?: boolean | undefined;
    programmingLanguages: string[];
    keywords?: string[];
    applicationCategories: string[];
    softwareType: SoftwareType;
    identifiers: Identifier[];
    officialWebsiteUrl?: string;
};
export const PreviewTab = (props: Props) => {
    const {
        softwareName,
        softwareCurrentVersion,
        softwareDateCurrentVersion,
        softwareDescription,
        registerDate,
        minimalVersionRequired,
        license,
        hasDesktopApp,
        isAvailableAsMobileApp,
        isPresentInSupportMarket,
        isFromFrenchPublicService,
        isRGAACompliant,
        serviceProviders,
        programmingLanguages,
        keywords,
        applicationCategories,
        softwareType,
        identifiers,
        officialWebsiteUrl
    } = props;
    const uiConfig = useCoreState("uiConfig", "main");

    const { classes, cx } = useStyles();

    const { t } = useTranslation();
    const { lang } = useLang();

    return (
        <>
            <section className={classes.tabContainer}>
                <p style={{ gridColumn: "span 2" }}>{softwareDescription}</p>
                {uiConfig?.softwareDetails.details.enabled && (
                    <div className="section">
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.about")}
                        </p>
                        {(uiConfig?.softwareDetails.details.fields
                            .softwareCurrentVersion ||
                            uiConfig?.softwareDetails.details.fields
                                .softwareCurrentVersionDate) &&
                            (softwareCurrentVersion || softwareDateCurrentVersion) && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.last version")}
                                    </span>
                                    {uiConfig?.softwareDetails.details.fields
                                        .softwareCurrentVersion &&
                                        softwareCurrentVersion && (
                                            <span
                                                className={cx(
                                                    fr.cx(
                                                        "fr-badge",
                                                        "fr-badge--yellow-tournesol",
                                                        "fr-badge--sm"
                                                    ),
                                                    classes.badgeVersion
                                                )}
                                            >
                                                {softwareCurrentVersion}
                                            </span>
                                        )}

                                    {uiConfig?.softwareDetails.details.fields
                                        .softwareCurrentVersionDate &&
                                        softwareDateCurrentVersion &&
                                        capitalize(
                                            shortEndMonthDate({
                                                time: softwareDateCurrentVersion,
                                                lang
                                            })
                                        )}
                                </p>
                            )}
                        {uiConfig?.softwareDetails.details.fields.registerDate &&
                            registerDate && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.register")}
                                    </span>
                                    {capitalize(monthDate({ time: registerDate, lang }))}
                                </p>
                            )}

                        {uiConfig?.softwareDetails.details.fields.license && license && (
                            <p className={cx(fr.cx("fr-text--regular"), classes.item)}>
                                <span className={classes.labelDetail}>
                                    {t("previewTab.license")}
                                </span>
                                <span>{license}</span>
                            </p>
                        )}
                    </div>
                )}

                {uiConfig?.softwareDetails.prerogatives.enabled && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.prerogatives")}
                        </p>

                        {(
                            [
                                "hasDesktopApp",
                                "isAvailableAsMobileApp",
                                "isPresentInSupportMarket",
                                "isFromFrenchPublicService",
                                "isRGAACompliant"
                            ] as const
                        ).map(prerogativeName => {
                            const value = (() => {
                                switch (prerogativeName) {
                                    case "hasDesktopApp":
                                        return hasDesktopApp;
                                    case "isAvailableAsMobileApp":
                                        return isAvailableAsMobileApp;
                                    case "isFromFrenchPublicService":
                                        return isFromFrenchPublicService;
                                    case "isPresentInSupportMarket":
                                        return isPresentInSupportMarket;
                                    case "isRGAACompliant":
                                        return isRGAACompliant;
                                }
                                assert<Equals<typeof prerogativeName, never>>(false);
                            })();

                            if (value === undefined) {
                                return null;
                            }

                            const label = t(`previewTab.${prerogativeName}`);

                            return (
                                <div
                                    key={label}
                                    className={cx(classes.item, classes.prerogativeItem)}
                                >
                                    <i
                                        className={cx(
                                            fr.cx(
                                                value
                                                    ? "fr-icon-check-line"
                                                    : "fr-icon-close-line"
                                            ),
                                            value
                                                ? classes.prerogativeStatusSuccess
                                                : classes.prerogativeStatusError
                                        )}
                                    />
                                    <p
                                        className={cx(
                                            fr.cx("fr-text--md"),
                                            classes.prerogativeItemDetail
                                        )}
                                    >
                                        {label}
                                    </p>
                                    {prerogativeName === "isPresentInSupportMarket" && (
                                        <Tooltip
                                            title={
                                                <Trans
                                                    i18nKey="previewTab.what is the support market"
                                                    components={{
                                                        a: (
                                                            /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                                            <a href="https://code.gouv.fr/fr/utiliser/marches-interministeriels-support-expertise-logiciels-libres/" />
                                                        )
                                                    }}
                                                />
                                            }
                                            arrow
                                        >
                                            <i
                                                className={fr.cx(
                                                    "fr-icon-information-line"
                                                )}
                                            />
                                        </Tooltip>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {uiConfig?.softwareDetails.metadata.enabled && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.metadata")}
                        </p>
                        {uiConfig?.softwareDetails.metadata.fields.keywords &&
                            keywords &&
                            keywords.length > 0 && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.keywords")} :{" "}
                                    </span>
                                    <span>{keywords.join(", ")}</span>
                                </p>
                            )}

                        {uiConfig?.softwareDetails.metadata.fields.programmingLanguages &&
                            programmingLanguages &&
                            programmingLanguages.length > 0 && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.programming languages")} :{" "}
                                    </span>
                                    <span>{programmingLanguages.join(", ")}</span>
                                </p>
                            )}

                        {uiConfig?.softwareDetails.metadata.fields
                            .applicationCategories &&
                            applicationCategories &&
                            applicationCategories.length > 0 && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.application categories")} :{" "}
                                    </span>
                                    <span>{applicationCategories.join(", ")}</span>
                                </p>
                            )}

                        {uiConfig?.softwareDetails.metadata.fields.softwareType &&
                            applicationCategories &&
                            applicationCategories.length > 0 && (
                                <p
                                    className={cx(
                                        fr.cx("fr-text--regular"),
                                        classes.item
                                    )}
                                >
                                    <span className={classes.labelDetail}>
                                        {t("previewTab.softwareType")} :{" "}
                                    </span>
                                    <span>
                                        {t(
                                            `previewTab.softwareType-${softwareType.type}`
                                        )}
                                    </span>
                                    {softwareType?.type === "desktop/mobile" && (
                                        <SoftwareTypeTable
                                            title="Test"
                                            softwareType={softwareType}
                                        />
                                    )}
                                </p>
                            )}
                    </div>
                )}

                {uiConfig?.softwareDetails.links.enabled && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.use full links")}
                        </p>
                        {identifiers && (
                            <>
                                {identifiers
                                    .filter(identifier => {
                                        const identifierURLString =
                                            identifier?.url?.toString();
                                        return (
                                            !officialWebsiteUrl ||
                                            (officialWebsiteUrl &&
                                                identifierURLString &&
                                                !officialWebsiteUrl.startsWith(
                                                    identifierURLString
                                                ))
                                        );
                                    })
                                    .map(identifier => (
                                        <LogoURLButton
                                            key={identifier.url?.toString()}
                                            className={cx(fr.cx("fr-ml-4v", "fr-my-2v"))}
                                            priority="secondary"
                                            url={identifier.url}
                                            labelFromURL={true}
                                        />
                                    ))}
                            </>
                        )}
                    </div>
                )}
            </section>
            <CnllServiceProviderModal
                softwareName={softwareName}
                annuaireCnllServiceProviders={serviceProviders.filter(provider => {
                    return provider.identifiers?.some(identifier => {
                        return identifier.subjectOf?.additionalType === "CNLL";
                    });
                })}
            />
        </>
    );
};

const useStyles = tss.withName({ PreviewTab }).create({
    tabContainer: {
        display: "grid",
        gridTemplateColumns: `repeat(2, 1fr)`,
        columnGap: fr.spacing("4v"),
        rowGap: fr.spacing("3v"),
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: `repeat(1, 1fr)`
        }
    },
    section: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start"
    },
    item: {
        "&:not(:last-of-type)": {
            marginBottom: fr.spacing("4v")
        }
    },
    prerogativeItem: {
        display: "flex",
        alignItems: "center",
        marginBottom: "24px"
    },
    prerogativeItemDetail: {
        color: fr.colors.decisions.text.label.grey.default,
        ...fr.spacing("margin", {
            left: "3v",
            right: "1v",
            bottom: 0
        })
    },
    prerogativeStatusSuccess: {
        color: fr.colors.decisions.text.default.success.default
    },
    prerogativeStatusError: {
        color: fr.colors.decisions.text.default.error.default
    },
    labelDetail: {
        color: fr.colors.decisions.text.mention.grey.default
    },
    badgeVersion: {
        ...fr.spacing("margin", { rightLeft: "2v" })
    },
    externalLink: {
        color: fr.colors.decisions.text.actionHigh.blueFrance.default
    }
});

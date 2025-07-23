// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { CustomAttributes } from "api/dist/src/core/usecases/readWriteSillData/attributeTypes";
import { id } from "tsafe/id";
import { useLang } from "ui/i18n";
import { useTranslation } from "react-i18next";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { shortEndMonthDate, monthDate, useFormattedDate } from "ui/datetimeUtils";
import { capitalize } from "tsafe/capitalize";
import { useCoreState } from "../../../core";
import { SupportedPlatforms } from "../../../core/usecases/softwareCatalog";
import { CnllServiceProviderModal } from "./CnllServiceProviderModal";
import { Identifier, SoftwareType } from "api/dist/src/lib/ApiTypes";
import { SoftwareTypeTable } from "ui/shared/SoftwareTypeTable";
import { LogoURLButton } from "ui/shared/LogoURLButton";
import { ApiTypes } from "api";
import { CustomAttributeDetails } from "./CustomAttributeDetails";
import { Chip } from "@mui/material";

//TODO: Do not use optional props (?) use ( | undefined ) instead
// so we are sure that we don't forget to provide some props
export type Props = {
    className?: string;
    softwareName: string;
    softwareCurrentVersion?: string;
    softwareDateCurrentVersion?: number;
    softwareDescription: string;
    registerDate?: number;
    license?: string;
    serviceProviders: ApiTypes.Organization[];
    supportedPlatforms: SupportedPlatforms;
    customAttributes: CustomAttributes | undefined;
    programmingLanguages: string[];
    keywords?: string[];
    applicationCategories: string[];
    softwareType: ApiTypes.SoftwareType;
    identifiers: ApiTypes.Identifier[];
    officialWebsiteUrl?: string;
    repoMetadata?: ApiTypes.RepoMetadata;
};
export const PreviewTab = (props: Props) => {
    const {
        softwareName,
        softwareCurrentVersion,
        softwareDateCurrentVersion,
        softwareDescription,
        registerDate,
        license,
        supportedPlatforms,
        customAttributes,
        serviceProviders,
        programmingLanguages,
        keywords,
        applicationCategories,
        softwareType,
        identifiers,
        officialWebsiteUrl,
        repoMetadata
    } = props;
    const { uiConfig, attributeDefinitions } = useCoreState("uiConfig", "main")!;

    const { classes, cx } = useStyles();

    const { t } = useTranslation();
    const { lang } = useLang();

    const scoreToLabel = (score: number) => {
        if (score < 0.1) return "error";
        if (score < 0.34) return "warning";
        if (score < 0.67) return "info";
        return "success";
    };

    const usefulLinks = identifiers
        .filter(identifier => {
            const identifierURLString = identifier?.url?.toString();
            return (
                !officialWebsiteUrl ||
                (officialWebsiteUrl &&
                    identifierURLString &&
                    !officialWebsiteUrl.startsWith(identifierURLString))
            );
        })
        .reduce((acc, identifier) => {
            // make sure we don't have duplicate links
            const url = identifier.url ?? identifier.subjectOf?.url;
            if (!url) return acc;
            const domain = new URL(url).hostname.replace("www.", "");
            if (
                acc.some(i => {
                    const iUrl = i.url ?? i.subjectOf?.url;
                    if (!iUrl) return false;
                    const iDomain = new URL(iUrl).hostname.replace("www.", "");
                    return iDomain === domain;
                })
            ) {
                return acc;
            }
            acc.push(identifier);
            return acc;
        }, [] as Identifier[]);

    return (
        <>
            <section className={classes.tabContainer}>
                <p style={{ gridColumn: "span 2" }}>{softwareDescription}</p>
                {uiConfig.softwareDetails.details.enabled && (
                    <div className="section">
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.about")}
                        </p>
                        {(uiConfig.softwareDetails.details.fields
                            .softwareCurrentVersion ||
                            uiConfig.softwareDetails.details.fields
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
                                    {uiConfig.softwareDetails.details.fields
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

                                    {uiConfig.softwareDetails.details.fields
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
                        {uiConfig.softwareDetails.details.fields.registerDate &&
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

                        {uiConfig.softwareDetails.details.fields.license && license && (
                            <p className={cx(fr.cx("fr-text--regular"), classes.item)}>
                                <span className={classes.labelDetail}>
                                    {t("previewTab.license")}
                                </span>
                                <span>{license}</span>
                            </p>
                        )}
                    </div>
                )}

                {uiConfig.softwareDetails.customAttributes.enabled && (
                    <div className={cx(classes.section, fr.cx("fr-mb-4v"))}>
                        {Object.keys(supportedPlatforms).length > 0 && (
                            <>
                                <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                                    {t("previewTab.supportedPlatforms")}
                                </p>
                                <CustomAttributeDetails
                                    customAttributes={supportedPlatforms}
                                    attributeDefinitions={[
                                        {
                                            name: id<keyof SupportedPlatforms>(
                                                "hasDesktopApp"
                                            ),
                                            label: t("previewTab.hasDesktopApp"),
                                            kind: "boolean",
                                            displayInDetails: true
                                        },
                                        {
                                            name: id<keyof SupportedPlatforms>(
                                                "isAvailableAsMobileApp"
                                            ),
                                            label: t("previewTab.isAvailableAsMobileApp"),
                                            kind: "boolean",
                                            displayInDetails: true
                                        }
                                    ]}
                                />
                            </>
                        )}

                        {customAttributes && Object.keys(customAttributes).length > 0 && (
                            <>
                                <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                                    {t("previewTab.customAttributesTitle")}
                                </p>
                                <CustomAttributeDetails
                                    customAttributes={customAttributes}
                                    attributeDefinitions={attributeDefinitions}
                                />
                            </>
                        )}
                    </div>
                )}

                {uiConfig.softwareDetails.metadata.enabled && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.metadata")}
                        </p>
                        {uiConfig.softwareDetails.metadata.fields.keywords &&
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

                        {uiConfig.softwareDetails.metadata.fields.programmingLanguages &&
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

                        {uiConfig.softwareDetails.metadata.fields.applicationCategories &&
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

                        {uiConfig.softwareDetails.metadata.fields.softwareType &&
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

                {uiConfig.softwareDetails.links.enabled && usefulLinks.length > 0 && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.useful links")}
                        </p>

                        {usefulLinks.map(identifier => {
                            const url = identifier.url ?? identifier.subjectOf?.url;

                            if (!url) return null;

                            return (
                                <LogoURLButton
                                    key={url?.toString()}
                                    className={cx(fr.cx("fr-ml-4v", "fr-my-2v"))}
                                    priority="secondary"
                                    url={url}
                                    labelFromURL={true}
                                />
                            );
                        })}
                    </div>
                )}
                {uiConfig?.softwareDetails.repoMetadata.enabled && repoMetadata && (
                    <div className={classes.section}>
                        <p className={cx(fr.cx("fr-text--bold"), classes.item)}>
                            {t("previewTab.repoMetadata")}
                        </p>
                        {repoMetadata?.healthCheck?.lastClosedIssue && (
                            <p className={cx(fr.cx("fr-text--regular"), classes.item)}>
                                <span className={classes.labelDetail}>
                                    {t("previewTab.repoLastClosedIssue")} :{" "}
                                </span>
                                <span>
                                    {useFormattedDate({
                                        time: repoMetadata.healthCheck.lastClosedIssue,
                                        showTime: false
                                    })}
                                </span>
                            </p>
                        )}
                        {repoMetadata?.healthCheck?.lastClosedIssuePullRequest && (
                            <p className={cx(fr.cx("fr-text--regular"), classes.item)}>
                                <span className={classes.labelDetail}>
                                    {t("previewTab.repoLastClosedIssuePullRequest")}{" "}
                                    :{" "}
                                </span>
                                <span>
                                    {useFormattedDate({
                                        time: repoMetadata.healthCheck
                                            .lastClosedIssuePullRequest,
                                        showTime: false
                                    })}
                                </span>
                            </p>
                        )}
                        {repoMetadata?.healthCheck?.lastCommit && (
                            <p className={cx(fr.cx("fr-text--regular"), classes.item)}>
                                <span className={classes.labelDetail}>
                                    {t("previewTab.repoLastCommit")} :{" "}
                                </span>
                                <span>
                                    {useFormattedDate({
                                        time: repoMetadata.healthCheck.lastCommit,
                                        showTime: false
                                    })}
                                </span>
                            </p>
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

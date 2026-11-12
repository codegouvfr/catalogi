// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { id } from "tsafe/id";
import { useLang } from "ui/i18n";
import { useTranslation } from "react-i18next";
import { fr } from "@codegouvfr/react-dsfr";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { tss } from "tss-react";
import { getFormattedDate, monthDate } from "ui/datetimeUtils";
import { useCoreState } from "../../../core";
import { SupportedPlatforms } from "../../../core/usecases/softwareCatalog";
import { CnllServiceProviderModal } from "./CnllServiceProviderModal";
import { osLabels } from "ui/shared/osLabels";
import { osValues, type ApiTypes } from "api";
import {
    CustomAttributeLabel,
    CustomAttributeValue,
    getDisplayedCustomAttributes
} from "./CustomAttributeDetails";
import { DetailList, DetailSubsection, type DetailRow } from "./DetailSection";

//TODO: Do not use optional props (?) use ( | undefined ) instead
// so we are sure that we don't forget to provide some props
export type Props = {
    className?: string;
    name: string;
    softwareCurrentVersion?: string;
    softwareDateCurrentVersion?: string;
    registerDate?: string;
    license?: string;
    providers: ApiTypes.Organization[];
    supportedPlatforms: SupportedPlatforms;
    customAttributes: ApiTypes.CustomAttributes | undefined;
    programmingLanguages: string[];
    keywords?: string[];
    applicationCategories: string[];
    operatingSystems: Partial<Record<string, boolean>>;
    runtimePlatforms: string[];
    repoMetadata?: ApiTypes.RepoMetadata;
};
export const PreviewTab = (props: Props) => {
    const {
        name: softwareName,
        softwareCurrentVersion,
        softwareDateCurrentVersion,
        registerDate,
        license,
        supportedPlatforms,
        customAttributes,
        providers,
        programmingLanguages,
        keywords,
        applicationCategories,
        operatingSystems,
        runtimePlatforms,
        repoMetadata
    } = props;
    const { uiConfig, attributeDefinitions } = useCoreState("uiConfig", "main")!;

    const { classes, cx } = useStyles();

    const { t } = useTranslation();
    const { lang } = useLang();

    const {
        details,
        metadata,
        repoMetadata: repoMetadataConfig
    } = uiConfig.softwareDetails;

    const rows: DetailRow[] = [];

    if (
        metadata.enabled &&
        metadata.fields.applicationCategories &&
        applicationCategories.length > 0
    ) {
        rows.push({
            key: "applicationCategories",
            label: t("previewTab.application categories"),
            value: (
                <ul className={cx(fr.cx("fr-tags-group"), classes.tags)}>
                    {applicationCategories.map(category => (
                        <li key={category}>
                            <Tag small>{category}</Tag>
                        </li>
                    ))}
                </ul>
            )
        });
    }

    if (details.enabled) {
        const version = details.fields.softwareCurrentVersion
            ? softwareCurrentVersion
            : undefined;
        const versionDate = details.fields.softwareCurrentVersionDate
            ? softwareDateCurrentVersion
            : undefined;

        if (version || versionDate) {
            rows.push({
                key: "latestVersion",
                label: t("previewTab.last version"),
                value: (
                    <span className={classes.latestVersion}>
                        {version && (
                            <span
                                className={cx(
                                    fr.cx("fr-badge", "fr-badge--sm"),
                                    classes.versionBadge
                                )}
                            >
                                {version}
                            </span>
                        )}
                        {versionDate && monthDate({ time: versionDate, lang })}
                    </span>
                )
            });
        }

        if (details.fields.registerDate && registerDate) {
            rows.push({
                key: "registerDate",
                label: t("previewTab.register"),
                value: monthDate({ time: registerDate, lang })
            });
        }

        if (details.fields.license && license) {
            rows.push({
                key: "license",
                label: t("previewTab.license"),
                value: license
            });
        }
    }

    if (metadata.enabled) {
        if (metadata.fields.keywords && keywords && keywords.length > 0) {
            rows.push({
                key: "keywords",
                label: t("previewTab.keywords"),
                value: keywords.join(", ")
            });
        }

        if (metadata.fields.programmingLanguages && programmingLanguages.length > 0) {
            rows.push({
                key: "programmingLanguages",
                label: t("previewTab.programming languages"),
                value: programmingLanguages.join(", ")
            });
        }

        if (
            metadata.fields.runtimePlatforms &&
            (runtimePlatforms.length > 0 || Object.keys(operatingSystems).length > 0)
        ) {
            rows.push({
                key: "softwareType",
                label: t("previewTab.softwareType"),
                value: runtimePlatforms.includes("cloud")
                    ? t("previewTab.softwareType-cloud")
                    : runtimePlatforms.includes("desktop")
                      ? t("previewTab.softwareType-desktop/mobile")
                      : t("previewTab.softwareType-stack")
            });

            // Same rule as the former table: every OS is listed once at least one is known
            if (Object.values(operatingSystems).some(Boolean)) {
                rows.push({
                    key: "operatingSystems",
                    label: t("previewTab.supportedOS"),
                    value: (
                        <ul className={classes.operatingSystems}>
                            {osValues.map(os => {
                                const isSupported = operatingSystems[os] === true;
                                return (
                                    <li key={os} className={classes.operatingSystem}>
                                        <i
                                            aria-hidden="true"
                                            className={cx(
                                                fr.cx(
                                                    isSupported
                                                        ? "fr-icon-check-line"
                                                        : "fr-icon-close-line",
                                                    "fr-icon--sm"
                                                ),
                                                isSupported
                                                    ? classes.success
                                                    : classes.error
                                            )}
                                        />
                                        {osLabels[os]}
                                        <span className={fr.cx("fr-sr-only")}>
                                            {isSupported ? t("app.yes") : t("app.no")}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )
                });
            }
        }
    }

    if (uiConfig.softwareDetails.customAttributes.enabled) {
        const displayedCustomAttributes = [
            ...getDisplayedCustomAttributes({
                customAttributes: supportedPlatforms,
                attributeDefinitions: [
                    {
                        name: id<keyof SupportedPlatforms>("hasDesktopApp"),
                        label: t("previewTab.hasDesktopApp"),
                        kind: "boolean",
                        displayInDetails: true
                    },
                    {
                        name: id<keyof SupportedPlatforms>("isAvailableAsMobileApp"),
                        label: t("previewTab.isAvailableAsMobileApp"),
                        kind: "boolean",
                        displayInDetails: true
                    }
                ]
            }),
            ...getDisplayedCustomAttributes({
                customAttributes,
                attributeDefinitions: attributeDefinitions.filter(
                    ({ detailsSubsection }) => detailsSubsection === undefined
                )
            })
        ];

        displayedCustomAttributes.forEach(displayedCustomAttribute =>
            rows.push({
                key: `customAttribute-${displayedCustomAttribute.attributeDefinition.name}`,
                label: (
                    <CustomAttributeLabel
                        attributeDefinition={displayedCustomAttribute.attributeDefinition}
                    />
                ),
                value: <CustomAttributeValue {...displayedCustomAttribute} />,
                isWide: displayedCustomAttribute.attributeDefinition.kind === "text"
            })
        );
    }

    if (repoMetadataConfig.enabled && repoMetadata?.healthCheck !== undefined) {
        const { lastClosedIssue, lastClosedIssuePullRequest, lastCommit } =
            repoMetadata.healthCheck;
        const formatRepoDate = (time: string) =>
            getFormattedDate({ time, lang, showTime: false, doAlwaysShowYear: true });

        if (lastClosedIssue) {
            rows.push({
                key: "repoLastClosedIssue",
                label: t("previewTab.repoLastClosedIssue"),
                value: formatRepoDate(lastClosedIssue.dateModified)
            });
        }
        if (lastClosedIssuePullRequest) {
            rows.push({
                key: "repoLastClosedIssuePullRequest",
                label: t("previewTab.repoLastClosedIssuePullRequest"),
                value: formatRepoDate(lastClosedIssuePullRequest.dateModified)
            });
        }
        if (lastCommit) {
            rows.push({
                key: "repoLastCommit",
                label: t("previewTab.repoLastCommit"),
                value: formatRepoDate(lastCommit.dateCreated)
            });
        }
    }

    return (
        <>
            {rows.length > 0 && (
                <DetailSubsection title={t("previewTab.presentation")}>
                    <DetailList rows={rows} />
                </DetailSubsection>
            )}
            <CnllServiceProviderModal
                name={softwareName}
                annuaireCnllServiceProviders={providers.filter(provider => {
                    return provider.identifiers?.some(identifier => {
                        return identifier.subjectOf?.additionalType === "CNLL";
                    });
                })}
            />
        </>
    );
};

const useStyles = tss.withName({ PreviewTab }).create({
    tags: {
        // Cancels the bottom margin DSFR puts on each tag row
        marginBottom: `-${fr.spacing("2v")}`
    },
    latestVersion: {
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: fr.spacing("3v")
    },
    versionBadge: {
        textTransform: "none"
    },
    operatingSystems: {
        display: "flex",
        flexWrap: "wrap",
        columnGap: fr.spacing("4v"),
        rowGap: fr.spacing("1v"),
        listStyle: "none",
        margin: 0,
        padding: 0
    },
    operatingSystem: {
        display: "inline-flex",
        alignItems: "center",
        gap: fr.spacing("1v"),
        padding: 0
    },
    success: {
        color: fr.colors.decisions.text.default.success.default
    },
    error: {
        color: fr.colors.decisions.text.default.error.default
    }
});

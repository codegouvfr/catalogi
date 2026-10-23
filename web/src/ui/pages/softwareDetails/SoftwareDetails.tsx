// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Fragment, useEffect, useMemo, type ReactElement } from "react";
import { useCoreState, useCore } from "core";
import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation } from "react-i18next";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { PreviewTab } from "ui/pages/softwareDetails/PreviewTab";
import { ReferencedInstancesTab } from "ui/pages/softwareDetails/ReferencedInstancesTab";
import { SimilarSoftwareTab } from "ui/pages/softwareDetails/AlikeSoftwareTab";
import { PublicationTab } from "./PublicationTab";
import { SoftwareDetailsHero } from "./SoftwareDetailsHero";
import {
    SectionNav,
    scrollToSection,
    sectionNavStickyTop,
    type NavSection
} from "./SectionNav";
import { DetailSection, DetailSubsection } from "./DetailSection";
import { ParticipationSection } from "./ParticipationSection";
import { UsefulLinks, getUsefulLinks } from "./UsefulLinks";
import {
    SourceProvenanceModal,
    openSourceProvenanceModal
} from "./SourceProvenanceModal";
import type { PageRoute } from "./route";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { routes } from "ui/routes";
import { DeclarationRemovalModal } from "ui/shared/DeclarationRemovalModal";
import {
    openSoftwareProtectionModal,
    SoftwareProtectionModal
} from "ui/shared/SoftwareProtectionModal";
import type { ApiTypes } from "api";

type Props = {
    className?: string;
    route: PageRoute;
};

type Section = NavSection & {
    /** Null when there is nothing to show: the section is left out of the page and the navigation */
    content: ReactElement | null;
};

const sectionIdByTab = {
    instances: "usages",
    alternatives: "similar-software"
} as const;

export default function SoftwareDetails(props: Props) {
    const { route, className } = props;

    const { softwareDetails } = useCore().functions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const uiConfig = useCoreState("uiConfig", "main")?.uiConfig;
    const { allSoftwares } = useCoreState("softwareCatalog", "main");

    const softwareIdByName = useMemo(
        () => new Map(allSoftwares.map(software => [software.name, software.id])),
        [allSoftwares]
    );

    const { t } = useTranslation();

    const { classes, cx } = useStyles();

    const { isReady, error, software, userDeclaration, isUnreferencingOngoing } =
        useCoreState("softwareDetails", "main");

    useEffect(() => {
        softwareDetails.initialize({
            softwareId: route.params.id
        });

        return () => softwareDetails.clear();
    }, [route.params.id]);

    // Legacy `?tab=` links and `#section` links land on the matching section once loaded
    useEffect(() => {
        if (!isReady) return;

        const sectionId =
            route.params.tab !== undefined
                ? sectionIdByTab[route.params.tab]
                : window.location.hash.slice(1);

        if (sectionId !== "") scrollToSection(sectionId);
    }, [isReady]);

    if (error) {
        return (
            <SoftwareDetailsErrorFallback error={error} softwareId={route.params.id} />
        );
    }

    if (!isReady) {
        return <LoadingFallback />;
    }

    const getLogoUrl = (): string | undefined => {
        if (software?.image) return software.image;
        if (uiConfig?.softwareDetails.defaultLogo) return softwareLogoPlaceholder;
    };

    const canCurrentUserBypassSoftwareProtections = currentUser?.role === "admin";
    const isDereferencingProtected =
        software.protections?.dereferencing?.isProtected === true &&
        !canCurrentUserBypassSoftwareProtections;
    const isEditionProtected =
        software.protections?.edition?.isProtected === true &&
        !canCurrentUserBypassSoftwareProtections;

    const isUserActionsEnabled = uiConfig?.softwareDetails.userActions.enabled === true;

    const hasReferencePublications =
        software.referencePublications !== undefined &&
        software.referencePublications.length > 0;

    const isSummaryEnabled =
        uiConfig !== undefined &&
        (uiConfig.softwareDetails.details.enabled ||
            uiConfig.softwareDetails.metadata.enabled ||
            uiConfig.softwareDetails.customAttributes.enabled ||
            (uiConfig.softwareDetails.repoMetadata.enabled &&
                software.repoMetadata !== undefined &&
                Object.keys(software.repoMetadata).length > 0));

    const usefulLinks =
        uiConfig?.softwareDetails.links.enabled === true
            ? getUsefulLinks({
                  identifiers: software.identifiers,
                  officialWebsiteUrl: software.url
              })
            : [];

    const sections: Section[] = [
        {
            id: "summary",
            label: t("softwareDetails.section summary"),
            content: !isSummaryEnabled ? null : (
                <PreviewTab
                    name={software.name}
                    providers={software.providers}
                    license={software.license}
                    supportedPlatforms={software.supportedPlatforms}
                    customAttributes={software.customAttributes}
                    registerDate={software.addedTime}
                    softwareDateCurrentVersion={software.latestVersion?.releaseDate}
                    softwareCurrentVersion={software.latestVersion?.version}
                    keywords={software.keywords}
                    programmingLanguages={software.programmingLanguages}
                    applicationCategories={software.applicationCategories}
                    operatingSystems={software.operatingSystems}
                    runtimePlatforms={software.runtimePlatforms}
                    repoMetadata={software.repoMetadata}
                />
            )
        },
        {
            id: "usages",
            label: t("softwareDetails.section usages"),
            content:
                software.instances === undefined && !hasReferencePublications ? null : (
                    <>
                        {software.instances !== undefined && (
                            <DetailSubsection
                                title={t("softwareDetails.subsection instances")}
                            >
                                <ReferencedInstancesTab
                                    instanceList={software.instances}
                                    createInstanceLink={
                                        routes.instanceCreationForm({
                                            softwareId: software.id
                                        }).link
                                    }
                                />
                            </DetailSubsection>
                        )}
                        {hasReferencePublications && (
                            <DetailSubsection
                                title={t("softwareDetails.tabReferencePublication")}
                            >
                                <PublicationTab
                                    referencePublications={software.referencePublications}
                                />
                            </DetailSubsection>
                        )}
                    </>
                )
        },
        {
            id: "deployment",
            label: t("softwareDetails.section deployment"),
            content:
                software.providers.length === 0 ? null : (
                    <DetailSubsection title={t("softwareDetails.subsection providers")}>
                        <ul>
                            {software.providers.map(serviceProvider => (
                                <ServiceProviderRow
                                    key={serviceProvider.name}
                                    serviceProvider={serviceProvider}
                                />
                            ))}
                        </ul>
                    </DetailSubsection>
                )
        },
        {
            id: "participation",
            label: t("softwareDetails.section participation"),
            content: !isUserActionsEnabled ? null : (
                <ParticipationSection
                    software={software}
                    userDeclaration={userDeclaration}
                    isUnreferencingOngoing={isUnreferencingOngoing}
                    isDereferencingProtected={isDereferencingProtected}
                />
            )
        },
        {
            id: "similar-software",
            label: t("softwareDetails.section similar software"),
            content:
                software.similarSoftwares.length === 0 ? null : (
                    <SimilarSoftwareTab
                        similarSoftwares={software.similarSoftwares}
                        getLinks={({ name: softwareName }) => {
                            const softwareId = softwareIdByName.get(softwareName)!;
                            return {
                                declarationForm: routes.declarationForm({
                                    id: softwareId
                                }).link,
                                softwareDetails: routes.softwareDetails({
                                    id: softwareId
                                }).link,
                                softwareUsersAndReferents:
                                    routes.softwareUsersAndReferents({
                                        id: softwareId
                                    }).link
                            };
                        }}
                        getAddWikipediaSoftwareToSillLink={({ externalId }) =>
                            routes.softwareCreationForm({ externalId }).link
                        }
                    />
                )
        },
        {
            id: "sources",
            label: t("softwareDetails.section sources"),
            content:
                software.dataBySource.length === 0 && usefulLinks.length === 0 ? null : (
                    <>
                        {usefulLinks.length > 0 && <UsefulLinks links={usefulLinks} />}
                        {software.dataBySource.length > 0 && (
                            <Button
                                priority="secondary"
                                iconId="fr-icon-information-line"
                                onClick={() => openSourceProvenanceModal()}
                            >
                                {t("softwareDetails.see all sources")}
                            </Button>
                        )}
                    </>
                )
        }
    ];

    const visibleSections = sections.filter(({ content }) => content !== null);

    return (
        <>
            <div className={className}>
                <SoftwareDetailsHero
                    software={software}
                    logoUrl={getLogoUrl()}
                    userDeclaration={userDeclaration}
                    onShowSourcesClick={
                        software.dataBySource.length === 0
                            ? undefined
                            : () => openSourceProvenanceModal()
                    }
                    editButton={
                        !isUserActionsEnabled
                            ? undefined
                            : {
                                  children: t("softwareDetails.edit software"),
                                  priority: "tertiary",
                                  iconId: "fr-icon-edit-line",
                                  ...(isEditionProtected
                                      ? {
                                            onClick: () =>
                                                openSoftwareProtectionModal({
                                                    type: "edition",
                                                    reason: software.protections?.edition
                                                        ?.reason
                                                })
                                        }
                                      : {
                                            linkProps: routes.softwareUpdateForm({
                                                id: software.id
                                            }).link
                                        })
                              }
                    }
                />
                <div className={fr.cx("fr-container")}>
                    <div className={fr.cx("fr-grid-row")}>
                        <div
                            className={cx(
                                fr.cx("fr-col-12", "fr-col-md-3"),
                                classes.navColumn
                            )}
                        >
                            <SectionNav sections={visibleSections} />
                        </div>
                        <div
                            className={cx(
                                fr.cx("fr-col-12", "fr-col-md-8", "fr-col-offset-md-1"),
                                classes.contentColumn
                            )}
                        >
                            {visibleSections.map(({ id, label, content }) => (
                                <DetailSection key={id} id={id} title={label}>
                                    {content}
                                </DetailSection>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {userDeclaration !== undefined && <DeclarationRemovalModal />}
            <SoftwareProtectionModal />
            <SourceProvenanceModal dataBySource={software.dataBySource} />
        </>
    );
}

const ServiceProviderRow = ({
    serviceProvider: { url, name, identifiers }
}: {
    serviceProvider: ApiTypes.Organization;
}) => {
    const { t } = useTranslation();

    return (
        <li>
            <span className={fr.cx("fr-text--bold")}>{name}</span>
            {url && (
                <>
                    {" - "}
                    <a href={url} target="_blank" rel="noreferrer">
                        {t("common.officialWebsite")}
                    </a>
                </>
            )}
            {identifiers &&
                identifiers
                    .filter(identifier => !!identifier.url)
                    .map(identifier => (
                        <Fragment key={identifier.url! as string}>
                            {" - "}
                            <a
                                href={identifier.url!.toString()}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {identifier.subjectOf?.name ?? identifier.name}
                            </a>
                        </Fragment>
                    ))}
        </li>
    );
};

function SoftwareDetailsErrorFallback({
    error,
    softwareId: _softwareId
}: {
    error: Error;
    softwareId: number;
}) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                padding: fr.spacing("4v"),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: fr.spacing("4v")
            }}
        >
            <Alert
                severity="error"
                title={t("softwareDetails.error.title")}
                description={
                    error.message.includes("not found")
                        ? t("softwareDetails.error.notFound")
                        : t("softwareDetails.error.generic")
                }
            />
            <div style={{ display: "flex", gap: fr.spacing("2v") }}>
                <Button
                    priority="primary"
                    onClick={() => {
                        routes.softwareCatalog().push();
                    }}
                >
                    {t("softwareDetails.error.searchInCatalog")}
                </Button>
            </div>
        </div>
    );
}

const useStyles = tss.withName({ SoftwareDetails }).create({
    navColumn: {
        paddingTop: sectionNavStickyTop,
        [fr.breakpoints.up("md")]: {
            borderRight: `1px solid ${fr.colors.decisions.border.default.grey.default}`
        },
        [fr.breakpoints.down("md")]: {
            paddingTop: fr.spacing("6v")
        }
    },
    contentColumn: {
        paddingTop: sectionNavStickyTop,
        paddingBottom: fr.spacing("20v"),
        [fr.breakpoints.down("md")]: {
            paddingTop: fr.spacing("8v")
        }
    }
});

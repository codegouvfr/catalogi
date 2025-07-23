// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect } from "react";
import { useCoreState, useCore } from "core";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation } from "react-i18next";
import { HeaderDetailCard } from "ui/pages/softwareDetails/HeaderDetailCard";
import { PreviewTab } from "ui/pages/softwareDetails/PreviewTab";
import { ReferencedInstancesTab } from "ui/pages/softwareDetails/ReferencedInstancesTab";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { SimilarSoftwareTab } from "ui/pages/softwareDetails/AlikeSoftwareTab";
import { PublicationTab } from "./PublicationTab";
import { ActionsFooter } from "ui/shared/ActionsFooter";
import { DetailUsersAndReferents } from "ui/shared/DetailUsersAndReferents";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { PageRoute } from "./route";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import { routes, getPreviousRouteName, session } from "ui/routes";
import {
    openDeclarationRemovalModal,
    DeclarationRemovalModal
} from "ui/shared/DeclarationRemovalModal";
import CircularProgress from "@mui/material/CircularProgress";
import type { ApiTypes } from "api";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function SoftwareDetails(props: Props) {
    const { route, className } = props;

    const { softwareDetails, userAuthentication } = useCore().functions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");
    const uiConfig = useCoreState("uiConfig", "main");

    const { cx, classes } = useStyles();

    const { t } = useTranslation();

    const { isReady, software, userDeclaration, isUnreferencingOngoing } = useCoreState(
        "softwareDetails",
        "main"
    );

    useEffect(() => {
        softwareDetails.initialize({
            softwareName: route.params.name
        });

        return () => softwareDetails.clear();
    }, [route.params.name]);

    if (!isReady) {
        return <LoadingFallback />;
    }

    const getLogoUrl = (): string | undefined => {
        if (software.logoUrl) return software.logoUrl;
        if (uiConfig?.softwareDetails.defaultLogo) return softwareLogoPlaceholder;
    };

    return (
        <>
            <div className={className}>
                <div
                    className={fr.cx("fr-container")}
                    style={{ marginBottom: fr.spacing("6v") }}
                >
                    <Breadcrumb
                        segments={[
                            {
                                linkProps: {
                                    ...routes.softwareCatalog().link
                                },
                                label: t("softwareDetails.catalog breadcrumb")
                            }
                        ]}
                        currentPageLabel={software.softwareName}
                        className={classes.breadcrumb}
                    />
                    <HeaderDetailCard
                        softwareLogoUrl={getLogoUrl()}
                        softwareName={software.softwareName}
                        softwareDereferencing={software.dereferencing}
                        authors={software.authors}
                        officialWebsite={software.officialWebsiteUrl}
                        documentationWebsite={software.documentationUrl}
                        sourceCodeRepository={software.codeRepositoryUrl}
                        onGoBackClick={() => {
                            const previousRouteName = getPreviousRouteName();

                            if (previousRouteName === "softwareCatalog") {
                                //Restore scroll position
                                session.back();
                                return;
                            }

                            routes.softwareCatalog().push();
                        }}
                        userDeclaration={userDeclaration}
                    />
                    <Tabs
                        tabs={[
                            {
                                label: t("softwareDetails.tab title overview"),
                                isDefault: route.params.tab === undefined,
                                content: (
                                    <PreviewTab
                                        softwareName={software.softwareName}
                                        serviceProviders={software.serviceProviders}
                                        softwareDescription={software.softwareDescription}
                                        license={software.license}
                                        hasDesktopApp={
                                            software.prerogatives
                                                .isInstallableOnUserComputer
                                        }
                                        isAvailableAsMobileApp={
                                            software.prerogatives.isAvailableAsMobileApp
                                        }
                                        isPresentInSupportMarket={
                                            software.prerogatives
                                                .isPresentInSupportContract
                                        }
                                        isFromFrenchPublicService={
                                            software.prerogatives
                                                .isFromFrenchPublicServices
                                        }
                                        isRGAACompliant={
                                            software.prerogatives.doRespectRgaa
                                        }
                                        minimalVersionRequired={software.versionMin}
                                        registerDate={software.addedTime}
                                        softwareDateCurrentVersion={
                                            software.latestVersion?.publicationTime
                                        }
                                        softwareCurrentVersion={
                                            software.latestVersion?.semVer
                                        }
                                        keywords={software?.keywords}
                                        programmingLanguages={
                                            software?.programmingLanguages
                                        }
                                        applicationCategories={
                                            software?.applicationCategories
                                        }
                                        softwareType={software?.softwareType}
                                        identifiers={software.identifiers}
                                        officialWebsiteUrl={software.officialWebsiteUrl}
                                    />
                                )
                            },
                            ...(software.instances === undefined
                                ? []
                                : [
                                      {
                                          label: t("softwareDetails.tab title instance", {
                                              instanceCount: software.instances.length
                                          }),
                                          isDefault: route.params.tab === "instances",
                                          content: (
                                              <ReferencedInstancesTab
                                                  instanceList={software.instances}
                                                  createInstanceLink={
                                                      routes.instanceCreationForm({
                                                          softwareName:
                                                              software.softwareName
                                                      }).link
                                                  }
                                              />
                                          )
                                      }
                                  ]),
                            ...(software.serviceProviders.length === 0
                                ? []
                                : [
                                      {
                                          label: t(
                                              "softwareDetails.tab service providers",
                                              {
                                                  serviceProvidersCount:
                                                      software.serviceProviders.length
                                              }
                                          ),
                                          content: (
                                              <div>
                                                  <p className={fr.cx("fr-text--bold")}>
                                                      {t(
                                                          "softwareDetails.list of service providers"
                                                      )}
                                                  </p>
                                                  <ul>
                                                      {software.serviceProviders.map(
                                                          serviceProvider => (
                                                              <ServiceProviderRow
                                                                  key={
                                                                      serviceProvider.name
                                                                  }
                                                                  serviceProvider={
                                                                      serviceProvider
                                                                  }
                                                              />
                                                          )
                                                      )}
                                                  </ul>
                                              </div>
                                          )
                                      }
                                  ]),
                            ...(software.similarSoftwares.length === 0
                                ? []
                                : [
                                      {
                                          label: t(
                                              "softwareDetails.tab title alike software",
                                              {
                                                  alikeSoftwareCount:
                                                      software.similarSoftwares.length ??
                                                      0
                                              }
                                          ),
                                          isDefault: route.params.tab === "alternatives",
                                          content: (
                                              <SimilarSoftwareTab
                                                  similarSoftwares={
                                                      software.similarSoftwares
                                                  }
                                                  getLinks={({ softwareName }) => ({
                                                      declarationForm:
                                                          routes.declarationForm({
                                                              name: softwareName
                                                          }).link,
                                                      softwareDetails:
                                                          routes.softwareDetails({
                                                              name: softwareName
                                                          }).link,
                                                      softwareUsersAndReferents:
                                                          routes.softwareUsersAndReferents(
                                                              {
                                                                  name: softwareName
                                                              }
                                                          ).link
                                                  })}
                                                  getAddWikipediaSoftwareToSillLink={({
                                                      externalId
                                                  }) =>
                                                      routes.softwareCreationForm({
                                                          externalId: externalId
                                                      }).link
                                                  }
                                              />
                                          )
                                      }
                                  ]),
                            ...(software.referencePublications === undefined
                                ? []
                                : [
                                      {
                                          label: t(
                                              "softwareDetails.tabReferencePublication"
                                          ),
                                          content: (
                                              <PublicationTab
                                                  referencePublications={
                                                      software.referencePublications
                                                  }
                                              />
                                          )
                                      }
                                  ])
                        ]}
                    />
                </div>
                {uiConfig?.softwareDetails.userActions.enabled && (
                    <ActionsFooter className={classes.container}>
                        <DetailUsersAndReferents
                            className={cx(
                                fr.cx("fr-text--lg"),
                                classes.detailUsersAndReferents
                            )}
                            seeUserAndReferent={
                                software.referentCount > 0 || software.userCount > 0
                                    ? routes.softwareUsersAndReferents({
                                          name: software.softwareName
                                      }).link
                                    : undefined
                            }
                            referentCount={software.referentCount ?? 0}
                            userCount={software.userCount ?? 0}
                        />
                        <div className={classes.buttons}>
                            {software.dereferencing === undefined && (
                                <Button
                                    priority="secondary"
                                    disabled={isUnreferencingOngoing}
                                    onClick={() => {
                                        if (!currentUser) {
                                            userAuthentication.login();
                                            return;
                                        }

                                        const userInput = window.prompt(
                                            t(
                                                "softwareDetails.please provide a reason for unreferencing this software"
                                            )
                                        );

                                        if (userInput === null || userInput === "") {
                                            return;
                                        }

                                        softwareDetails.unreference({
                                            reason: userInput
                                        });
                                    }}
                                >
                                    {isUnreferencingOngoing ? (
                                        <CircularProgress size={17} />
                                    ) : (
                                        t("softwareDetails.unreference software")
                                    )}
                                </Button>
                            )}

                            <Button
                                priority="secondary"
                                linkProps={
                                    routes.softwareUpdateForm({
                                        name: software.softwareName
                                    }).link
                                }
                            >
                                {t("softwareDetails.edit software")}
                            </Button>
                            {(() => {
                                const declarationType = userDeclaration?.isReferent
                                    ? "referent"
                                    : userDeclaration?.isUser
                                      ? "user"
                                      : undefined;

                                if (declarationType === undefined) {
                                    return (
                                        <Button
                                            linkProps={
                                                routes.declarationForm({
                                                    name: software.softwareName
                                                }).link
                                            }
                                        >
                                            {t("softwareDetails.declare referent")}
                                        </Button>
                                    );
                                }

                                return (
                                    <>
                                        <Button
                                            priority="tertiary no outline"
                                            onClick={() =>
                                                openDeclarationRemovalModal({
                                                    declarationType,
                                                    softwareName: software.softwareName,
                                                    softwareId: software.softwareId
                                                })
                                            }
                                        >
                                            {declarationType === "user"
                                                ? t("softwareDetails.stop being user")
                                                : t(
                                                      "softwareDetails.stop being referent"
                                                  )}
                                        </Button>
                                        {declarationType === "user" && (
                                            <Button
                                                linkProps={
                                                    routes.declarationForm({
                                                        name: software.softwareName,
                                                        declarationType: "referent"
                                                    }).link
                                                }
                                            >
                                                {t("softwareDetails.become referent")}
                                            </Button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </ActionsFooter>
                )}
            </div>
            {userDeclaration !== undefined && <DeclarationRemovalModal />}
        </>
    );
}

const ServiceProviderRow = ({
    serviceProvider: { url, name, identifiers }
}: {
    serviceProvider: ApiTypes.Organization;
}) => (
    <li>
        <span className={fr.cx("fr-text--bold")}>{name}</span>
        {" - "}
        {url && (
            <a href={url} target="_blank" rel="noreferrer">
                Site officiel TODO Translate
            </a>
        )}{" "}
        {identifiers &&
            identifiers.map(identifier => (
                <>
                    -{" "}
                    {identifier?.url && (
                        <a
                            href={identifier.url.toString()}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {identifier.subjectOf?.name ?? identifier.name}
                        </a>
                    )}
                </>
            ))}
    </li>
);

const useStyles = tss.withName({ SoftwareDetails }).create({
    breadcrumb: {
        marginBottom: fr.spacing("4v")
    },
    container: {
        display: "grid",
        gridTemplateColumns: `1fr 2fr`,
        columnGap: fr.spacing("6v"),
        marginBottom: fr.spacing("6v"),
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: `repeat(1, 1fr)`,
            gridRowGap: fr.spacing("6v")
        }
    },
    buttons: {
        display: "flex",
        alignItems: "center",
        justifyContent: "end",
        gap: fr.spacing("4v")
    },
    detailUsersAndReferents: {
        color: fr.colors.decisions.text.actionHigh.blueFrance.default
    }
});

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect } from "react";
import { routes, session } from "ui/routes";
import CircularProgress from "@mui/material/CircularProgress";
import { InstanceFormStep1 } from "ui/pages/instanceForm/Step1";
import { InstanceFormStep2 } from "ui/pages/instanceForm/Step2";
import { tss } from "tss-react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { fr } from "@codegouvfr/react-dsfr";
import { useConst } from "powerhooks/useConst";
import { Evt } from "evt";
import { useCoreState, useCore } from "core";
import { useEvt } from "evt/hooks";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { useTranslation } from "react-i18next";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { ActionsFooter } from "ui/shared/ActionsFooter";
import type { PageRoute } from "./route";
import { LoadingFallback } from "ui/shared/LoadingFallback";

export type Props = {
    className?: string;
    route: PageRoute;
};

export default function InstanceForm(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { evtInstanceForm } = useCore().evts;

    const { instanceForm } = useCore().functions;

    const {
        isReady,
        step,
        initializationData,
        allSillSoftwares,
        isSubmitting,
        isLastStep
    } = useCoreState("instanceForm", "main");

    useEffect(() => {
        instanceForm.initialize(
            (() => {
                switch (route.name) {
                    case "instanceCreationForm":
                        return {
                            type: "create",
                            softwareId: route.params.softwareId
                        };
                    case "instanceUpdateForm":
                        return {
                            type: "update",
                            instanceId: route.params.id
                        };
                }
            })()
        );

        return () => instanceForm.clear();
    }, [route.name, route.params]);

    useEvt(
        ctx =>
            evtInstanceForm.attach(
                action => action.action === "redirect",
                ctx,
                ({ softwareId }) =>
                    routes.softwareDetails({ id: softwareId, tab: "instances" }).push()
            ),
        []
    );

    const { classes, cx } = useStyles({ step });
    const titleName = step === 1 ? "stepper-title_1" : "stepper-title_2";
    const { t } = useTranslation();

    const translationByRoute: Record<
        PageRoute["name"],
        { title: string; submitLabel: string; breadcrumbs: string }
    > = {
        instanceCreationForm: {
            title: t("instanceForm.title add instance form"),
            breadcrumbs: t("instanceForm.breadcrumb add instance"),
            submitLabel: t("app.add instance")
        },
        instanceUpdateForm: {
            title: t("instanceForm.title update instance form"),
            breadcrumbs: t("instanceForm.breadcrumb update instance"),
            submitLabel: t("app.update instance")
        }
    };

    const translations = translationByRoute[route.name];

    const evtActionSubmitStep = useConst(() => Evt.create());

    if (!isReady) {
        return <LoadingFallback className={className} showAfterMs={150} />;
    }

    return (
        <div className={className}>
            <div className={fr.cx("fr-container")}>
                <Breadcrumb
                    segments={[
                        {
                            linkProps: {
                                ...routes.addSoftwareLanding().link
                            },
                            label: t("app.add software or service")
                        }
                    ]}
                    currentPageLabel={translations.breadcrumbs}
                    className={classes.breadcrumb}
                />
                <div className={classes.headerDeclareUserOrReferent}>
                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                    <a
                        href={"#"}
                        onClick={() => session.back()}
                        className={classes.backButton}
                    >
                        <i className={fr.cx("fr-icon-arrow-left-s-line")} />
                    </a>
                    <h4 className={classes.title}>{translations.title}</h4>
                </div>
                <Stepper
                    currentStep={step}
                    stepCount={2}
                    title={t(`instanceForm.${titleName}`)}
                    className={classes.stepper}
                />
                <InstanceFormStep1
                    className={cx(classes.step, classes.step1)}
                    initialFormData={{
                        mainSoftwareSillId: initializationData.mainSoftwareSillId
                    }}
                    onSubmit={({ mainSoftwareSillId }) =>
                        instanceForm.completeStep1({
                            mainSoftwareSillId
                        })
                    }
                    allSillSoftwares={allSillSoftwares}
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 1)}
                />
                <InstanceFormStep2
                    className={cx(classes.step, classes.step2)}
                    initialFormData={{
                        organization: initializationData.organization,
                        targetAudience: initializationData.targetAudience,
                        instanceUrl: initializationData.instanceUrl,
                        isPublic:
                            initializationData.isPublic === null
                                ? null
                                : initializationData.isPublic
                                  ? "true"
                                  : "false"
                    }}
                    onSubmit={({ organization, targetAudience, instanceUrl, isPublic }) =>
                        instanceForm.submit({
                            organization,
                            instanceUrl,
                            targetAudience,
                            isPublic: isPublic === "true"
                        })
                    }
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 2)}
                />
            </div>
            <ActionsFooter className={classes.footerContainer}>
                <Button
                    onClick={() => instanceForm.returnToPreviousStep()}
                    priority="secondary"
                    className={classes.softwareDetails}
                    disabled={step === 1}
                >
                    {t("app.previous")}
                </Button>
                <Button
                    onClick={() => evtActionSubmitStep.post()}
                    priority="primary"
                    disabled={isSubmitting}
                >
                    {isLastStep ? (
                        <>
                            {translations.submitLabel}
                            {isSubmitting && (
                                <CircularProgress
                                    size={20}
                                    className={classes.progressSubmit}
                                />
                            )}
                        </>
                    ) : (
                        t("app.next")
                    )}
                </Button>
            </ActionsFooter>
        </div>
    );
}

const useStyles = tss
    .withName({ InstanceForm })
    .withParams<{ step: number | undefined }>()
    .create(({ step }) => ({
        step: {
            flexDirection: "column",
            gap: fr.spacing("8v")
        },
        step1: {
            display: step !== 1 ? "none" : "flex"
        },
        step2: {
            display: step !== 2 ? "none" : "flex",
            "& .fr-input-group, & .fr-fieldset": {
                ...fr.spacing("margin", {
                    topBottom: 0
                })
            }
        },
        breadcrumb: {
            marginBottom: fr.spacing("4v")
        },
        headerDeclareUserOrReferent: {
            display: "flex",
            alignItems: "center",
            marginBottom: fr.spacing("10v")
        },
        backButton: {
            background: "none",
            marginRight: fr.spacing("4v"),
            "&>i": {
                "&::before": {
                    "--icon-size": fr.spacing("8v")
                }
            }
        },
        title: {
            marginBottom: fr.spacing("1v")
        },
        stepper: {
            flex: "1"
        },
        footerContainer: {
            display: "flex",
            alignItems: "center",
            justifyContent: "end"
        },
        softwareDetails: {
            marginRight: fr.spacing("4v"),
            "&&::before": {
                "--icon-size": fr.spacing("6v")
            }
        },
        progressSubmit: {
            marginLeft: fr.spacing("4v")
        }
    }));

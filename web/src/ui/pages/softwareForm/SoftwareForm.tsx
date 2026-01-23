// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect } from "react";
import { routes, session } from "ui/routes";
import CircularProgress from "@mui/material/CircularProgress";
import { SoftwareFormStep1 } from "ui/pages/softwareForm/Step1";
import { SoftwareFormStep2 } from "ui/pages/softwareForm/Step2";
import { SoftwareFormStep3 } from "ui/pages/softwareForm/Step3";
import { SoftwareFormStep4 } from "ui/pages/softwareForm/Step4";
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
import { useLang } from "ui/i18n";
import { LoadingFallback } from "ui/shared/LoadingFallback";

type Props = {
    className?: string;
    route: PageRoute;
};

const stepCount = 4;

export default function SoftwareForm(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { isReady, step, formData, isSubmitting, isLastStep } = useCoreState(
        "softwareForm",
        "main"
    );

    const { evtSoftwareForm } = useCore().evts;
    const { softwareForm } = useCore().functions;

    useEffect(() => {
        softwareForm.initialize(
            (() => {
                switch (route.name) {
                    case "softwareCreationForm":
                        return {
                            scenario: "create",
                            externalId: route.params.externalId
                        };
                    case "softwareUpdateForm":
                        return {
                            scenario: "update",
                            softwareId: route.params.id
                        };
                }
            })()
        );

        return () => softwareForm.clear();
    }, [route.name, route.params]);

    const { allSoftwares } = useCoreState("softwareCatalog", "main");

    useEvt(
        ctx =>
            evtSoftwareForm.attach(
                action => action.action === "redirect",
                ctx,
                async ({ softwareName }) => {
                    const software = allSoftwares.find(
                        s => s.softwareName === softwareName
                    );
                    if (software) {
                        routes.softwareDetails({ id: software.id }).push();
                    } else {
                        routes.softwareCatalog({ search: softwareName }).push();
                    }
                }
            ),
        [allSoftwares]
    );

    const { classes } = useStyles({ step });
    const { t } = useTranslation();

    const evtActionSubmitStep = useConst(() => Evt.create());

    const { lang } = useLang();

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
                    currentPageLabel={(() => {
                        switch (route.name) {
                            case "softwareCreationForm":
                                return t("app.add software");
                            case "softwareUpdateForm":
                                return t("app.update software");
                        }
                    })()}
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
                    <h4 className={classes.title}>
                        {(() => {
                            switch (route.name) {
                                case "softwareCreationForm":
                                    return formData.step2?.softwareName
                                        ? t("softwareForm.add software", {
                                              name: formData.step2.softwareName
                                          })
                                        : t("softwareForm.add unamed software");
                                case "softwareUpdateForm":
                                    return t("softwareForm.update software", {
                                        name: formData.step2?.softwareName ?? ""
                                    });
                            }
                        })()}
                    </h4>
                </div>
                <Stepper
                    currentStep={step}
                    stepCount={stepCount}
                    title={(() => {
                        const softwareName = formData.step2?.softwareName;
                        switch (step) {
                            case 1:
                                return (() => {
                                    switch (route.name) {
                                        case "softwareCreationForm":
                                            return softwareName === undefined
                                                ? t(
                                                      "softwareForm.stepper title_add_unnamed"
                                                  )
                                                : t(
                                                      "softwareForm.stepper title_add_named",
                                                      { softwareName }
                                                  );
                                        case "softwareUpdateForm":
                                            return t(
                                                "softwareForm.stepper title_update",
                                                { softwareName }
                                            );
                                    }
                                })();
                            case 2:
                                return softwareName === undefined
                                    ? t("softwareForm.stepper title_info_unnamed")
                                    : t("softwareForm.stepper title_info_named", {
                                          softwareName
                                      });
                            case 3:
                                return softwareName === undefined
                                    ? t(
                                          "softwareForm.stepper title_prerequisites_unnamed"
                                      )
                                    : t(
                                          "softwareForm.stepper title_prerequisites_named",
                                          { softwareName }
                                      );
                            case 4:
                                return softwareName === undefined
                                    ? t(
                                          "softwareForm.stepper title_similar_software_unnamed"
                                      )
                                    : t(
                                          "softwareForm.stepper title_similar_software_named",
                                          { softwareName }
                                      );
                            default:
                                return "";
                        }
                    })()}
                    className={classes.stepper}
                />
                <SoftwareFormStep1
                    className={classes.step1}
                    initialFormData={formData.step1}
                    onSubmit={formData =>
                        softwareForm.setStep1Data({
                            formDataStep1: formData
                        })
                    }
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 1)}
                />
                <SoftwareFormStep2
                    className={classes.step2}
                    isUpdateForm={route.name === "softwareUpdateForm"}
                    initialFormData={formData.step2}
                    onSubmit={formData =>
                        softwareForm.setStep2Data({
                            formDataStep2: formData
                        })
                    }
                    getAutofillDataFromWikidata={softwareForm.getAutofillData}
                    getLibreSoftwareWikidataOptions={queryString =>
                        softwareForm.getExternalSoftwareOptions({
                            language: lang,
                            queryString
                        })
                    }
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 2)}
                />
                <SoftwareFormStep3
                    className={classes.step3}
                    initialFormData={formData.step3}
                    onSubmit={formData => {
                        console.log("formData : ", formData);
                        softwareForm.setStep3Data({
                            formDataStep3: formData
                        });
                    }}
                    isCloudNativeSoftware={formData.step1?.softwareType.type === "cloud"}
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 3)}
                />
                <SoftwareFormStep4
                    className={classes.step4}
                    initialFormData={formData.step4}
                    evtActionSubmit={evtActionSubmitStep.pipe(() => step === 4)}
                    onSubmit={formData =>
                        softwareForm.setStep4DataAndSubmit({
                            formDataStep4: formData
                        })
                    }
                    getExternalSoftwareOptions={queryString =>
                        softwareForm.getExternalSoftwareOptions({
                            language: lang,
                            queryString
                        })
                    }
                />
            </div>
            <ActionsFooter className={classes.footerContainer}>
                <Button
                    onClick={() => softwareForm.returnToPreviousStep()}
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
                            {(() => {
                                switch (route.name) {
                                    case "softwareCreationForm":
                                        return t("softwareForm.add software", {
                                            name: formData.step2?.softwareName
                                        });
                                    case "softwareUpdateForm":
                                        return t("softwareForm.update software", {
                                            name: formData.step2?.softwareName ?? ""
                                        });
                                }
                            })()}

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
    .withName({ SoftwareForm })
    .withParams<{ step: number | undefined }>()
    .create(({ step }) => ({
        step1: {
            display: step !== 1 ? "none" : undefined
        },
        step2: {
            display: step !== 2 ? "none" : undefined
        },
        step3: {
            display: step !== 3 ? "none" : undefined
        },
        step4: {
            display: step !== 4 ? "none" : undefined
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

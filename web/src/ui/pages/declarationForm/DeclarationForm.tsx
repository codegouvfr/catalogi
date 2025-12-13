// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, type MouseEvent } from "react";
import { routes, session } from "ui/routes";
import CircularProgress from "@mui/material/CircularProgress";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { useCore, useCoreState } from "core";
import { useEvt } from "evt/hooks";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { useConst } from "powerhooks/useConst";
import { Evt } from "evt";
import { DeclarationFormStep1 } from "ui/pages/declarationForm/Step1";
import { DeclarationFormStep2User } from "ui/pages/declarationForm/Step2User";
import { DeclarationFormStep2Referent } from "ui/pages/declarationForm/Step2Referent";
import { tss } from "tss-react";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { fr } from "@codegouvfr/react-dsfr";
import { DetailUsersAndReferents } from "ui/shared/DetailUsersAndReferents";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { useTranslation } from "react-i18next";
import { ActionsFooter } from "ui/shared/ActionsFooter";
import type { PageRoute } from "./route";
import softwareLogoPlaceholder from "ui/assets/software_logo_placeholder.png";
import { LoadingFallback } from "ui/shared/LoadingFallback";

type Props = {
    className?: string;
    route: PageRoute;
};

const stepCount = 2;

export default function DeclarationForm(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { declarationForm } = useCore().functions;
    const { evtDeclarationForm } = useCore().evts;

    const { isReady, step, declarationType, isSubmitting, software } = useCoreState(
        "declarationForm",
        "main"
    );

    useEffect(() => {
        declarationForm.initialize({ softwareName: route.params.name });
        return () => declarationForm.clear();
    }, []);

    useEffect(() => {
        const { declarationType } = route.params;

        if (declarationType === undefined) {
            return;
        }

        if (step !== 1) {
            return;
        }

        declarationForm.setDeclarationType({ declarationType });
    }, [step]);

    useEvt(
        ctx =>
            evtDeclarationForm.attach(
                action => action.action === "redirect",
                ctx,
                ({ softwareId }) => routes.softwareDetails({ id: softwareId }).push()
            ),
        []
    );

    const evtActionSubmitStep = useConst(() => Evt.create());

    const { classes, cx } = useStyles({ step, declarationType });

    const { t } = useTranslation();

    if (!isReady) {
        return <LoadingFallback />;
    }

    const onBackStep = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        declarationForm.navigateToPreviousStep();
    };

    const onNextStep = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        evtActionSubmitStep.post();
    };

    return (
        <div className={className}>
            <div className={fr.cx("fr-container")}>
                <Breadcrumb
                    segments={[
                        {
                            linkProps: {
                                ...routes.softwareCatalog().link
                            },
                            label: t("declarationForm.catalog breadcrumb")
                        },
                        {
                            linkProps: {
                                ...routes.softwareDetails({
                                    id: software.softwareId
                                }).link
                            },
                            label: software.softwareName
                        }
                    ]}
                    currentPageLabel={t(
                        "declarationForm.declare yourself user or referent breadcrumb"
                    )}
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
                        {t(
                            "declarationForm.declare yourself user or referent breadcrumb"
                        )}
                    </h4>
                </div>
                <div className={classes.formContainer}>
                    <div className={classes.leftCol}>
                        <div className={classes.softwareNameContainer}>
                            <div className={classes.logoWrapper}>
                                <img
                                    className={classes.logo}
                                    src={software.logoUrl ?? softwareLogoPlaceholder}
                                    alt="Logo du logiciel"
                                />
                            </div>
                            <h4 className={classes.softwareName}>
                                {software.softwareName}
                            </h4>
                        </div>
                        <DetailUsersAndReferents
                            className={cx(
                                fr.cx("fr-text--lg"),
                                classes.detailUserAndReferent
                            )}
                            seeUserAndReferent={
                                routes.softwareUsersAndReferents({
                                    name: software.softwareName
                                }).link
                            }
                            referentCount={software.referentCount}
                            userCount={software.userCount}
                        />
                    </div>

                    <div className={cx("fr-form-group", classes.rightCol)}>
                        <Stepper
                            currentStep={step}
                            stepCount={stepCount}
                            title={
                                <legend
                                    className={fr.cx("fr-h6")}
                                    id="radio-hint-element-legend"
                                >
                                    {(() => {
                                        switch (step) {
                                            case 1:
                                                return t("declarationForm.title step 1");
                                            case 2:
                                                assert(declarationType !== undefined);
                                                return t(
                                                    `declarationForm.title step 2 ${declarationType}`
                                                );
                                        }
                                    })()}
                                </legend>
                            }
                            className={classes.stepper}
                        />
                        <fieldset className={fr.cx("fr-fieldset")}>
                            <DeclarationFormStep1
                                className={classes.step1}
                                evtActionSubmit={evtActionSubmitStep.pipe(
                                    () => step === 1
                                )}
                                onSubmit={({ declarationType }) =>
                                    declarationForm.setDeclarationType({
                                        declarationType
                                    })
                                }
                            />
                            <DeclarationFormStep2User
                                className={classes.step2User}
                                evtActionSubmit={evtActionSubmitStep.pipe(
                                    () => step === 2 && declarationType === "user"
                                )}
                                onSubmit={formData =>
                                    declarationForm.submit({ formData })
                                }
                                softwareType={software.softwareType}
                            />
                            <DeclarationFormStep2Referent
                                className={classes.step2Referent}
                                evtActionSubmit={evtActionSubmitStep.pipe(
                                    () => step === 2 && declarationType === "referent"
                                )}
                                onSubmit={formData =>
                                    declarationForm.submit({ formData })
                                }
                                softwareType={(() => {
                                    switch (software.softwareType) {
                                        case "cloud":
                                            return "cloud";
                                        default:
                                            return "other";
                                    }
                                })()}
                            />
                        </fieldset>
                    </div>
                </div>
            </div>
            <ActionsFooter className={classes.buttons}>
                <Button
                    onClick={onBackStep}
                    priority="secondary"
                    className={classes.back}
                    disabled={(() => {
                        switch (step) {
                            case 1:
                                return true;
                            case 2:
                                return route.params.declarationType !== undefined;
                            default:
                                return false;
                        }
                    })()}
                >
                    {t("app.previous")}
                </Button>
                <Button onClick={onNextStep} priority="primary" disabled={isSubmitting}>
                    {step === stepCount ? (
                        <>
                            {t("declarationForm.submit declaration")}{" "}
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
    .withName({ DeclarationForm })
    .withParams<{
        step: 1 | 2 | undefined;
        declarationType: "user" | "referent" | undefined;
    }>()
    .create(({ step, declarationType }) => ({
        step1: {
            display: step !== 1 ? "none" : undefined
        },
        step2User: {
            display: step !== 2 || declarationType !== "user" ? "none" : undefined
        },
        step2Referent: {
            display: step !== 2 || declarationType !== "referent" ? "none" : undefined
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
        formContainer: {
            display: "grid",
            gridTemplateColumns: `repeat(2, 1fr)`,

            [fr.breakpoints.down("md")]: {
                gridTemplateColumns: `repeat(1, 1fr)`
            }
        },
        leftCol: {
            marginLeft: fr.spacing("12v"),
            paddingRight: fr.spacing("16v"),
            borderRight: `1px ${fr.colors.decisions.border.default.grey.default} solid`,

            [fr.breakpoints.down("md")]: {
                borderRight: "none",
                marginLeft: "0",
                paddingRight: "0"
            }
        },
        softwareNameContainer: {
            display: "flex",
            alignItems: "center",
            marginBottom: fr.spacing("3v")
        },
        logoWrapper: {
            width: fr.spacing("14v"),
            height: fr.spacing("14v"),
            marginRight: fr.spacing("3v"),
            overflow: "hidden"
        },
        logo: {
            height: "100%"
        },
        softwareName: {
            marginBottom: 0
        },
        detailUserAndReferent: {
            color: fr.colors.decisions.text.actionHigh.blueFrance.default
        },
        rightCol: {
            marginLeft: fr.spacing("6v"),
            paddingLeft: fr.spacing("10v"),
            [fr.breakpoints.down("md")]: {
                marginLeft: "0",
                paddingLeft: "0"
            }
        },
        stepper: {
            flex: "1"
        },
        buttons: {
            display: "flex",
            alignItems: "center",
            justifyContent: "end"
        },
        back: {
            marginRight: fr.spacing("4v")
        },
        progressSubmit: {
            marginLeft: fr.spacing("4v")
        }
    }));

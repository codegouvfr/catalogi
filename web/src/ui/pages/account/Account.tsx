import { useEffect, useState, useMemo } from "react";
import { tss } from "tss-react";
import { fr } from "@codegouvfr/react-dsfr";
import { useTranslation, useGetOrganizationFullName, evtLang } from "ui/i18n";
import { assert } from "tsafe/assert";
import { Equals } from "tsafe";
import { declareComponentKeys } from "i18nifty";
import { useCore, useCoreState } from "core";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { z } from "zod";
import { AutocompleteFreeSoloInput } from "ui/shared/AutocompleteFreeSoloInput";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { PageRoute } from "./route";
import { LoadingFallback } from "ui/shared/LoadingFallback";
import CircularProgress from "@mui/material/CircularProgress";
import MDEditor from "@uiw/react-md-editor";
import { useIsDark } from "@codegouvfr/react-dsfr/useIsDark";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import aboutTemplateEnUrl from "ui/assets/about_template_en.md";
import aboutTemplateFrUrl from "ui/assets/about_template_fr.md";
import { useAsync } from "ui/tools/useAsync";
import { useRerenderOnStateChange } from "evt/hooks";
import { Evt } from "evt";
import { useConst } from "powerhooks/useConst";
import { routes } from "ui/routes";
import type { Link } from "type-route";

type Props = {
    className?: string;
    route: PageRoute;
};

export default function Account(props: Props) {
    const { className, route, ...rest } = props;

    /** Assert to make sure all props are deconstructed */
    assert<Equals<typeof rest, {}>>();

    const { userAccountManagement } = useCore().functions;
    const isReady = useCoreState("userAccountManagement", "main") !== undefined;

    useEffect(() => {
        userAccountManagement.initialize();
    }, []);

    if (!isReady) {
        return <LoadingFallback />;
    }

    return <AccountReady className={className} />;
}

function AccountReady(props: { className?: string }) {
    const { className } = props;

    const { t } = useTranslation({ Account });

    const {
        allOrganizations,
        email,
        organization,
        aboutAndIsPublic,
        doSupportAccountManagement,
        allowedEmailRegExp
    } = (function useClosure() {
        const state = useCoreState("userAccountManagement", "main");

        assert(state !== undefined);

        const { allowedEmailRegexpStr, ...rest } = state;

        const allowedEmailRegExp = useMemo(
            () => new RegExp(allowedEmailRegexpStr),
            [allowedEmailRegexpStr]
        );

        return {
            ...rest,
            allowedEmailRegExp
        };
    })();

    const { isDark } = useIsDark();

    const { userAccountManagement } = useCore().functions;

    const [emailInputValue, setEmailInputValue] = useState(email.value);
    /* prettier-ignore */
    const [, setOrganizationInputValue] = useState(organization.value);

    const evtAboutInputValue = useConst(() => Evt.create(aboutAndIsPublic.about));

    /* prettier-ignore */
    const [isPublicInputValue, setIsPublicInputValue] = useState(aboutAndIsPublic.isPublic);

    useRerenderOnStateChange(evtAboutInputValue);

    useAsync(async () => {
        const response = await fetch(
            (() => {
                switch (evtLang.state) {
                    case "fr":
                        return aboutTemplateFrUrl;
                    default:
                        return aboutTemplateEnUrl;
                }
            })()
        );
        const text = await response.text();

        if (evtAboutInputValue.state !== "") {
            return;
        }

        evtAboutInputValue.state = text;
    }, []);

    const emailInputValueErrorMessage = (() => {
        try {
            z.string().email().parse(emailInputValue);
        } catch {
            return t("not a valid email");
        }

        if (!allowedEmailRegExp.test(emailInputValue)) {
            return t("email domain not allowed", {
                "domain": emailInputValue.split("@")[1]
            });
        }

        return undefined;
    })();

    const { classes, cx, css } = useStyles();

    const { getOrganizationFullName } = useGetOrganizationFullName();

    return (
        <div className={cx(fr.cx("fr-container"), className)}>
            <div className={classes.oidcInfos}>
                <h2 className={classes.title}>{t("title")}</h2>
                <div className={classes.inputAndPaddingBlockWrapper}>
                    <div className={classes.inputWrapper}>
                        <Input
                            className={cx(classes.input)}
                            label={t("mail")}
                            nativeInputProps={{
                                "onChange": event =>
                                    setEmailInputValue(event.target.value),
                                "value": emailInputValue,
                                "name": "email",
                                "type": "email",
                                "id": "email",
                                "onKeyDown": event => {
                                    if (event.key === "Escape") {
                                        setEmailInputValue(email.value);
                                    }
                                }
                            }}
                            state={
                                emailInputValueErrorMessage === undefined
                                    ? undefined
                                    : "error"
                            }
                            stateRelatedMessage={emailInputValueErrorMessage}
                            disabled={true}
                        />
                    </div>
                    <div className={classes.paddingBlock} />
                </div>
                <div className={classes.inputAndPaddingBlockWrapper}>
                    <div className={classes.inputWrapper}>
                        <AutocompleteFreeSoloInput
                            className={classes.input}
                            options={allOrganizations}
                            getOptionLabel={organization =>
                                getOrganizationFullName(organization)
                            }
                            value={organization.value}
                            onValueChange={value => setOrganizationInputValue(value)}
                            dsfrInputProps={{
                                "label": t("organization"),
                                "disabled": organization.isBeingUpdated
                            }}
                            disabled={true}
                        />
                    </div>
                    <div className={classes.paddingBlock} />
                </div>
                {doSupportAccountManagement && (
                    <a
                        className={fr.cx("fr-btn", "fr-btn--secondary")}
                        href={userAccountManagement.getAccountManagementUrl()}
                    >
                        {t("manage account")}
                    </a>
                )}
            </div>
            <>
                <h2>{t("about title")}</h2>
                <p> {t("about description")} </p>
                <div
                    style={{
                        "display": "flex",
                        "alignItems": "end",
                        "marginBottom": fr.spacing("6v")
                    }}
                >
                    <Checkbox
                        className={classes.isPublicCheckbox}
                        disabled={aboutAndIsPublic.isBeingUpdated}
                        options={[
                            {
                                "label": t("isPublic label"),
                                "nativeInputProps": {
                                    "checked": isPublicInputValue,
                                    "onChange": event =>
                                        setIsPublicInputValue(event.target.checked)
                                }
                            }
                        ]}
                        stateRelatedMessage={t("isPublic hint", {
                            "profileLik": routes.userProfile({ "email": email.value })
                                .link
                        })}
                    />
                    <div style={{ "flex": 1 }} />
                    <div>
                        <Button
                            className={cx(
                                classes.updateButton,
                                css({
                                    "visibility": aboutAndIsPublic.isBeingUpdated
                                        ? "hidden"
                                        : undefined
                                })
                            )}
                            onClick={() =>
                                userAccountManagement.updateField({
                                    "fieldName": "aboutAndIsPublic",
                                    "about": evtAboutInputValue.state,
                                    "isPublic": isPublicInputValue
                                })
                            }
                            disabled={
                                aboutAndIsPublic.about === evtAboutInputValue.state &&
                                aboutAndIsPublic.isPublic === isPublicInputValue
                            }
                        >
                            {t("update")}
                        </Button>
                        {aboutAndIsPublic.isBeingUpdated && (
                            <CircularProgress size={30} />
                        )}
                    </div>
                </div>
                <div
                    data-color-mode={isDark ? "dark" : "light"}
                    className={classes.editorWrapper}
                >
                    <MDEditor
                        value={evtAboutInputValue.state}
                        onChange={value => {
                            evtAboutInputValue.state = value ?? "";
                        }}
                        height={600}
                    />
                    {aboutAndIsPublic.isBeingUpdated && (
                        <div className={classes.editorWrapperOverlay} />
                    )}
                </div>
                <a
                    {...routes.userProfile({
                        "email": email.value
                    }).link}
                    style={{
                        "display": "inline-block",
                        "marginBottom": fr.spacing("6v")
                    }}
                >
                    {t("go to profile")}
                </a>
            </>
        </div>
    );
}

const useStyles = tss.withName({ Account }).create({
    "oidcInfos": {
        "paddingTop": fr.spacing("6v"),
        "maxWidth": 650,
        "paddingBottom": fr.spacing("14v")
    },
    "title": {
        "marginBottom": fr.spacing("10v"),
        [fr.breakpoints.down("md")]: {
            "marginBottom": fr.spacing("8v")
        }
    },
    "inputAndPaddingBlockWrapper": {
        "position": "relative"
    },
    "inputWrapper": {
        "position": "absolute",
        "display": "flex",
        "width": "100%",
        [fr.breakpoints.down("md")]: {
            "flexDirection": "column"
        }
    },
    "input": {
        "flex": 1,
        [fr.breakpoints.down("md")]: {
            "width": "100%"
        }
    },
    "paddingBlock": {
        "height": 125,
        [fr.breakpoints.down("md")]: {
            "height": 150
        }
    },
    "isPublicCheckbox": {
        "marginBottom": 0,
        [`&&& .${fr.cx("fr-message")}`]: {
            "marginBottom": 0
        },
        "maxWidth": 700
    },
    "editorWrapper": {
        "marginBottom": fr.spacing("10v"),
        "position": "relative"
    },
    "editorWrapperOverlay": {
        "position": "absolute",
        "top": 0,
        "left": 0,
        "width": "100%",
        "height": "100%",
        "backgroundColor": fr.colors.decisions.background.disabled.grey.default,
        "opacity": 0.8,
        "cursor": "not-allowed",
        "zIndex": 1000
    },
    "updateButton": {
        "whiteSpace": "nowrap",
        "marginLeft": fr.spacing("4v")
    }
});

export const { i18n } = declareComponentKeys<
    | "title"
    | "mail"
    | "organization"
    | "manage account"
    | "no organization"
    | "update"
    | "not a valid email"
    | {
          K: "email domain not allowed";
          P: { domain: string };
      }
    | "about title"
    | "about description"
    | "isPublic label"
    | {
          K: "isPublic hint";
          P: { profileLik: Link };
          R: JSX.Element;
      }
    | "go to profile"
>()({ Account });

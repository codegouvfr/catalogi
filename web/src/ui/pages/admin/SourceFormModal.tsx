// SPDX-FileCopyrightText: 2021-2026 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2026 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Evt } from "evt";
import { useRerenderOnStateChange } from "evt/hooks";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { useCore, useCoreState } from "core";
import { maxSourceSettingMs, type ApiTypes } from "api";

const modal = createModal({
    id: "source-form",
    isOpenedByDefault: false
});

type Params = { source: ApiTypes.AdminSource };

const evtParams = Evt.create<Params | undefined>(undefined);

evtParams.toStateless().attach(() => modal.open());

export function openSourceFormModal(params: Params) {
    evtParams.state = params;
}

type CredentialDraft =
    | { action: "keep" }
    | { action: "replace"; value: string }
    | { action: "clear" };

type FormState = {
    url: string;
    settings: Partial<Record<ApiTypes.SourceSettingKey, string>>;
    credential: CredentialDraft;
};

type CheckState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "done"; result: ApiTypes.SourceConnectionCheckResult }
    | { status: "failed" };

function makeInitialState(source: ApiTypes.AdminSource | undefined): FormState {
    return {
        url: source?.url ?? "",
        settings: Object.fromEntries(
            (source?.configurationFields.settings ?? []).map(key => [
                key,
                source?.configuration.settings[key]?.toString() ?? ""
            ])
        ),
        credential: { action: "keep" }
    };
}

const isHttpsUrl = (value: string) => {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
};

const parseDuration = (value: string): number | null | undefined => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (!/^\d+$/.test(trimmed)) return undefined;
    const parsed = Number(trimmed);
    return parsed > 0 && parsed <= maxSourceSettingMs ? parsed : undefined;
};

export function SourceFormModal() {
    const { t } = useTranslation();
    const { classes } = useStyles();
    const { adminSources } = useCore().functions;
    const { isSaving, categories } = useCoreState("adminSources", "main");

    useRerenderOnStateChange(evtParams);
    const params = evtParams.state;

    // Read the source from the store so its credential status follows each save.
    const source =
        categories
            .flatMap(({ sources }) => sources)
            .find(({ slug }) => slug === params?.source.slug) ?? params?.source;

    const [form, setForm] = useState<FormState>(() => makeInitialState(source));
    const [errors, setErrors] = useState<{
        url?: string;
        settings?: Partial<Record<ApiTypes.SourceSettingKey, string>>;
    }>({});
    const [isSaved, setIsSaved] = useState(false);
    const [check, setCheck] = useState<CheckState>({ status: "idle" });
    // Ignores a connection check that resolves after the modal was reopened.
    const checkRequestId = useRef(0);

    useEffect(() => {
        setForm(makeInitialState(params?.source));
        setErrors({});
        setIsSaved(false);
        setCheck({ status: "idle" });
        checkRequestId.current++;
    }, [params]);

    // A token typed then abandoned does not outlive the modal.
    useIsModalOpen(modal, {
        onConceal: () => setForm(prev => ({ ...prev, credential: { action: "keep" } }))
    });

    if (source === undefined) {
        return <modal.Component title="">{null}</modal.Component>;
    }

    const { credential: credentialKind, settings: settingKeys } =
        source.configurationFields;

    const runCheck = async () => {
        const requestId = ++checkRequestId.current;
        setCheck({ status: "checking" });
        try {
            const result = await adminSources.checkConnection({ slug: source.slug });
            if (requestId === checkRequestId.current)
                setCheck({ status: "done", result });
        } catch {
            if (requestId === checkRequestId.current) setCheck({ status: "failed" });
        }
    };

    const submit = async () => {
        const newErrors: typeof errors = {};
        const url = form.url.trim();
        const isUrlChanged = source.isUrlEditable && url !== source.url;
        if (isUrlChanged && !isHttpsUrl(url)) {
            newErrors.url = t("admin.sourceForm.invalidUrl");
        }

        const settings: Partial<Record<ApiTypes.SourceSettingKey, number | null>> = {};
        for (const key of settingKeys) {
            const parsed = parseDuration(form.settings[key] ?? "");
            if (parsed === undefined) {
                newErrors.settings = {
                    ...newErrors.settings,
                    [key]: t("admin.sourceForm.invalidDuration", {
                        max: maxSourceSettingMs
                    })
                };
            } else {
                settings[key] = parsed;
            }
        }

        const credential =
            form.credential.action === "replace"
                ? form.credential.value.trim() === ""
                    ? undefined
                    : { action: "replace" as const, value: form.credential.value.trim() }
                : form.credential.action === "clear"
                  ? { action: "clear" as const }
                  : undefined;

        if (
            newErrors.url === undefined &&
            isUrlChanged &&
            source.configuration.isCredentialSet &&
            credential === undefined
        ) {
            newErrors.url = t("admin.sourceForm.urlChangeNeedsCredential");
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        try {
            await adminSources.update({
                slug: source.slug,
                ...(isUrlChanged && { url }),
                configuration: {
                    ...(settingKeys.length > 0 && { settings }),
                    ...(credential && { credential })
                }
            });
        } catch {
            /* keep modal open; sillApi.errorHandler already alerted the user */
            return;
        }

        setForm(prev => ({ ...prev, url, credential: { action: "keep" } }));
        setIsSaved(true);
        void runCheck();
    };

    const setCredential = (credential: CredentialDraft) =>
        setForm(prev => ({ ...prev, credential }));

    const credentialLabel =
        credentialKind === "token"
            ? t("admin.sourceForm.credentialToken")
            : credentialKind === "bearerToken"
              ? t("admin.sourceForm.credentialBearerToken")
              : t("admin.sourceForm.credentialClientId");

    return (
        <modal.Component
            title={t("admin.sourceForm.title", { slug: source.slug })}
            size="large"
            buttons={[
                {
                    doClosesModal: true,
                    priority: "secondary",
                    children: isSaved
                        ? t("admin.sourceForm.close")
                        : t("admin.sourceForm.cancel")
                },
                {
                    doClosesModal: false,
                    onClick: submit,
                    nativeButtonProps: { disabled: isSaving },
                    children: t("admin.sourceForm.save")
                }
            ]}
        >
            {isSaved && (
                <div className={classes.feedback} aria-live="polite">
                    <Alert
                        small
                        severity="success"
                        description={t("admin.sourceForm.saved")}
                    />
                    <CheckFeedback
                        check={check}
                        url={source.url}
                        isCredentialSet={source.configuration.isCredentialSet}
                    />
                </div>
            )}

            <h3 className={fr.cx("fr-h6")}>{t("admin.sourceForm.sectionIdentity")}</h3>
            <div className={classes.readOnlyRow}>
                {(
                    [
                        ["slug", source.slug],
                        ["kind", source.kind],
                        ["category", source.category]
                    ] as const
                ).map(([key, value]) => (
                    <Input
                        key={key}
                        label={t(`admin.sourceForm.${key}`)}
                        hintText={t("admin.sourceForm.readOnlyHint")}
                        disabled
                        nativeInputProps={{ value, readOnly: true }}
                    />
                ))}
            </div>
            <Input
                label={t("admin.sourceForm.url")}
                hintText={
                    source.isUrlEditable ? undefined : t("admin.sourceForm.forgeUrlHint")
                }
                disabled={!source.isUrlEditable}
                state={errors.url ? "error" : "default"}
                stateRelatedMessage={errors.url}
                nativeInputProps={{
                    type: "url",
                    value: form.url,
                    onChange: e => setForm(prev => ({ ...prev, url: e.target.value }))
                }}
            />

            <h3 className={fr.cx("fr-h6", "fr-mt-4w")}>
                {t("admin.sourceForm.sectionConfiguration")}
            </h3>
            {credentialKind === undefined && settingKeys.length === 0 && (
                <p className={fr.cx("fr-text--sm")}>
                    {t("admin.sourceForm.noConfiguration")}
                </p>
            )}

            {credentialKind !== undefined && (
                <fieldset className={fr.cx("fr-fieldset")}>
                    <legend className={fr.cx("fr-fieldset__legend")}>
                        {credentialLabel}
                    </legend>
                    <div className={classes.credential}>
                        <p className={fr.cx("fr-text--sm", "fr-mb-2v")}>
                            {source.configuration.isCredentialSet
                                ? t("admin.sourceForm.credentialStatusSet")
                                : t("admin.sourceForm.credentialStatusNotSet")}
                        </p>
                        {form.credential.action !== "clear" && (
                            <Input
                                label={t("admin.sourceForm.credentialNewValue")}
                                nativeInputProps={{
                                    type: "password",
                                    autoComplete: "off",
                                    value:
                                        form.credential.action === "replace"
                                            ? form.credential.value
                                            : "",
                                    onChange: e =>
                                        setCredential(
                                            e.target.value === ""
                                                ? { action: "keep" }
                                                : {
                                                      action: "replace",
                                                      value: e.target.value
                                                  }
                                        )
                                }}
                                addon={
                                    form.credential.action === "replace" && (
                                        <Button
                                            priority="secondary"
                                            iconId="fr-icon-arrow-go-back-line"
                                            title={t("admin.sourceForm.credentialRevert")}
                                            onClick={() =>
                                                setCredential({ action: "keep" })
                                            }
                                        />
                                    )
                                }
                            />
                        )}
                        {form.credential.action === "keep" &&
                            source.configuration.isCredentialSet && (
                                <Button
                                    priority="tertiary"
                                    size="small"
                                    onClick={() => setCredential({ action: "clear" })}
                                >
                                    {t("admin.sourceForm.credentialClear")}
                                </Button>
                            )}
                        {form.credential.action === "clear" && (
                            <>
                                <p className={fr.cx("fr-text--sm", "fr-error-text")}>
                                    {t("admin.sourceForm.credentialWillBeCleared")}
                                </p>
                                <Button
                                    priority="tertiary"
                                    size="small"
                                    onClick={() => setCredential({ action: "keep" })}
                                >
                                    {t("admin.sourceForm.credentialUndoClear")}
                                </Button>
                            </>
                        )}
                    </div>
                </fieldset>
            )}

            {settingKeys.map(key => (
                <Input
                    key={key}
                    label={t(`admin.sourceForm.${key}`)}
                    hintText={t("admin.sourceForm.settingHint")}
                    state={errors.settings?.[key] ? "error" : "default"}
                    stateRelatedMessage={errors.settings?.[key]}
                    nativeInputProps={{
                        inputMode: "numeric",
                        value: form.settings[key] ?? "",
                        onChange: e =>
                            setForm(prev => ({
                                ...prev,
                                settings: { ...prev.settings, [key]: e.target.value }
                            }))
                    }}
                />
            ))}

            {source.configuration.otherKeys.length > 0 && (
                <p className={fr.cx("fr-text--sm")}>
                    {t("admin.sourceForm.otherKeys", {
                        keys: source.configuration.otherKeys.join(", ")
                    })}
                </p>
            )}
        </modal.Component>
    );
}

function CheckFeedback(props: {
    check: CheckState;
    url: string;
    isCredentialSet: boolean;
}) {
    const { check, url, isCredentialSet } = props;
    const { t } = useTranslation();

    switch (check.status) {
        case "idle":
            return null;
        case "checking":
            return (
                <Alert
                    small
                    severity="info"
                    description={t("admin.sourceForm.checking")}
                />
            );
        case "failed":
            return (
                <Alert
                    small
                    severity="warning"
                    description={t("admin.sourceForm.checkFailed")}
                />
            );
        case "done":
            switch (check.result.status) {
                case "notApplicable":
                    return null;
                case "ok":
                    return (
                        <Alert
                            small
                            severity="success"
                            description={t(
                                isCredentialSet && check.result.isCredentialVerified
                                    ? "admin.sourceForm.checkOkWithCredential"
                                    : "admin.sourceForm.checkOk",
                                { url }
                            )}
                        />
                    );
                case "httpError": {
                    const status = check.result.httpStatus;
                    const isAuthError = status === 401 || status === 403;
                    return (
                        <Alert
                            small
                            severity={status === 429 ? "info" : "warning"}
                            description={t(
                                status === 429
                                    ? "admin.sourceForm.checkRateLimited"
                                    : isAuthError && isCredentialSet
                                      ? "admin.sourceForm.checkAuthRejected"
                                      : isAuthError
                                        ? "admin.sourceForm.checkAuthRequired"
                                        : "admin.sourceForm.checkHttpError",
                                { url, status }
                            )}
                        />
                    );
                }
                case "unreachable":
                    return (
                        <Alert
                            small
                            severity="warning"
                            description={t("admin.sourceForm.checkUnreachable", { url })}
                        />
                    );
            }
    }
}

const useStyles = tss.withName({ SourceFormModal }).create(() => ({
    feedback: {
        display: "flex",
        flexDirection: "column",
        gap: fr.spacing("2v"),
        marginBottom: fr.spacing("4v")
    },
    readOnlyRow: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
        gap: fr.spacing("4v")
    },
    credential: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: fr.spacing("2v"),
        width: "100%",
        "& .fr-input-group": {
            width: "100%",
            marginBottom: 0
        }
    }
}));

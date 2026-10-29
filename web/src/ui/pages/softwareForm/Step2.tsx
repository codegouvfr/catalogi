// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { SearchInput } from "ui/shared/SearchInput";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { useCore } from "core";
import type { FormData } from "core/usecases/softwareForm";
import type { ReturnType } from "tsafe";
import { useResolveLocalizedString } from "ui/i18n";
import { routes } from "ui/routes";
import { Trans, useTranslation } from "react-i18next";
import { useStyles } from "tss-react";
import { USER_INPUT_SOURCE_SLUG, type ApiTypes } from "api";
import { FieldSourcePopover } from "./FieldSourcePopover";
import { OverrideWarningModal, openOverrideWarningModal } from "./OverrideWarningModal";
import {
    hasMeaningfulValue,
    makeRenderValue
} from "ui/pages/softwareDetails/SourceProvenanceView";

export type Step2Props = {
    className?: string;
    isUpdateForm: boolean;
    initialFormData: FormData["step2"] | undefined;
    dataBySource: ApiTypes.SoftwareSourceData[];
    onSubmit: (formData: FormData["step2"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
    resolveRepoUrl: ReturnType<
        typeof useCore
    >["functions"]["softwareForm"]["resolveRepoUrl"];
    // Only in the update form: on creation, the entries citing the repository are
    // found by the API.
    getLibreSoftwareWikidataOptions: (
        queryString: string
    ) => Promise<
        ReturnType<
            ReturnType<
                typeof useCore
            >["functions"]["softwareForm"]["getExternalSoftwareOptions"]
        >
    >;
};

type ScalarOverridableField = keyof FormData["step2"]["userInputOverrides"];

type RepoResolutionState =
    | { status: "idle" }
    | { status: "resolving" }
    | ReturnType<Step2Props["resolveRepoUrl"]>;

const fieldRowStyle = { display: "flex", alignItems: "flex-end" } as const;

const SCALAR_FIELDS: ScalarOverridableField[] = [
    "name",
    "description",
    "license",
    "image"
];

export function SoftwareFormStep2(props: Step2Props) {
    const {
        className,
        isUpdateForm,
        initialFormData,
        dataBySource,
        onSubmit,
        evtActionSubmit,
        resolveRepoUrl,
        getLibreSoftwareWikidataOptions
    } = props;

    const { t } = useTranslation();
    const { resolveLocalizedString } = useResolveLocalizedString();
    const renderValue = useMemo(
        () => makeRenderValue(resolveLocalizedString),
        [resolveLocalizedString]
    );

    const {
        handleSubmit,
        control,
        register,
        watch,
        formState: { errors },
        setValue,
        getValues,
        clearErrors
    } = useForm<{
        codeRepositoryUrl: string;
        name: string;
        description: string;
        license: string;
        image: string;
        keywordsInputValue: string;
        wikidataEntry:
            | ReturnType<typeof getLibreSoftwareWikidataOptions>[number]
            | undefined;
    }>({
        defaultValues: (() => {
            if (initialFormData === undefined) {
                return undefined;
            }

            const {
                codeRepositoryUrl,
                externalId,
                keywords,
                userInputOverrides: _o,
                ...rest
            } = initialFormData ?? {};

            return {
                ...rest,
                codeRepositoryUrl: codeRepositoryUrl ?? "",
                wikidataEntry:
                    externalId === undefined
                        ? undefined
                        : {
                              externalId,
                              description: "",
                              name: rest.name
                          },
                keywordsInputValue: keywords.join(", ")
            };
        })()
    });

    const [userInputOverrides, setUserInputOverrides] = useState<
        FormData["step2"]["userInputOverrides"]
    >(() => initialFormData?.userInputOverrides ?? {});

    // dataBySource is empty in create mode until the software is persisted.
    // Without a stand-in, every field would land in state 1 and any user
    // interaction would silently force an override. virtualSource feeds the
    // same code path as a real persisted source so create and update behave
    // identically. Only set when the form is opened on a preselected Wikidata
    // entry.
    const [virtualSource] = useState<ApiTypes.SoftwareSourceData | undefined>(() => {
        if (isUpdateForm || initialFormData?.externalId === undefined) return undefined;

        return {
            sourceSlug: "wikidata",
            priority: 1,
            kind: "wikidata",
            sourceUrl: `https://www.wikidata.org/wiki/${initialFormData.externalId}`,
            externalId: initialFormData.externalId,
            lastDataFetchAt: undefined,
            name: initialFormData.name ? { fr: initialFormData.name } : undefined,
            description: initialFormData.description
                ? { fr: initialFormData.description }
                : undefined,
            license: initialFormData.license,
            image: initialFormData.image
        };
    });

    // Stand-in for the repository, like `virtualSource` for Wikidata. The
    // repository category comes first in source precedence.
    const [repoResolution, setRepoResolution] = useState<RepoResolutionState>({
        status: "idle"
    });

    const repoVirtualSource = useMemo((): ApiTypes.SoftwareSourceData | undefined => {
        if (repoResolution.status !== "found") return undefined;
        if (repoResolution.existingSoftwareId !== undefined) return undefined;

        return {
            sourceSlug: new URL(repoResolution.codeRepositoryUrl).host,
            priority: 1,
            kind: repoResolution.forgeKind,
            sourceUrl: repoResolution.codeRepositoryUrl,
            externalId: repoResolution.externalId,
            lastDataFetchAt: undefined,
            name: { en: repoResolution.name },
            description: repoResolution.description
                ? { en: repoResolution.description }
                : undefined,
            license: repoResolution.license,
            image: repoResolution.image,
            keywords: repoResolution.keywords
        };
    }, [repoResolution]);

    // Entries citing the repository (Wikidata, HAL...), ordered by precedence.
    // They are bound on creation, so they feed the form like persisted sources.
    const discoveredDataBySource = useMemo(
        () =>
            "discoveredDataBySource" in repoResolution &&
            repoResolution.existingSoftwareId === undefined
                ? repoResolution.discoveredDataBySource.filter(
                      source => source.sourceSlug !== virtualSource?.sourceSlug
                  )
                : [],
        [repoResolution, virtualSource]
    );

    const effectiveDataBySource = useMemo(
        () =>
            [
                repoVirtualSource,
                ...discoveredDataBySource,
                virtualSource,
                ...dataBySource
            ].filter(
                (source): source is ApiTypes.SoftwareSourceData => source !== undefined
            ),
        [repoVirtualSource, discoveredDataBySource, virtualSource, dataBySource]
    );

    type FieldUiState = {
        externalSource: ApiTypes.SoftwareSourceData | undefined;
        hasExternal: boolean;
        isOverridden: boolean;
        isEditable: boolean;
        showPencil: boolean;
        showCross: boolean;
        externalValue: string;
        hintText: string | undefined;
    };

    const fieldUiStates = useMemo(() => {
        const out = {} as Record<ScalarOverridableField, FieldUiState>;
        for (const field of SCALAR_FIELDS) {
            // effectiveDataBySource is ordered highest-precedence first; first
            // non-UserInput source with a value wins.
            const externalSource = effectiveDataBySource.find(
                s =>
                    s.kind !== USER_INPUT_SOURCE_SLUG &&
                    hasMeaningfulValue((s as Record<string, unknown>)[field])
            );
            const hasExternal = externalSource !== undefined;
            const isOverridden = userInputOverrides[field] === true;
            const externalValue = externalSource
                ? renderValue((externalSource as Record<string, unknown>)[field])
                : "";
            out[field] = {
                externalSource,
                hasExternal,
                isOverridden,
                isEditable: !hasExternal || isOverridden,
                showPencil: hasExternal && !isOverridden,
                showCross: hasExternal && isOverridden,
                externalValue,
                hintText: !hasExternal
                    ? undefined
                    : isOverridden
                      ? t("softwareFormStep2.source user input")
                      : t("softwareFormStep2.source external", {
                            sourceName: externalSource!.sourceSlug
                        })
            };
        }
        return out;
    }, [effectiveDataBySource, userInputOverrides, renderValue, t]);

    const requestOverride = (field: ScalarOverridableField, fieldLabel: string) => {
        const ui = fieldUiStates[field];
        if (!ui.hasExternal) return;
        openOverrideWarningModal({
            fieldLabel,
            sourceName: ui.externalSource!.sourceSlug,
            sourceUrl: ui.externalSource!.sourceUrl,
            onConfirm: () => {
                setUserInputOverrides(prev => ({ ...prev, [field]: true }));
                setValue(field, ui.externalValue, { shouldValidate: true });
            }
        });
    };

    // External-source keyword contributions surfaced under the keywords input.
    // Read-only — the union merge cannot un-include external keywords (v1 limitation).
    const keywordContributions = useMemo(
        () =>
            effectiveDataBySource.reduce<
                { source: ApiTypes.SoftwareSourceData; keywords: string[] }[]
            >((acc, source) => {
                if (source.kind === USER_INPUT_SOURCE_SLUG) return acc;
                const keywords = Array.isArray(source.keywords) ? source.keywords : [];
                if (keywords.length > 0) acc.push({ source, keywords });
                return acc;
            }, []),
        [effectiveDataBySource]
    );

    const cancelOverride = (field: ScalarOverridableField) => {
        setUserInputOverrides(prev => {
            // Absence and `false` both mean "no UserInput override"; keep the
            // payload compact while letting submit recompute explicit false flags.
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setValue(field, "", { shouldValidate: true });
    };

    const [submitButtonElement, setSubmitButtonElement] =
        useState<HTMLButtonElement | null>(null);

    useEvt(
        ctx => {
            if (submitButtonElement === null) {
                return;
            }

            evtActionSubmit.attach(ctx, () => submitButtonElement.click());
        },
        [evtActionSubmit, submitButtonElement]
    );

    const codeRepositoryUrl = watch("codeRepositoryUrl");

    // A url is not a search: it is checked once pasted, on blur, on Enter or with
    // the check button, not while being typed.
    const checkedRepoUrlRef = useRef<string | undefined>(undefined);
    const repoCheckIdRef = useRef(0);

    const checkRepoUrl = async (params: { force?: boolean } = {}) => {
        if (isUpdateForm) return;

        const url = getValues("codeRepositoryUrl").trim();
        if (url === "" || (url === checkedRepoUrlRef.current && !params.force)) return;

        checkedRepoUrlRef.current = url;
        const checkId = ++repoCheckIdRef.current;
        setRepoResolution({ status: "resolving" });
        clearErrors("codeRepositoryUrl");

        const resolution = await resolveRepoUrl({ url }).catch(
            (error): RepoResolutionState => {
                console.error("Failed to resolve repository url", { url, error });
                // The url is kept as user input, the form just isn't prefilled.
                return {
                    status: "unsupported",
                    codeRepositoryUrl: url,
                    discoveredSources: [],
                    discoveredDataBySource: [],
                    existingSoftwareId: undefined
                };
            }
        );

        if (checkId === repoCheckIdRef.current) setRepoResolution(resolution);
    };

    // Editing the url invalidates the previous check.
    useEffect(() => {
        if (isUpdateForm) return;
        if ((codeRepositoryUrl?.trim() ?? "") === checkedRepoUrlRef.current) return;

        checkedRepoUrlRef.current = undefined;
        repoCheckIdRef.current++;
        setRepoResolution({ status: "idle" });
    }, [codeRepositoryUrl, isUpdateForm]);

    // The fields below the url stay locked until a usable repository url is checked.
    const isRepoLocked =
        !isUpdateForm &&
        !(
            (repoResolution.status === "found" ||
                repoResolution.status === "notFound" ||
                repoResolution.status === "unreachable" ||
                repoResolution.status === "unsupported") &&
            repoResolution.existingSoftwareId === undefined
        );

    const codeRepositoryUrlRegistration = register("codeRepositoryUrl", {
        required: !isUpdateForm,
        // Block the step on an unchecked or unusable url, or on a duplicate.
        validate: () => !isRepoLocked
    });

    const repoUrlFeedback = (():
        | {
              state: "error" | "success" | "info";
              message: React.ReactNode;
          }
        | undefined => {
        if (errors.codeRepositoryUrl?.type === "required")
            return {
                state: "error",
                message: t("softwareFormStep2.repository url required")
            };

        if (
            errors.codeRepositoryUrl?.type === "validate" &&
            repoResolution.status === "idle"
        )
            return {
                state: "error",
                message: t("softwareFormStep2.repository url not checked")
            };

        if (
            repoResolution.status !== "idle" &&
            repoResolution.status !== "resolving" &&
            repoResolution.status !== "invalid" &&
            repoResolution.existingSoftwareId !== undefined
        ) {
            return {
                state: "error",
                message: (
                    <Trans
                        i18nKey="softwareFormStep2.repository already referenced"
                        components={{
                            softwareLink: (
                                /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                <a
                                    href={
                                        routes.softwareDetails({
                                            id: repoResolution.existingSoftwareId
                                        }).href
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            )
                        }}
                    />
                )
            };
        }

        switch (repoResolution.status) {
            case "idle":
                return undefined;
            case "resolving":
                return {
                    state: "info",
                    message: t("softwareFormStep2.repository resolving")
                };
            case "invalid":
                return {
                    state: "error",
                    message: t("softwareFormStep2.repository url invalid")
                };
            case "unsupported":
                return {
                    state: "info",
                    message: t("softwareFormStep2.repository unsupported")
                };
            case "notFound":
                return {
                    state: "info",
                    message: t("softwareFormStep2.repository not found", {
                        forgeKind: repoResolution.forgeKind
                    })
                };
            case "unreachable":
                return {
                    state: "info",
                    message: t("softwareFormStep2.repository unreachable", {
                        forgeKind: repoResolution.forgeKind
                    })
                };
            case "found":
                return {
                    state: "success",
                    message: t("softwareFormStep2.repository found", {
                        forgeKind: repoResolution.forgeKind
                    })
                };
        }
    })();

    const discoveredSources =
        "discoveredSources" in repoResolution ? repoResolution.discoveredSources : [];

    const { css } = useStyles();

    const renderToggleButton = (
        action: "override" | "cancel",
        field: ScalarOverridableField,
        fieldLabel: string,
        ui: FieldUiState
    ) => {
        const label =
            action === "override"
                ? t("softwareFormStep2.override field title", { fieldLabel })
                : t("softwareFormStep2.cancel override title", {
                      value: ui.externalValue,
                      sourceName: ui.externalSource!.sourceSlug
                  });
        return (
            <Button
                type="button"
                iconId={
                    action === "override" ? "fr-icon-edit-line" : "fr-icon-close-line"
                }
                priority="tertiary no outline"
                title={label}
                onClick={() =>
                    action === "override"
                        ? requestOverride(field, fieldLabel)
                        : cancelOverride(field)
                }
            >
                <span className="fr-sr-only">{label}</span>
            </Button>
        );
    };

    const renderField = (
        field: ScalarOverridableField,
        fieldLabel: string,
        opts: {
            hintText?: string;
            isRequired: boolean;
            pattern?: RegExp;
            errorMessage?: string;
        }
    ) => {
        const ui = fieldUiStates[field];
        const showError = opts.isRequired && ui.isEditable && errors[field] !== undefined;

        return (
            <div className={css(fieldRowStyle)}>
                <Input
                    className={css({ flex: 1 })}
                    disabled={isRepoLocked || !ui.isEditable}
                    style={{ marginTop: fr.spacing("4v") }}
                    label={fieldLabel}
                    hintText={ui.hintText ?? opts.hintText}
                    nativeInputProps={{
                        // Skip `required` when an external source already
                        // provides a value: an empty input then means
                        // "fall back to the source", not an error.
                        ...register(field, {
                            required: opts.isRequired && ui.isEditable && !ui.hasExternal,
                            pattern: opts.pattern
                        }),
                        value: ui.isEditable ? watch(field) : ui.externalValue
                    }}
                    state={showError ? "error" : undefined}
                    stateRelatedMessage={showError ? opts.errorMessage : undefined}
                />
                {!isRepoLocked &&
                    ui.showPencil &&
                    renderToggleButton("override", field, fieldLabel, ui)}
                {!isRepoLocked &&
                    ui.showCross &&
                    renderToggleButton("cancel", field, fieldLabel, ui)}
                <FieldSourcePopover dataBySource={effectiveDataBySource} field={field} />
            </div>
        );
    };

    const imagePreviewUrl = fieldUiStates.image.isEditable
        ? watch("image")
        : fieldUiStates.image.externalValue;

    return (
        <form
            className={className}
            onSubmit={handleSubmit(
                ({
                    codeRepositoryUrl,
                    wikidataEntry,
                    image,
                    keywordsInputValue,
                    name,
                    description,
                    license
                }) => {
                    // Empty value + external source available = implicit fallback
                    // to state 2 (drop the override). The cross button is the
                    // explicit affordance; emptying the input is a shortcut.
                    const resolveField = (
                        field: ScalarOverridableField,
                        value: string | undefined
                    ): { value: string | undefined; isOverridden: boolean } => {
                        const ui = fieldUiStates[field];
                        const isEmpty = value === undefined || value === "";
                        if (ui.hasExternal && (!ui.isOverridden || isEmpty)) {
                            return { value: ui.externalValue, isOverridden: false };
                        }
                        return { value, isOverridden: ui.isOverridden || !isEmpty };
                    };

                    const resolved = {
                        name: resolveField("name", name),
                        description: resolveField("description", description),
                        license: resolveField("license", license),
                        image: resolveField("image", image)
                    };

                    const trimmedRepoUrl = codeRepositoryUrl.trim();

                    onSubmit({
                        codeRepositoryUrl:
                            repoResolution.status === "found" ||
                            repoResolution.status === "notFound" ||
                            repoResolution.status === "unreachable" ||
                            repoResolution.status === "unsupported"
                                ? repoResolution.codeRepositoryUrl
                                : trimmedRepoUrl === ""
                                  ? undefined
                                  : trimmedRepoUrl,
                        // On creation, entries citing the repository are bound by the API.
                        externalId: isUpdateForm
                            ? wikidataEntry?.externalId
                            : initialFormData?.externalId,
                        name: resolved.name.value ?? "",
                        description: resolved.description.value ?? "",
                        license: resolved.license.value ?? "",
                        image:
                            resolved.image.value === undefined ||
                            resolved.image.value === ""
                                ? undefined
                                : resolved.image.value,
                        keywords: keywordsInputValue
                            .split(",")
                            .map(s => s.trim())
                            .filter(Boolean),
                        userInputOverrides: {
                            name: resolved.name.isOverridden,
                            description: resolved.description.isOverridden,
                            license: resolved.license.isOverridden,
                            image: resolved.image.isOverridden
                        }
                    });
                }
            )}
        >
            <Input
                label={t("softwareFormStep2.repository url")}
                hintText={t("softwareFormStep2.repository url hint")}
                nativeInputProps={{
                    ...codeRepositoryUrlRegistration,
                    onBlur: event => {
                        void codeRepositoryUrlRegistration.onBlur(event);
                        void checkRepoUrl();
                    },
                    // Let the pasted value reach the form state first.
                    onPaste: () => setTimeout(() => void checkRepoUrl()),
                    onKeyDown: event => {
                        if (event.key !== "Enter") return;
                        // Enter would submit the step.
                        event.preventDefault();
                        void checkRepoUrl();
                    },
                    inputMode: "url",
                    placeholder: "https://github.com/organisation/logiciel"
                }}
                addon={
                    isUpdateForm ? undefined : (
                        <Button
                            type="button"
                            disabled={repoResolution.status === "resolving"}
                            onClick={() => void checkRepoUrl({ force: true })}
                        >
                            {t("softwareFormStep2.repository check")}
                        </Button>
                    )
                }
                state={repoUrlFeedback?.state}
                stateRelatedMessage={repoUrlFeedback?.message}
            />
            {discoveredSources.length > 0 && (
                <p className={fr.cx("fr-text--sm")}>
                    {t("softwareFormStep2.repository discovered sources")}{" "}
                    {discoveredSources.map(
                        ({ sourceSlug, name, externalId, url }, index) => (
                            <Fragment key={sourceSlug}>
                                {index > 0 && ", "}
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    {`${sourceSlug} : ${name ?? externalId} (${externalId})`}
                                </a>
                            </Fragment>
                        )
                    )}
                </p>
            )}
            {isUpdateForm && (
                <Controller
                    name="wikidataEntry"
                    control={control}
                    rules={{ required: false }}
                    render={({ field }) => (
                        <SearchInput
                            debounceDelay={500}
                            getOptions={getLibreSoftwareWikidataOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            getOptionLabel={wikidataEntry =>
                                resolveLocalizedString(wikidataEntry.name)
                            }
                            renderOption={(liProps, wikidataEntity) => (
                                <li {...liProps} key={wikidataEntity.externalId}>
                                    <div>
                                        <span>
                                            {resolveLocalizedString(wikidataEntity.name)}
                                        </span>
                                        <br />
                                        <span className={fr.cx("fr-text--xs")}>
                                            {resolveLocalizedString(
                                                wikidataEntity.description
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}
                            noOptionText={t("app.no result")}
                            loadingText={t("app.loading")}
                            dsfrInputProps={{
                                label: t("softwareFormStep2.external id"),
                                hintText: (
                                    <Trans
                                        i18nKey={
                                            "softwareFormStep2.external id hint_fill"
                                        }
                                        components={{
                                            code: <code />,
                                            br: <br />,
                                            space: <span> </span>,
                                            dataSource: (
                                                /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                                <a
                                                    href="https://www.wikidata.org/wiki"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                />
                                            ),
                                            dataSourceEntry: (
                                                /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                                                <a
                                                    href="https://www.wikidata.org/wiki/Q107693197"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                />
                                            ),
                                            exampleUrl: (
                                                <a
                                                    href="https://code.gouv.fr/sill/detail?id=243"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Keycloakify
                                                </a>
                                            )
                                        }}
                                    />
                                ),
                                nativeInputProps: {
                                    ref: field.ref,
                                    onBlur: field.onBlur,
                                    name: field.name
                                }
                            }}
                        />
                    )}
                />
            )}
            {isRepoLocked && (
                <p className={fr.cx("fr-info-text")}>
                    {t("softwareFormStep2.repository fields locked")}
                </p>
            )}
            <div
                style={{
                    display: "flex",
                    alignItems: "end"
                }}
            >
                {renderField("image", t("softwareFormStep2.logo url"), {
                    hintText: t("softwareFormStep2.logo url hint"),
                    isRequired: false,
                    pattern: /^(?:https:)?\/\//,
                    errorMessage: t("softwareFormStep2.must be an url")
                })}
                {imagePreviewUrl && (
                    <img
                        src={imagePreviewUrl}
                        alt={t("softwareFormStep2.logo preview alt")}
                        style={{
                            marginLeft: fr.spacing("4v"),
                            border: `1px dotted ${fr.colors.decisions.border.default.grey.default}`,
                            width: 100,
                            height: 100,
                            objectFit: "cover",
                            objectPosition: "left"
                        }}
                    />
                )}
            </div>
            {renderField("name", t("softwareFormStep2.software name"), {
                isRequired: true,
                errorMessage: t("app.required")
            })}
            {renderField("description", t("softwareFormStep2.software feature"), {
                hintText: t("softwareFormStep2.software feature hint"),
                isRequired: true,
                errorMessage: t("app.required")
            })}
            {renderField("license", t("softwareFormStep2.license"), {
                hintText: t("softwareFormStep2.license hint"),
                isRequired: true,
                errorMessage: t("app.required")
            })}

            <Input
                disabled={isRepoLocked}
                style={{
                    marginTop: fr.spacing("4v")
                }}
                label={t("softwareFormStep2.keywords")}
                hintText={t("softwareFormStep2.keywords hint")}
                nativeInputProps={{
                    ...register("keywordsInputValue")
                }}
            />
            {keywordContributions.length > 0 && (
                <ul
                    className={fr.cx("fr-text--xs")}
                    style={{
                        marginTop: fr.spacing("1v"),
                        color: fr.colors.decisions.text.mention.grey.default,
                        listStyle: "none",
                        paddingLeft: 0
                    }}
                >
                    {keywordContributions.map(({ source, keywords }) => (
                        <li key={source.sourceSlug}>
                            {t("softwareFormStep2.keywords from source", {
                                sourceName: source.sourceSlug,
                                keywords: keywords.join(", ")
                            })}
                        </li>
                    ))}
                </ul>
            )}
            <button
                style={{ display: "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
            <OverrideWarningModal />
        </form>
    );
}

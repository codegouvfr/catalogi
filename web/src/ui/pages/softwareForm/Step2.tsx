// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useState, useId } from "react";
import { SearchInput } from "ui/shared/SearchInput";
import { fr } from "@codegouvfr/react-dsfr";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CircularProgressWrapper } from "ui/shared/CircularProgressWrapper";
import { assert } from "tsafe/assert";
import type { NonPostableEvt } from "evt";
import { useEvt } from "evt/hooks";
import { useCore } from "core";
import type { FormData } from "core/usecases/softwareForm";
import type { ReturnType } from "tsafe";
import { useResolveLocalizedString } from "ui/i18n";
import { Trans, useTranslation } from "react-i18next";
import { useStyles } from "tss-react";

export type Step2Props = {
    className?: string;
    isUpdateForm: boolean;
    initialFormData: FormData["step2"] | undefined;
    onSubmit: (formData: FormData["step2"]) => void;
    evtActionSubmit: NonPostableEvt<void>;
    getAutofillDataFromWikidata: ReturnType<
        typeof useCore
    >["functions"]["softwareForm"]["getAutofillData"];
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

export function SoftwareFormStep2(props: Step2Props) {
    const {
        className,
        isUpdateForm,
        initialFormData,
        onSubmit,
        evtActionSubmit,
        getLibreSoftwareWikidataOptions,
        getAutofillDataFromWikidata
    } = props;

    const { t } = useTranslation();
    const { resolveLocalizedString } = useResolveLocalizedString();

    const {
        handleSubmit,
        control,
        register,
        watch,
        formState: { errors },
        setValue
    } = useForm<{
        wikidataEntry:
            | ReturnType<typeof getLibreSoftwareWikidataOptions>[number]
            | undefined;
        softwareName: string;
        softwareDescription: string;
        softwareLicense: string;
        softwareMinimalVersion: string;
        softwareLogoUrl: string;
        keywordsInputValue: string;
    }>({
        defaultValues: (() => {
            if (initialFormData === undefined) {
                return undefined;
            }

            const { externalId, softwareKeywords, ...rest } = initialFormData ?? {};

            return {
                ...rest,
                wikidataEntry:
                    externalId === undefined
                        ? undefined
                        : {
                              externalId,
                              description: "",
                              label: rest.softwareName
                          },
                keywordsInputValue: softwareKeywords.join(", ")
            };
        })()
    });

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

    const wikidataInputId = useId();

    const { isAutocompleteInProgress } = (function useClosure() {
        const [isAutocompleteInProgress, setIsAutocompleteInProgress] = useState(false);

        const wikiDataEntry = watch("wikidataEntry");

        useEffect(() => {
            if (wikiDataEntry === undefined || isUpdateForm) {
                return;
            }

            let isActive = true;

            (async () => {
                setIsAutocompleteInProgress(true);

                const {
                    softwareName,
                    softwareDescription,
                    softwareLicense,
                    softwareMinimalVersion,
                    softwareLogoUrl
                } = await getAutofillDataFromWikidata({
                    externalId: wikiDataEntry.externalId
                });

                if (!isActive) {
                    return;
                }

                {
                    const [wikidataInputElement] =
                        document.getElementsByClassName(wikidataInputId);

                    assert(wikidataInputElement !== null);

                    wikidataInputElement.scrollIntoView({ behavior: "smooth" });
                }

                if (softwareDescription !== undefined) {
                    setValue("softwareDescription", softwareDescription);
                }

                if (softwareLicense !== undefined) {
                    setValue("softwareLicense", softwareLicense);
                }

                if (softwareMinimalVersion !== undefined) {
                    setValue("softwareMinimalVersion", softwareMinimalVersion);
                }

                if (softwareName !== undefined) {
                    setValue("softwareName", softwareName);
                }

                if (softwareLogoUrl !== undefined) {
                    setValue("softwareLogoUrl", softwareLogoUrl);
                }

                setIsAutocompleteInProgress(false);
            })();

            return () => {
                isActive = false;
            };
        }, [wikiDataEntry]);

        return { isAutocompleteInProgress };
    })();

    const { css } = useStyles();

    return (
        <form
            className={className}
            onSubmit={handleSubmit(
                ({ wikidataEntry, softwareLogoUrl, keywordsInputValue, ...rest }) =>
                    onSubmit({
                        ...rest,
                        softwareLogoUrl:
                            softwareLogoUrl === "" ? undefined : softwareLogoUrl,
                        softwareKeywords: keywordsInputValue
                            .split(",")
                            .map(s => s.trim()),
                        externalId: wikidataEntry?.externalId
                    })
            )}
        >
            <Controller
                name="wikidataEntry"
                control={control}
                rules={{ required: false }}
                render={({ field }) => (
                    <SearchInput
                        className={wikidataInputId}
                        debounceDelay={400}
                        getOptions={getLibreSoftwareWikidataOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        getOptionLabel={wikidataEntry =>
                            resolveLocalizedString(wikidataEntry.label)
                        }
                        renderOption={(liProps, wikidataEntity) => (
                            <li {...liProps} key={wikidataEntity.externalId}>
                                <div>
                                    <span>
                                        {resolveLocalizedString(wikidataEntity.label)}
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
                                    i18nKey={"softwareFormStep2.external id hint_fill"}
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
            <p className="fr-info-text">{t("softwareFormStep2.autofill notice")}</p>
            <div
                style={{
                    display: "flex",
                    alignItems: "end"
                }}
            >
                <CircularProgressWrapper
                    className={css({ flex: 1 })}
                    isInProgress={isAutocompleteInProgress}
                    renderChildren={({ style }) => (
                        <Input
                            disabled={isAutocompleteInProgress}
                            style={{
                                ...style,
                                marginTop: fr.spacing("4v")
                            }}
                            label={t("softwareFormStep2.logo url")}
                            hintText={t("softwareFormStep2.logo url hint")}
                            nativeInputProps={{
                                ...register("softwareLogoUrl", {
                                    pattern: /^(?:https:)?\/\//
                                })
                            }}
                            state={
                                errors.softwareLogoUrl !== undefined ? "error" : undefined
                            }
                            stateRelatedMessage={t("softwareFormStep2.must be an url")}
                        />
                    )}
                />
                {watch("softwareLogoUrl") && (
                    <img
                        src={watch("softwareLogoUrl")}
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
            <CircularProgressWrapper
                isInProgress={isAutocompleteInProgress}
                renderChildren={({ style }) => (
                    <Input
                        disabled={isAutocompleteInProgress}
                        style={{
                            ...style,
                            marginTop: fr.spacing("4v")
                        }}
                        label={t("softwareFormStep2.software name")}
                        nativeInputProps={{
                            ...register("softwareName", { required: true })
                        }}
                        state={errors.softwareName !== undefined ? "error" : undefined}
                        stateRelatedMessage={t("app.required")}
                    />
                )}
            />
            <CircularProgressWrapper
                isInProgress={isAutocompleteInProgress}
                renderChildren={({ style }) => (
                    <Input
                        disabled={isAutocompleteInProgress}
                        style={{
                            ...style,
                            marginTop: fr.spacing("4v")
                        }}
                        label={t("softwareFormStep2.software feature")}
                        hintText={t("softwareFormStep2.software feature hint")}
                        nativeInputProps={{
                            ...register("softwareDescription", { required: true })
                        }}
                        state={
                            errors.softwareDescription !== undefined ? "error" : undefined
                        }
                        stateRelatedMessage={t("app.required")}
                    />
                )}
            />
            <CircularProgressWrapper
                isInProgress={isAutocompleteInProgress}
                renderChildren={({ style }) => (
                    <Input
                        disabled={isAutocompleteInProgress}
                        style={{
                            ...style,
                            marginTop: fr.spacing("4v")
                        }}
                        label={t("softwareFormStep2.license")}
                        hintText={t("softwareFormStep2.license hint")}
                        nativeInputProps={{
                            ...register("softwareLicense", { required: true })
                        }}
                        state={errors.softwareLicense !== undefined ? "error" : undefined}
                        stateRelatedMessage={t("app.required")}
                    />
                )}
            />
            <CircularProgressWrapper
                isInProgress={isAutocompleteInProgress}
                renderChildren={({ style }) => (
                    <Input
                        disabled={isAutocompleteInProgress}
                        style={{
                            ...style,
                            marginTop: fr.spacing("4v")
                        }}
                        label={t("softwareFormStep2.minimal version")}
                        hintText={t("softwareFormStep2.minimal version hint")}
                        nativeInputProps={{
                            ...register("softwareMinimalVersion", { required: false })
                        }}
                        state={
                            errors.softwareMinimalVersion !== undefined
                                ? "error"
                                : undefined
                        }
                        stateRelatedMessage={t("app.required")}
                    />
                )}
            />
            <Input
                disabled={isAutocompleteInProgress}
                style={{
                    marginTop: fr.spacing("4v")
                }}
                label={t("softwareFormStep2.keywords")}
                hintText={t("softwareFormStep2.keywords hint")}
                nativeInputProps={{
                    ...register("keywordsInputValue")
                }}
            />
            <button
                style={{ display: "none" }}
                ref={setSubmitButtonElement}
                type="submit"
            />
        </form>
    );
}

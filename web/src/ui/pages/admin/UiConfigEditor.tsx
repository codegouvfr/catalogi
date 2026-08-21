// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type UIEvent
} from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { tss } from "tss-react";
import { useTranslation } from "react-i18next";
import { uiConfigSchema, type ApiTypes } from "api";
import { useCore, useCoreState } from "core";
import { LoadingFallback } from "ui/shared/LoadingFallback";

const formatConfig = (config: ApiTypes.UiConfig) => JSON.stringify(config, null, 2);

const jsonTokenPattern =
    /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(true|false)\b|(\bnull\b)|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

const highlightJson = (source: string): ReactNode[] => {
    const highlighted: ReactNode[] = [];
    let cursor = 0;

    for (const match of source.matchAll(jsonTokenPattern)) {
        const index = match.index;

        if (index > cursor) highlighted.push(source.slice(cursor, index));

        const kind =
            match[1] !== undefined
                ? "key"
                : match[2] !== undefined
                  ? "string"
                  : match[3] !== undefined
                    ? "boolean"
                    : match[4] !== undefined
                      ? "null"
                      : match[5] !== undefined
                        ? "number"
                        : "punctuation";

        highlighted.push(
            <span key={index} data-json-token={kind}>
                {match[0]}
            </span>
        );
        cursor = index + match[0].length;
    }

    if (cursor < source.length) highlighted.push(source.slice(cursor));

    return highlighted;
};

export function UiConfigEditor() {
    const { t } = useTranslation();
    const { classes, cx } = useStyles();
    const { uiConfig } = useCore().functions;
    const main = useCoreState("uiConfig", "main");
    const persisted = main?.uiConfig;
    const isSaving = main?.isSaving ?? false;

    const [draft, setDraft] = useState(() =>
        persisted === undefined ? "" : formatConfig(persisted)
    );
    const [error, setError] = useState<string>();
    const [isSaved, setIsSaved] = useState(false);
    const editorId = useId();
    const errorId = `${editorId}-error`;
    const highlightRef = useRef<HTMLPreElement>(null);
    const highlightedDraft = useMemo(() => highlightJson(draft), [draft]);

    useEffect(() => {
        if (persisted === undefined) return;
        setDraft(formatConfig(persisted));
        setError(undefined);
    }, [persisted]);

    const isDirty = useMemo(
        () => persisted !== undefined && draft !== formatConfig(persisted),
        [draft, persisted]
    );

    if (persisted === undefined) {
        return <LoadingFallback />;
    }

    const reset = () => {
        setDraft(formatConfig(persisted));
        setError(undefined);
        setIsSaved(false);
    };

    const syncHighlightScroll = (event: UIEvent<HTMLTextAreaElement>) => {
        if (highlightRef.current === null) return;
        highlightRef.current.scrollTop = event.currentTarget.scrollTop;
        highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    };

    const save = async () => {
        setError(undefined);
        setIsSaved(false);

        let json: unknown;

        try {
            json = JSON.parse(draft);
        } catch (error) {
            setError(
                t("admin.uiConfig.invalidJson", {
                    message: error instanceof Error ? error.message : String(error)
                })
            );
            return;
        }

        const result = uiConfigSchema.safeParse(json);

        if (!result.success) {
            setError(
                result.error.issues
                    .map(issue => {
                        const path =
                            issue.path.length === 0
                                ? t("admin.uiConfig.root")
                                : issue.path.join(".");
                        return `${path}: ${issue.message}`;
                    })
                    .join("\n")
            );
            return;
        }

        try {
            await uiConfig.update(result.data);
            setDraft(formatConfig(result.data));
            setIsSaved(true);
        } catch {
            setError(t("admin.uiConfig.saveError"));
        }
    };

    return (
        <div className={classes.root}>
            <div>
                <h2 className={fr.cx("fr-h4", "fr-mb-1v")}>
                    {t("admin.uiConfig.title")}
                </h2>
                <p className={fr.cx("fr-text--sm", "fr-hint-text", "fr-mb-3v")}>
                    {t("admin.uiConfig.description")}
                </p>
            </div>

            {isSaved && !isDirty && (
                <Alert severity="success" small description={t("admin.uiConfig.saved")} />
            )}

            <div
                className={fr.cx(
                    "fr-input-group",
                    error !== undefined && "fr-input-group--error"
                )}
            >
                <label className={fr.cx("fr-label")} htmlFor={editorId}>
                    {t("admin.uiConfig.editorLabel")}
                    <span className={fr.cx("fr-hint-text")}>
                        {t("admin.uiConfig.editorHint")}
                    </span>
                </label>
                <div className={classes.editorShell}>
                    <pre
                        ref={highlightRef}
                        className={classes.highlight}
                        aria-hidden="true"
                    >
                        {highlightedDraft}
                        {"\n"}
                    </pre>
                    <textarea
                        id={editorId}
                        className={cx(
                            fr.cx("fr-input", error !== undefined && "fr-input--error"),
                            classes.editor
                        )}
                        value={draft}
                        rows={28}
                        wrap="off"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-invalid={error !== undefined}
                        aria-describedby={error === undefined ? undefined : errorId}
                        onScroll={syncHighlightScroll}
                        onChange={event => {
                            setDraft(event.target.value);
                            setError(undefined);
                            setIsSaved(false);
                        }}
                    />
                </div>
                <div className={fr.cx("fr-messages-group")} aria-live="polite">
                    {error !== undefined && (
                        <p
                            id={errorId}
                            className={cx(fr.cx("fr-error-text"), classes.errorMessage)}
                        >
                            {error}
                        </p>
                    )}
                </div>
            </div>

            <div className={classes.actions}>
                <Button
                    priority="secondary"
                    disabled={!isDirty || isSaving}
                    onClick={reset}
                >
                    {t("admin.uiConfig.reset")}
                </Button>
                <Button priority="primary" disabled={!isDirty || isSaving} onClick={save}>
                    {isSaving ? t("admin.uiConfig.saving") : t("admin.uiConfig.save")}
                </Button>
            </div>
        </div>
    );
}

const editorTypography = {
    fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: "0.875rem",
    lineHeight: 1.55,
    tabSize: 2
} as const;

const useStyles = tss.withName({ UiConfigEditor }).create(() => ({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: fr.spacing("3v")
    },
    editorShell: {
        position: "relative"
    },
    editor: {
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: "36rem",
        resize: "vertical",
        ...editorTypography,
        color: "transparent",
        WebkitTextFillColor: "transparent",
        caretColor: "var(--text-default-grey)",
        backgroundColor: "transparent",
        "@media (forced-colors: active)": {
            color: "CanvasText",
            WebkitTextFillColor: "CanvasText",
            backgroundColor: "Canvas"
        }
    },
    highlight: {
        position: "absolute",
        zIndex: 0,
        inset: 0,
        display: "block",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        margin: 0,
        padding: "0.5rem 1rem",
        borderRadius: "0.25rem 0.25rem 0 0",
        overflow: "hidden",
        pointerEvents: "none",
        whiteSpace: "pre",
        ...editorTypography,
        color: "var(--text-default-grey)",
        backgroundColor: "var(--background-contrast-grey)",
        boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
        "& [data-json-token='key']": {
            color: "var(--text-action-high-blue-france)",
            fontWeight: 600
        },
        "& [data-json-token='string']": {
            color: "var(--text-label-green-emeraude)"
        },
        "& [data-json-token='number']": {
            color: "var(--text-label-orange-terre-battue)"
        },
        "& [data-json-token='boolean']": {
            color: "var(--text-label-purple-glycine)",
            fontWeight: 600
        },
        "& [data-json-token='null']": {
            color: "var(--text-label-pink-tuile)",
            fontStyle: "italic"
        },
        "& [data-json-token='punctuation']": {
            color: "var(--text-mention-grey)"
        },
        "@media (forced-colors: active)": {
            display: "none"
        }
    },
    errorMessage: {
        display: "block",
        whiteSpace: "pre-wrap"
    },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: fr.spacing("2v"),
        flexWrap: "wrap"
    }
}));

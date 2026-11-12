// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { attributeOptionIcons, type ApiTypes } from "api";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { optionIconClassByValue } from "ui/shared/attributeIcons";

type OptionIcon = "" | ApiTypes.AttributeOptionIcon;

/** Select look, opening a grid of icon buttons: a native select can't show icons */
export const OptionIconSelect = (props: {
    value: OptionIcon;
    onChange: (value: OptionIcon) => void;
}) => {
    const { value, onChange } = props;
    const labelId = useId();
    const buttonId = useId();
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Window capture runs before DSFR's Escape handler, which would close the modal
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        // Clicked buttons don't take focus in Safari, so blur can't detect outside clicks
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        window.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [isOpen]);
    const { t } = useTranslation();
    const { classes, cx } = useStyles();

    const iconLabel = (icon: OptionIcon) =>
        icon === "" ? t("admin.form.iconNone") : t(`admin.form.optionIcons.${icon}`);
    const iconGlyph = (icon: OptionIcon) =>
        icon === "" ? (
            <span aria-hidden="true">—</span>
        ) : (
            <i aria-hidden="true" className={fr.cx(optionIconClassByValue[icon])} />
        );

    return (
        <div
            ref={rootRef}
            className={cx(fr.cx("fr-select-group"), classes.root)}
            onBlur={event => {
                // Tabbing out; outside clicks are handled above
                const { relatedTarget } = event;
                if (
                    relatedTarget !== null &&
                    !event.currentTarget.contains(relatedTarget)
                ) {
                    setIsOpen(false);
                }
            }}
        >
            <label id={labelId} className={fr.cx("fr-label")} htmlFor={buttonId}>
                {t("admin.form.optionIcon")}
            </label>
            <button
                ref={triggerRef}
                id={buttonId}
                type="button"
                aria-labelledby={`${labelId} ${buttonId}`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={cx(fr.cx("fr-select"), classes.trigger)}
                onClick={() => setIsOpen(!isOpen)}
            >
                {value !== "" && iconGlyph(value)}
                {iconLabel(value)}
            </button>
            {isOpen && (
                <div
                    id={panelId}
                    role="group"
                    aria-labelledby={labelId}
                    className={classes.panel}
                >
                    {(["", ...attributeOptionIcons] as const).map(icon => (
                        <IconChoice
                            key={icon}
                            selected={icon === value}
                            label={iconLabel(icon)}
                            onClick={() => {
                                onChange(icon);
                                setIsOpen(false);
                                triggerRef.current?.focus();
                            }}
                        >
                            {iconGlyph(icon)}
                        </IconChoice>
                    ))}
                </div>
            )}
        </div>
    );
};

export function IconChoice(props: {
    selected: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    const { selected, label, onClick, children } = props;
    const { classes, cx } = useStyles();
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={onClick}
            className={cx(
                fr.cx("fr-btn", "fr-btn--sm", !selected && "fr-btn--tertiary"),
                classes.iconButton
            )}
        >
            {children}
        </button>
    );
}

const useStyles = tss.withName({ OptionIconSelect }).create({
    root: {
        position: "relative"
    },
    trigger: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v"),
        textAlign: "left"
    },
    panel: {
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "repeat(5, 40px)",
        gap: fr.spacing("2v"),
        padding: fr.spacing("2v"),
        backgroundColor: fr.colors.decisions.background.overlap.grey.default,
        boxShadow: "var(--overlap-shadow)"
    },
    iconButton: {
        width: 40,
        height: 40,
        padding: 0,
        justifyContent: "center"
    }
});

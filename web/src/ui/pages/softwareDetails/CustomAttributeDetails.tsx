import { fr } from "@codegouvfr/react-dsfr";
import Tooltip from "@mui/material/Tooltip";
import type { ApiTypes } from "api";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { useLang } from "../../i18n";

export type AttributeDefinitionForDetailDisplay = Pick<
    ApiTypes.AttributeDefinition,
    "name" | "kind" | "displayInDetails" | "label" | "description"
>;

type DisplayedCustomAttribute = {
    attributeDefinition: AttributeDefinitionForDetailDisplay;
    attributeValue: NonNullable<ApiTypes.AttributeValue>;
};

/** Attributes to show on the details page: flagged for display and filled in */
export const getDisplayedCustomAttributes = (params: {
    attributeDefinitions: AttributeDefinitionForDetailDisplay[] | undefined;
    customAttributes: ApiTypes.CustomAttributes | undefined;
}): DisplayedCustomAttribute[] => {
    const { attributeDefinitions = [], customAttributes } = params;

    if (customAttributes === undefined) return [];

    return attributeDefinitions.flatMap(attributeDefinition => {
        const attributeValue = customAttributes[attributeDefinition.name];

        if (!attributeDefinition.displayInDetails) return [];
        if (attributeValue === undefined || attributeValue === null) return [];

        return [{ attributeDefinition, attributeValue }];
    });
};

export const CustomAttributeLabel = (props: {
    attributeDefinition: AttributeDefinitionForDetailDisplay;
}) => {
    const { attributeDefinition } = props;
    const { classes } = useStyles();
    const { lang } = useLang();

    const label =
        typeof attributeDefinition.label === "string"
            ? attributeDefinition.label
            : attributeDefinition.label[lang];

    const description =
        !attributeDefinition.description ||
        typeof attributeDefinition.description === "string"
            ? attributeDefinition.description
            : attributeDefinition.description[lang];

    return (
        <>
            {label}
            {description && (
                // A button so the description is reachable by keyboard; Tooltip names it
                <Tooltip title={description} arrow>
                    <button type="button" className={classes.descriptionButton}>
                        <i
                            aria-hidden="true"
                            className={fr.cx("fr-icon-information-line", "fr-icon--sm")}
                        />
                    </button>
                </Tooltip>
            )}
        </>
    );
};

export const CustomAttributeValue = (props: DisplayedCustomAttribute) => {
    const { attributeDefinition, attributeValue } = props;
    const { classes, cx } = useStyles();
    const { lang } = useLang();
    const { t } = useTranslation();

    switch (attributeDefinition.kind) {
        case "boolean":
            return (
                <span className={classes.booleanValue}>
                    <i
                        aria-hidden="true"
                        className={cx(
                            fr.cx(
                                attributeValue
                                    ? "fr-icon-check-line"
                                    : "fr-icon-close-line"
                            ),
                            attributeValue ? classes.success : classes.error
                        )}
                    />
                    {attributeValue ? t("app.yes") : t("app.no")}
                </span>
            );
        case "date":
            return new Intl.DateTimeFormat(lang, {
                dateStyle: "short",
                timeStyle: "short"
            }).format(new Date(attributeValue as Date));
        case "url":
            // Only web links: the value is free text, a `javascript:` URL would run on click
            if (!isHttpUrl(attributeValue as string)) return attributeValue as string;
            return (
                <a
                    href={attributeValue as string}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {attributeValue as string}
                </a>
            );
        case "number":
        case "string":
            return String(attributeValue);
    }
};

const isHttpUrl = (value: string): boolean => {
    try {
        const { protocol } = new URL(value);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
};

const useStyles = tss.withName("CustomAttributeDetails").create({
    descriptionButton: {
        ...fr.spacing("margin", { left: "1v" }),
        padding: 0,
        border: "none",
        background: "none",
        color: "inherit",
        cursor: "help",
        verticalAlign: "middle"
    },
    booleanValue: {
        display: "inline-flex",
        alignItems: "center",
        gap: fr.spacing("2v")
    },
    success: {
        color: fr.colors.decisions.text.default.success.default
    },
    error: {
        color: fr.colors.decisions.text.default.error.default
    }
});

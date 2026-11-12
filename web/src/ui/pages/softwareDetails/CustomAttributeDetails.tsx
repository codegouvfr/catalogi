import { fr } from "@codegouvfr/react-dsfr";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import Tooltip from "@mui/material/Tooltip";
import { getDetailsSubsectionKey, type ApiTypes } from "api";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";
import { useLang, useResolveLocalizedString, type LocalizedString } from "../../i18n";
import { AttributeOptionBadge } from "ui/shared/AttributeOptionBadge";
import { DetailList, DetailSubsection } from "./DetailSection";

export type AttributeDefinitionForDetailDisplay = Pick<
    ApiTypes.AttributeDefinition,
    "name" | "kind" | "displayInDetails" | "label" | "description" | "options"
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

type CustomAttributeSubsection = {
    key: string;
    title: LocalizedString;
    displayedCustomAttributes: DisplayedCustomAttribute[];
};

/** Dedicated subsections of a details page section, left out when none of their attributes is filled in */
export const getCustomAttributeSubsections = (params: {
    section: string;
    attributeDefinitions: ApiTypes.AttributeDefinition[] | undefined;
    customAttributes: ApiTypes.CustomAttributes | undefined;
}): CustomAttributeSubsection[] => {
    const { section, attributeDefinitions = [], customAttributes } = params;

    const definitionsByTitle = new Map<string, ApiTypes.AttributeDefinition[]>();
    attributeDefinitions.forEach(attributeDefinition => {
        const { detailsSection, detailsSubsection } = attributeDefinition;
        if (detailsSection !== section || detailsSubsection === undefined) return;
        const key = getDetailsSubsectionKey(detailsSection, detailsSubsection);
        definitionsByTitle.set(key, [
            ...(definitionsByTitle.get(key) ?? []),
            attributeDefinition
        ]);
    });

    return [...definitionsByTitle].flatMap(([key, definitions]) => {
        const displayedCustomAttributes = getDisplayedCustomAttributes({
            attributeDefinitions: definitions,
            customAttributes
        });
        if (displayedCustomAttributes.length === 0) return [];
        return [
            { key, title: definitions[0].detailsSubsection!, displayedCustomAttributes }
        ];
    });
};

export const CustomAttributeSubsections = (props: {
    subsections: CustomAttributeSubsection[];
}) => {
    const { subsections } = props;
    const { resolveLocalizedString } = useResolveLocalizedString();

    return subsections.map(({ key, title, displayedCustomAttributes }) => (
        <DetailSubsection key={key} title={resolveLocalizedString(title)}>
            <DetailList
                rows={displayedCustomAttributes.map(displayedCustomAttribute => ({
                    key: displayedCustomAttribute.attributeDefinition.name,
                    label: (
                        <CustomAttributeLabel
                            attributeDefinition={
                                displayedCustomAttribute.attributeDefinition
                            }
                        />
                    ),
                    value: <CustomAttributeValue {...displayedCustomAttribute} />,
                    isWide: displayedCustomAttribute.attributeDefinition.kind === "text"
                }))}
            />
        </DetailSubsection>
    ));
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
    const { resolveLocalizedString } = useResolveLocalizedString();
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
        case "enum": {
            const option = attributeDefinition.options?.find(
                ({ value }) => value === attributeValue
            );
            if (option === undefined) return String(attributeValue);
            return (
                <AttributeOptionBadge
                    label={resolveLocalizedString(option.label)}
                    severity={option.severity}
                    icon={option.icon}
                />
            );
        }
        case "text":
            return (
                <CallOut classes={{ text: classes.longText }}>
                    {String(attributeValue)}
                </CallOut>
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
    longText: {
        whiteSpace: "pre-line"
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

import { fr } from "@codegouvfr/react-dsfr";
import { cx } from "@codegouvfr/react-dsfr/tools/cx";
import Tooltip from "@mui/material/Tooltip";
import type { ApiTypes } from "api";
import { Trans } from "react-i18next";
import { tss } from "tss-react";
import { useLang } from "../../i18n";
import { PreviewTab } from "./PreviewTab";

type AttributeDefinitionForDetailDisplay = Pick<
    ApiTypes.AttributeDefinition,
    "name" | "kind" | "displayInDetails" | "label" | "description"
>;

type CustomAttributesDetailsProps = {
    customAttributes: ApiTypes.CustomAttributes | undefined;
    attributeDefinitions: AttributeDefinitionForDetailDisplay[] | undefined;
};

export const CustomAttributeDetails = ({
    attributeDefinitions,
    customAttributes
}: CustomAttributesDetailsProps) => {
    if (!attributeDefinitions || attributeDefinitions.length === 0) return null;
    if (!customAttributes) return null;

    return attributeDefinitions.map(attributeDefinition => {
        const attributeName = attributeDefinition.name;
        const attributeValue = customAttributes[attributeName];
        return (
            <CustomAttributeDetail
                key={attributeName}
                attributeValue={attributeValue}
                attributeDefinition={attributeDefinition}
            />
        );
    });
};

type CustomAttributeDetailProps = {
    attributeValue: ApiTypes.AttributeValue;
    attributeDefinition: AttributeDefinitionForDetailDisplay;
};

const CustomAttributeDetail = ({
    attributeValue,
    attributeDefinition
}: CustomAttributeDetailProps) => {
    const { classes, cx } = useStyles();
    const { lang } = useLang();

    if (!attributeDefinition.displayInDetails) return null;
    if (attributeValue === undefined || attributeValue === null) return null;

    const label =
        typeof attributeDefinition.label === "string"
            ? attributeDefinition.label
            : attributeDefinition.label[lang];

    const description =
        !attributeDefinition.description ||
        typeof attributeDefinition.description === "string"
            ? attributeDefinition.description
            : attributeDefinition.description[lang];

    const renderValue = () => {
        if (attributeDefinition.kind === "date") {
            return new Intl.DateTimeFormat(lang, {
                dateStyle: "short",
                timeStyle: "short"
            }).format(new Date(attributeValue as Date));
        }
        if (
            attributeDefinition.kind === "number" ||
            attributeDefinition.kind === "string"
        ) {
            return attributeValue as string;
        }
        return null;
    };

    const inlineValue = renderValue();

    return (
        <div key={attributeDefinition.name} className={classes.item}>
            <div className={classes.labelRow}>
                {attributeDefinition.kind === "boolean" ? (
                    <>
                        <i
                            className={cx(
                                fr.cx(
                                    attributeValue
                                        ? "fr-icon-check-line"
                                        : "fr-icon-close-line"
                                ),
                                attributeValue
                                    ? classes.customAttributeStatusSuccess
                                    : classes.customAttributeStatusError
                            )}
                        />
                        <p className={cx(fr.cx("fr-text--md"), classes.label)}>{label}</p>
                        {description && (
                            <Tooltip title={description} arrow>
                                <i className={fr.cx("fr-icon-information-line")} />
                            </Tooltip>
                        )}
                    </>
                ) : (
                    <>
                        {description && (
                            <Tooltip title={description} arrow>
                                <i className={fr.cx("fr-icon-information-line")} />
                            </Tooltip>
                        )}
                        <p className={cx(fr.cx("fr-text--md"), classes.label)}>
                            {label}
                            {inlineValue && (
                                <span
                                    className={cx(
                                        fr.cx("fr-text--sm"),
                                        classes.inlineValue
                                    )}
                                >
                                    {" : "}
                                    {inlineValue}
                                </span>
                            )}
                        </p>
                    </>
                )}
            </div>

            {attributeDefinition.kind === "url" && attributeValue && (
                <div className={classes.valueRow}>
                    <a
                        href={attributeValue as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={fr.cx("fr-text--sm")}
                    >
                        {attributeValue as string}
                    </a>
                </div>
            )}
        </div>
    );
};

const useStyles = tss.withName({ CustomAttributeDetail }).create({
    item: {
        "&:not(:last-of-type)": {
            marginBottom: fr.spacing("4v")
        }
    },
    labelRow: {
        display: "flex",
        alignItems: "center",
        gap: fr.spacing("2v")
    },
    label: {
        margin: 0,
        color: fr.colors.decisions.text.label.grey.default
    },
    inlineValue: {
        color: fr.colors.decisions.text.default.grey.default
    },
    valueRow: {
        ...fr.spacing("padding", {
            left: "3v",
            top: "1v"
        })
    },
    customAttributeStatusSuccess: {
        color: fr.colors.decisions.text.default.success.default
    },
    customAttributeStatusError: {
        color: fr.colors.decisions.text.default.error.default
    }
});

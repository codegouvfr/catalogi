import { fr } from "@codegouvfr/react-dsfr";
import type { ApiTypes } from "api";
import { AttributeDefinition } from "api/dist/src/core/usecases/readWriteSillData/attributeTypes";
import { useLang } from "../../i18n";
import Tooltip from "@mui/material/Tooltip";

type CustomAttributesInCardProps = {
    customAttributes: ApiTypes.CustomAttributes | undefined;
    attributeDefinitions: ApiTypes.AttributeDefinition[] | undefined;
};

export const CustomAttributesInCard = ({
    customAttributes,
    attributeDefinitions
}: CustomAttributesInCardProps) => {
    if (!attributeDefinitions || attributeDefinitions.length === 0) return null;
    if (!customAttributes) return null;

    return attributeDefinitions.map(attributeDefinition => {
        const attributeName = attributeDefinition.name;
        const attributeValue = customAttributes[attributeName];
        return (
            <CustomAttributeInCard
                key={attributeName}
                attributeValue={attributeValue}
                attributeDefinition={attributeDefinition}
            />
        );
    });
};

type CustomAttributeOnCardProps = {
    attributeValue: ApiTypes.AttributeValue;
    attributeDefinition: ApiTypes.AttributeDefinition;
};

const CustomAttributeInCard = ({
    attributeValue,
    attributeDefinition
}: CustomAttributeOnCardProps) => {
    const { lang } = useLang();
    const shouldDisplayIconInCard =
        attributeDefinition.displayInCardIcon &&
        attributeDefinition.kind === "boolean" &&
        attributeValue === true;

    if (!shouldDisplayIconInCard) return null;

    const title =
        typeof attributeDefinition.label === "string"
            ? attributeDefinition.label
            : attributeDefinition.label[lang];

    if (!attributeDefinition.displayInCardIcon) return null;

    const getIcon = icondComponentByIconName[attributeDefinition.displayInCardIcon];

    if (!getIcon) return null;

    return (
        <Tooltip title={title} arrow>
            {getIcon()}
        </Tooltip>
    );
};

const icondComponentByIconName: Record<
    NonNullable<AttributeDefinition["displayInCardIcon"]>,
    () => React.ReactElement
> = {
    computer: () => <i className={fr.cx("fr-icon-computer-line")} />,
    "thumbs-up": () => <i className={fr.cx("fr-icon-thumb-up-line")} />,
    france: () => <i className={fr.cx("fr-icon-france-line")} />,
    question: () => <i className={fr.cx("fr-icon-questionnaire-line")} />,
    chat: () => <i className={fr.cx("fr-icon-chat-2-line")} />,
    star: () => <i className={fr.cx("fr-icon-star-line")} />
};

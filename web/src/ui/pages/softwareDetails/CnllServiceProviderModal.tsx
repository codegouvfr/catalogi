import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { Trans, useTranslation } from "react-i18next";

const modal = createModal({
    id: "cnll-service-provider",
    isOpenedByDefault: false
});

export const { open: openCnllServiceProviderModal } = modal;

type Props = {
    className?: string;
    softwareName: string;
    annuaireCnllServiceProviders: {
        name: string;
        siren: string;
        url: string;
    }[];
};

export function CnllServiceProviderModal(props: Props) {
    const { className, annuaireCnllServiceProviders, softwareName } = props;

    const { t } = useTranslation();

    return (
        <modal.Component
            className={className}
            title={t("cnllServiceProviderModal.modal title")}
            buttons={[
                {
                    doClosesModal: true,
                    children: t("cnllServiceProviderModal.close")
                }
            ]}
        >
            <Trans
                i18nKey="cnllServiceProviderModal.content description"
                components={{
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                    a: <a href="https://cnll.fr/" target="_blank" rel="noreferrer" />,
                    space: <span> </span>
                }}
                values={{
                    count: annuaireCnllServiceProviders.length,
                    softwareName: softwareName
                }}
            />
            <ul>
                {annuaireCnllServiceProviders.map(({ name, siren, url }) => (
                    <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                            {name}, siren: {siren}
                        </a>
                    </li>
                ))}
            </ul>
        </modal.Component>
    );
}

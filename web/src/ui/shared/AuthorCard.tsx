// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Card, CardHeader } from "@mui/material";
import { Catalogi } from "shared";
import { tss } from "tss-react";
import { MouseEventHandler } from "react";
import { useTranslation } from "react-i18next";
import Button from "@codegouvfr/react-dsfr/Button";
import { LogoURLButton } from "./LogoURLButton";

export type Props = {
    author: Catalogi.Person;
    handleClose?: MouseEventHandler<HTMLButtonElement>;
};

export function AuthorCard(props: Props) {
    const { author, handleClose } = props;

    const { classes } = useStyles();

    const { t } = useTranslation();

    return (
        <Card style={{ padding: "20px" }}>
            <CardHeader
                title={author.name}
                action={
                    handleClose ? (
                        <Button priority="secondary" onClick={handleClose}>
                            {t("app.close")}
                        </Button>
                    ) : (
                        ""
                    )
                }
            />
            <h6>{t("authorCard.affiliatedStructure")}</h6>
            {author?.affiliations?.map(affiliatedOrganization => {
                return (
                    <>
                        <a
                            target="_blank"
                            rel="noreferrer"
                            href={affiliatedOrganization.url}
                        >
                            {affiliatedOrganization.name}
                        </a>
                        <ul>
                            {affiliatedOrganization.parentOrganizations?.map(
                                parentOrganization => (
                                    <li>
                                        <a
                                            target="_blank"
                                            rel="noreferrer"
                                            href={parentOrganization.url}
                                        >
                                            {parentOrganization.name}
                                        </a>
                                        {parentOrganization.parentOrganizations && (
                                            <ul>
                                                {parentOrganization.parentOrganizations.map(
                                                    parentOrganization3 => (
                                                        <li>
                                                            <a
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                href={
                                                                    parentOrganization3.url
                                                                }
                                                            >
                                                                {parentOrganization3.name}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                )
                            )}
                        </ul>
                    </>
                );
            })}
            <div className={classes.externalLinkButtons}>
                <LogoURLButton url={author.url} labelFromURL={true} />
            </div>
        </Card>
    );
}

const useStyles = tss.withName({ AuthorCard }).create({
    externalLinkButtons: {
        display: "flex",
        alignItems: "center",
        justifyContent: "end",
        flexWrap: "wrap"
    }
});

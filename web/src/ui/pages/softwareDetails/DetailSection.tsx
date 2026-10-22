// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ReactNode } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";

type DetailSectionProps = {
    id: string;
    title: ReactNode;
    children: ReactNode;
};

/** Top-level block of the software details page, target of the side navigation. */
export const DetailSection = (props: DetailSectionProps) => {
    const { id, title, children } = props;
    const { classes } = useStyles();

    return (
        <section id={id} aria-labelledby={`${id}-title`} className={classes.section}>
            <h2 id={`${id}-title`} className={classes.sectionTitle}>
                {title}
            </h2>
            {children}
        </section>
    );
};

type DetailSubsectionProps = {
    title: ReactNode;
    children: ReactNode;
};

export const DetailSubsection = (props: DetailSubsectionProps) => {
    const { title, children } = props;
    const { classes } = useStyles();

    return (
        <div className={classes.subsection}>
            <h3 className={classes.subsectionTitle}>{title}</h3>
            {children}
        </div>
    );
};

const useStyles = tss.withName({ DetailSection }).create({
    section: {
        scrollMarginTop: fr.spacing("6v"),
        "& + &": {
            marginTop: fr.spacing("20v")
        }
    },
    sectionTitle: {
        marginBottom: fr.spacing("6v")
    },
    subsection: {
        "& + &": {
            marginTop: fr.spacing("12v")
        }
    },
    subsectionTitle: {
        marginBottom: fr.spacing("6v")
    }
});

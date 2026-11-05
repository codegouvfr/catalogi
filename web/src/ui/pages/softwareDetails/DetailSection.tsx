// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import type { ReactNode } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";
import { cx } from "@codegouvfr/react-dsfr/tools/cx";
import { getSectionTitleId, sectionNavStickyTop } from "./SectionNav";

type DetailSectionProps = {
    id: string;
    title: ReactNode;
    /** Tagline displayed under the title */
    description?: ReactNode;
    children: ReactNode;
};

/** Top-level block of the software details page, target of the side navigation. */
export const DetailSection = (props: DetailSectionProps) => {
    const { id, title, description, children } = props;
    const { classes } = useStyles();

    return (
        <section
            id={id}
            aria-labelledby={getSectionTitleId(id)}
            className={classes.section}
        >
            {/* Focusable from script only, see SectionNav */}
            <h2
                id={getSectionTitleId(id)}
                tabIndex={-1}
                className={cx(
                    classes.sectionTitle,
                    description !== undefined && classes.sectionTitleWithDescription
                )}
            >
                {title}
            </h2>
            {description !== undefined && (
                <p className={cx(fr.cx("fr-text--lead"), classes.sectionDescription)}>
                    {description}
                </p>
            )}
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
        // Lands the title level with the stuck side menu
        scrollMarginTop: sectionNavStickyTop,
        "& + &": {
            marginTop: fr.spacing("20v")
        }
    },
    sectionTitle: {
        marginBottom: fr.spacing("6v")
    },
    sectionTitleWithDescription: {
        marginBottom: fr.spacing("2v")
    },
    sectionDescription: {
        color: fr.colors.decisions.text.mention.grey.default,
        marginBottom: fr.spacing("12v")
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

// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { Fragment, type ReactNode } from "react";
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
            <div>{children}</div>
        </section>
    );
};

type DetailSubsectionProps = {
    /** Anchor for `#id` links */
    id?: string;
    title: ReactNode;
    children: ReactNode;
};

export const DetailSubsection = (props: DetailSubsectionProps) => {
    const { id, title, children } = props;
    const { classes } = useStyles();

    return (
        <div id={id} className={classes.subsection}>
            <h3 className={classes.subsectionTitle}>{title}</h3>
            {children}
        </div>
    );
};

export type DetailRow = {
    key: string;
    label: ReactNode;
    value: ReactNode;
    /** Spans the whole width, under its label */
    isWide?: boolean;
};

export const DetailList = (props: { rows: DetailRow[] }) => {
    const { rows } = props;
    const { classes } = useStyles();

    return (
        <dl className={classes.list}>
            {rows.map(({ key, label, value, isWide }) => (
                <Fragment key={key}>
                    <dt className={classes.label}>{label}</dt>
                    <dd className={cx(classes.value, isWide && classes.wideValue)}>
                        {value}
                    </dd>
                </Fragment>
            ))}
        </dl>
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
        scrollMarginTop: sectionNavStickyTop,
        // Spaced from any content before it; modals render nothing in place
        "*:not(dialog) ~ &": {
            marginTop: fr.spacing("12v")
        }
    },
    subsectionTitle: {
        marginBottom: fr.spacing("6v")
    },
    list: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 5fr)",
        columnGap: fr.spacing("6v"),
        rowGap: fr.spacing("4v"),
        alignItems: "baseline",
        margin: 0,
        // DSFR indents `dl` and `dd`, the list stays aligned with the titles
        paddingInlineStart: 0,
        [fr.breakpoints.down("md")]: {
            gridTemplateColumns: "minmax(0, 1fr)",
            rowGap: fr.spacing("1v")
        }
    },
    label: {
        margin: 0,
        color: fr.colors.decisions.text.mention.grey.default
    },
    value: {
        margin: 0,
        paddingInlineStart: 0,
        [fr.breakpoints.down("md")]: {
            marginBottom: fr.spacing("3v")
        }
    },
    wideValue: {
        gridColumn: "1 / -1"
    }
});

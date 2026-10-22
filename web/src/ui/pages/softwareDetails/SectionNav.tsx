// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from "react";
import { SideMenu } from "@codegouvfr/react-dsfr/SideMenu";
import { useTranslation } from "react-i18next";
import { tss } from "tss-react";

export type NavSection = {
    id: string;
    label: string;
};

type Props = {
    className?: string;
    sections: NavSection[];
};

export const SectionNav = (props: Props) => {
    const { className, sections } = props;
    const { t } = useTranslation();
    const { classes } = useStyles();

    const { activeSectionId, pinActiveSectionId } = useActiveSectionId(
        sections.map(({ id }) => id)
    );

    return (
        <SideMenu
            className={className}
            classes={{ inner: classes.inner }}
            sticky
            // Also gives its accessible name to the <nav>
            title={t("softwareDetails.nav burger button")}
            burgerMenuButtonText={t("softwareDetails.nav burger button")}
            items={sections.map(({ id, label }) => ({
                text: label,
                isActive: id === activeSectionId,
                linkProps: {
                    href: `#${id}`,
                    onClick: event => {
                        event.preventDefault();
                        pinActiveSectionId(id);
                        scrollToSection(id);
                        window.history.replaceState(null, "", `#${id}`);
                    }
                }
            }))}
        />
    );
};

export const scrollToSection = (id: string) => {
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    document
        .getElementById(id)
        ?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
};

/**
 * The active section is the last one whose top has crossed the upper quarter of the viewport.
 * A section picked in the menu stays active until the user scrolls by themselves: short sections
 * near the bottom of the page can't reach the top of the viewport and would never be selected.
 */
const useActiveSectionId = (sectionIds: string[]) => {
    const [activeSectionId, setActiveSectionId] = useState<string | undefined>(
        sectionIds[0]
    );
    const pinnedSectionIdRef = useRef<string | undefined>(undefined);

    const sectionIdsKey = sectionIds.join(",");

    useEffect(() => {
        let animationFrameId: number | undefined;

        const update = () => {
            animationFrameId = undefined;

            if (pinnedSectionIdRef.current !== undefined) return;

            const isScrolledToBottom =
                window.innerHeight + window.scrollY >=
                document.documentElement.scrollHeight - 2;

            if (isScrolledToBottom) {
                setActiveSectionId(sectionIds[sectionIds.length - 1]);
                return;
            }

            const threshold = window.innerHeight / 4;

            setActiveSectionId(
                sectionIds.reduce<string | undefined>((activeId, id) => {
                    const top = document.getElementById(id)?.getBoundingClientRect().top;
                    return top !== undefined && top <= threshold ? id : activeId;
                }, sectionIds[0])
            );
        };

        const onScroll = () => {
            animationFrameId ??= window.requestAnimationFrame(update);
        };

        const onUserScrollIntent = (event: Event) => {
            if (pinnedSectionIdRef.current === undefined) return;
            if (event instanceof KeyboardEvent && !scrollKeys.includes(event.key)) return;
            pinnedSectionIdRef.current = undefined;
            onScroll();
        };

        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        userScrollIntentEvents.forEach(eventName =>
            window.addEventListener(eventName, onUserScrollIntent, { passive: true })
        );

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            userScrollIntentEvents.forEach(eventName =>
                window.removeEventListener(eventName, onUserScrollIntent)
            );
            if (animationFrameId !== undefined) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [sectionIdsKey]);

    const pinActiveSectionId = (id: string) => {
        pinnedSectionIdRef.current = id;
        setActiveSectionId(id);
    };

    return { activeSectionId, pinActiveSectionId };
};

const userScrollIntentEvents = ["wheel", "touchmove", "keydown"] as const;

const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];

const useStyles = tss.withName({ SectionNav }).create({
    // The page column carries the vertical separator, so it spans the whole content height
    inner: {
        boxShadow: "none"
    }
});

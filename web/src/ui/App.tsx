// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

import { getIsDark } from "@codegouvfr/react-dsfr/useIsDark";
import { createCoreProvider, useCore, useCoreState } from "core";
import { declareComponentKeys } from "i18nifty";
import { useConst } from "powerhooks/useConst";
import { useDomRect } from "powerhooks/useDomRect";
import { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { objectKeys } from "tsafe/objectKeys";
import { keyframes, tss, useStyles as useCss } from "tss-react";
import { evtLang } from "ui/i18n";
import { pages } from "ui/pages";
import { RouteProvider, useRoute } from "ui/routes";
import { Footer } from "ui/shared/Footer";
import { Header } from "ui/shared/Header";
import { LoadingFallback, loadingFallbackClassName } from "ui/shared/LoadingFallback";
import { apiUrl, appPath, appUrl } from "urls";
import { PromptForOrganization } from "./shared/PromptForOrganization";
import { MIN_SESSION_DURATION_MS } from "core/adapter/sillApi";

const { CoreProvider } = createCoreProvider({
    apiUrl,
    appUrl,
    getCurrentLang: () => evtLang.state,
    getIsDark,
    // TODO: Remove, this was to redirect to an other instance of the sill
    onMoved: ({ redirectUrl }) => {
        const currentUrlObj = new URL(window.location.href);

        const newPathname = currentUrlObj.pathname.replace(appPath, "");

        const targetUrlObj = new URL(redirectUrl);

        const newUrl = new URL(
            targetUrlObj.pathname +
                newPathname +
                currentUrlObj.search +
                currentUrlObj.hash,
            targetUrlObj.origin
        );

        window.location.href = newUrl.toString();
    }
    // NOTE: Passed so that it can be injected in the Account management URL.
    // I'm not comfortable with this level of indirection, this is only UI related logic
    // that shouldn't involve the core. However I do it this way for consistency sake.
});

export default function App() {
    const { css } = useCss();

    return (
        <CoreProvider fallback={<LoadingFallback className={css({ height: "100vh" })} />}>
            <RouteProvider>
                <ContextualizedApp />
            </RouteProvider>
        </CoreProvider>
    );
}

function ContextualizedApp() {
    const route = useRoute();

    const { userAuthentication, sillApiVersion } = useCore().functions;
    const { currentUser } = useCoreState("userAuthentication", "currentUser");

    const headerUserAuthenticationApi = useConst(() =>
        currentUser
            ? {
                  isUserLoggedIn: true as const,
                  logout: () => userAuthentication.logout()
              }
            : {
                  isUserLoggedIn: false as const,
                  login: () => userAuthentication.login()
              }
    );

    const {
        ref: headerRef,
        domRect: { height: headerHeight }
    } = useDomRect();

    const { classes } = useStyles({ headerHeight });

    const { t } = useTranslation();

    useEffect(() => {
        document.title = t("app.title");
    }, []);

    // Poll user authentication periodically to detect session expiry (only when logged in)
    useEffect(() => {
        if (!currentUser) return;

        const interval = setInterval(() => {
            userAuthentication.getCurrentUser();
        }, MIN_SESSION_DURATION_MS);

        return () => clearInterval(interval);
    }, [userAuthentication, currentUser]);

    return (
        <div className={classes.root}>
            <Header
                ref={headerRef}
                routeName={route.name}
                userAuthenticationApi={headerUserAuthenticationApi}
            />
            <main className={classes.main}>
                <Suspense fallback={<LoadingFallback />}>
                    {(() => {
                        for (const pageName of objectKeys(pages)) {
                            //You must be able to replace "home" by any other page and get no type error.
                            const page = pages[pageName as "home"];

                            if (page.routeGroup.has(route)) {
                                if (
                                    page.getDoRequireUserLoggedIn(route) &&
                                    !currentUser
                                ) {
                                    userAuthentication.login();
                                    return <LoadingFallback />;
                                }

                                if (currentUser && !currentUser.organization) {
                                    return <PromptForOrganization firstTime={true} />;
                                }

                                return (
                                    <page.LazyComponent
                                        route={route}
                                        className={classes.page}
                                    />
                                );
                            }
                        }

                        return <pages.page404.LazyComponent className={classes.page} />;
                    })()}
                </Suspense>
            </main>
            <Footer version={sillApiVersion.getSillApiVersion()} />
        </div>
    );
}

const useStyles = tss
    .withName({ App })
    .withParams<{ headerHeight: number }>()
    .create(({ headerHeight }) => ({
        root: {
            height: "100vh",
            display: "flex",
            flexDirection: "column"
        },
        main: {
            flex: 1,
            [`& .${loadingFallbackClassName}`]: {
                height: `calc(100vh - ${headerHeight}px)`
            }
        },
        page: {
            animation: `${keyframes`
          0% {
              opacity: 0;
          }
          100% {
              opacity: 1;
          }
      `} 400ms`
        }
    }));

/**
 * "App" key is used for common translation keys
 */
export const { i18n } = declareComponentKeys<
    | "yes"
    | "no"
    | "not applicable"
    | "previous"
    | "next"
    | "add software"
    | "update software"
    | "add software or service"
    | "add instance"
    | "update instance"
    | "required"
    | "invalid url"
    | "invalid version"
    | "all"
    | "allFeminine"
    | "loading"
    | "no result"
    | "search"
    | "validate"
    | "not provided"
>()("App");

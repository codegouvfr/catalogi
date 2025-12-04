const getApiCallTakeFirst = async <T>(url: string): Promise<T | undefined> => {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(10000)
    }).catch(err => {
        console.error(url, err);
    });

    if (!res) {
        return undefined;
    }
    if (res.status === 404) {
        console.error("Ressource not available");
        return undefined;
    }
    if (res.status === 403) {
        console.info(`You don't seems to be allowed on ${url}`);
        return undefined;
    }

    const result: T[] = await res.json();

    return result[0];
};

export const makeProjectEndpoint = (projectUrl: string | URL) => {
    return {
        languages: () => getApiCallTakeFirst<Record<string, number>>(`${projectUrl}/languages`)
    };
};

import { env } from "../../../env";

export const getAuthRedirectUri = (): string => `${env.appUrl}/api/auth/callback`;

export type OmitFromExisting<T, K extends keyof T> = Omit<T, K>;

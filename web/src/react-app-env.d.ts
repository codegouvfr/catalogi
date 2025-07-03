/// <reference types="react-scripts" />
declare module "*.md" {
    const src: string;
    export default src;
}

declare module "urlon" {
    const URLON: {
        parse<T>(raw: string): T;
        stringify(obj: any): string;
    };
    export default URLON;
}

// SPDX-License-Identifier: MIT
import type { Software } from "../../core/usecases/readWriteSillData/types";

/** JSON wire representation: Date/URL become strings and undefined object properties may be omitted. */
export type Json<T> = T extends Date | URL
    ? string
    : T extends (infer Item)[]
      ? Json<Item>[]
      : T extends object
        ? JsonObject<T>
        : T;

export type JsonObject<
    T,
    Required = {
        [K in keyof T as undefined extends T[K] ? never : K]: Json<T[K]>;
    },
    Optional = {
        [K in keyof T as undefined extends T[K] ? K : never]?: Json<T[K]>;
    }
> = { [K in keyof (Required & Optional)]: (Required & Optional)[K] };

// These historical values exist in the public export but are not represented by the internal types.
type LegacyKeyword = { id: string; "numeric-id": number; "entity-type": "item" };
type LegacyAuthor = { id: string; name: string; url?: string };
type Dereferencing = NonNullable<Software["dereferencing"]>;

export type SoftwareV2 = Json<
    Omit<Software, "keywords" | "authors" | "dereferencing"> & {
        keywords: Array<Software["keywords"][number] | LegacyKeyword>;
        authors: Array<Software["authors"][number] | LegacyAuthor>;
        dereferencing?: Omit<Dereferencing, "dereferencedByUserId"> &
            Partial<Pick<Dereferencing, "dereferencedByUserId">>;
    }
>;
export type CatalogV2 = SoftwareV2[];

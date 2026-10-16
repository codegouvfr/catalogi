import { z, ZodObject, ZodRawShape } from "zod";

export const deepMergeZodObjects = <T extends ZodRawShape, U extends ZodRawShape>(
    schemaA: ZodObject<T>,
    schemaB: ZodObject<U>
) => {
    const mergedShape: ZodRawShape = { ...schemaA.shape };

    for (const key in schemaB.shape) {
        const fieldA = schemaA.shape[key];
        const fieldB = schemaB.shape[key];

        if (fieldA instanceof ZodObject && fieldB instanceof ZodObject) {
            mergedShape[key] = deepMergeZodObjects(fieldA, fieldB);
        } else {
            mergedShape[key] = fieldB;
        }
    }

    return z.object(mergedShape).strict();
};

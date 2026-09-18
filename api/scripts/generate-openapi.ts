// SPDX-License-Identifier: MIT
import { writeFileSync } from "fs";
import { join } from "path";
import { createOpenApiDocument } from "../src/rpc/publicApi/openapi";

writeFileSync(
    join(__dirname, "../src/rpc/publicApi/openapi.json"),
    JSON.stringify(createOpenApiDocument(), null, 2) + "\n"
);

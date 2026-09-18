// SPDX-FileCopyrightText: 2026 DINUM <floss@numerique.gouv.fr>
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import { isHttpUrl } from "./isHttpUrl";

describe("isHttpUrl", () => {
    it.each([
        "http://example.org",
        "https://example.org/path?q=1#fragment",
        "HTTPS://example.org/path?q=1#fragment",
        "https://example.org/path "
    ])("accepts %j", value => {
        expect(isHttpUrl(value)).toBe(true);
    });

    it.each([
        undefined,
        null,
        42,
        "",
        "javascript:document.title='test'",
        "JaVaScRiPt:alert(1)",
        "\u0000 javascript:alert(1)",
        "java\tscript:alert(1)",
        "java\nscript:alert(1)",
        "java\rscript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "ftp://example.org/file",
        "//example.org/path",
        "/relative",
        "not a URL",
        "http",
        "https://",
        "https://[invalid",
        "https://exa mple.org"
    ])("rejects %j", value => {
        expect(isHttpUrl(value)).toBe(false);
    });
});

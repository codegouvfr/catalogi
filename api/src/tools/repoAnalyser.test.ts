import { describe, it, expect, vi } from "vitest";
import { repoAnalyser } from "./repoAnalyser";

describe("repoAnalyser", () => {
    it("should return undefined if url is undefined", async () => {
        const result = await repoAnalyser(undefined);
        expect(result).toBeUndefined();
    });

    it('should return "GitHub" for GitHub URLs', async () => {
        const result = await repoAnalyser("https://github.com/");
        expect(result).toBe("GitHub");
    });

    it('should return "GitHub" for GitHub URLs', async () => {
        const result = await repoAnalyser("git+https://github.com/agorajs/agora-gml.git");
        expect(result).toBe("GitHub");
    });

    it('should return "GitLab" for GitLab URLs', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers({
                "x-gitlab-meta": "true"
            })
        });

        global.fetch = mockFetch;

        const result = await repoAnalyser("https://gitlab.com/");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for gite.lirmm.fr URLs', async () => {
        const result = await repoAnalyser("https://gite.lirmm.fr/doccy/RedOak");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for gricad-gitlab URLs', async () => {
        const result = await repoAnalyser("https://gricad-gitlab.univ-grenoble-alpes.fr/kraifo/ailign");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for gitlab.lis-lab.fr/ URLs', async () => {
        const result = await repoAnalyser("https://gitlab.lis-lab.fr/dev/mincoverpetri");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for inria gitlab URLs', async () => {
        const result = await repoAnalyser("https://forgemia.inra.fr/lisc/easyabc");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for gricad-gitlab URLs', async () => {
        const result = await repoAnalyser("https://gricad-gitlab.univ-grenoble-alpes.fr/kraifo/ailign");
        expect(result).toBe("GitLab");
    });

    it('should return "GitLab" for gricad-gitlab URLs', async () => {
        const result = await repoAnalyser("https://gricad-gitlab.univ-grenoble-alpes.fr/kraifo/ailign");
        expect(result).toBe("GitLab");
    });

    it("should return undefined for unknown URLs", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            headers: new Headers()
        });

        global.fetch = mockFetch;

        const result = await repoAnalyser("https://unknown.com/");
        expect(result).toBeUndefined();
    });

    it("should return undefined for pari.math.u-bordeaux.fr URLs", async () => {
        const result = await repoAnalyser("https://pari.math.u-bordeaux.fr/git/pari.git");
        expect(result).toBeUndefined();
    });

    it("should return undefined for codeberg URLs", async () => {
        const result = await repoAnalyser("https://codeberg.org/tesselle/aion");
        expect(result).toBeUndefined();
    });

    it("should return undefined for CRAN.R-project.org URLs", async () => {
        const result = await repoAnalyser("https://CRAN.R-project.org/package=glober");
        expect(result).toBeUndefined();
    });

    it("should return undefined for Zenodo DOI URLs", async () => {
        const result = await repoAnalyser("https://doi.org/10.5281/zenodo.11069161");
        expect(result).toBeUndefined();
    });

    it("should return undefined for who.rocq.inria.fr URLs", async () => {
        const result = await repoAnalyser(
            "https://who.rocq.inria.fr/Jean-Charles.Gilbert/modulopt/optimization-routines/n1cv2/n1cv2.html"
        );
        expect(result).toBeUndefined();
    });
});

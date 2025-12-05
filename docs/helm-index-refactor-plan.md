# Plan: Eliminate Post-Release Commit on Main Branch

## Problem
Every release creates an extra commit on `main` branch: "chore: update Helm chart index for vX.X.X". This pollutes the git history.

## Solution Overview (Revised)
Use a separate `gh-pages` branch for the Helm index. After each release:
1. Checkout/create `gh-pages` branch
2. Reset it hard on `main` (`git reset --hard origin/main`) - ensures exact sync, no conflicts
3. Generate and commit index.yaml to `gh-pages`
4. Force push `gh-pages`
5. Configure GitHub Pages to serve from `gh-pages` branch

**Result:** `main` stays clean, `gh-pages` has one extra commit with the index.

## Why This Approach is Better

✅ **Simpler:**
- No new developer requirements (no Helm installation needed locally)
- No pre-commit hooks needed
- Fewer code changes

✅ **Cleaner:**
- `main` branch history stays pristine
- `gh-pages` branch rebased on main each time (always one commit ahead)
- Clear separation: main = source code, gh-pages = published artifacts

✅ **Standard Pattern:**
- Common approach for GitHub Pages deployments
- Many projects use this pattern

## Implementation Steps

### 1. Modify publish_helm_index Job
**File:** `.github/workflows/ci.yaml`

**Current behavior (lines 105-145):**
- Downloads chart from release
- Generates index
- Commits to `main` branch ❌

**New behavior:**
```yaml
publish_helm_index:
  name: Publish Helm chart index
  runs-on: ubuntu-latest
  permissions:
    contents: write
  needs:
    - check_if_version_upgraded
    - create_github_release
  if: needs.check_if_version_upgraded.outputs.is_upgraded_version == 'true'
  env:
    TO_VERSION: ${{ needs.check_if_version_upgraded.outputs.to_version }}
  steps:
    - name: Generate GitHub App token
      id: generate_token
      uses: tibdex/github-app-token@v2
      with:
        app_id: ${{ secrets.RELEASE_APP_ID }}
        private_key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}

    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        token: ${{ steps.generate_token.outputs.token }}
        fetch-depth: 0  # Need full history for rebase

    - name: Configure git
      run: |
        git config --local user.email "actions@github.com"
        git config --local user.name "GitHub Actions"

    - name: Setup gh-pages branch
      run: |
        # Fetch all branches
        git fetch origin

        # Check if gh-pages exists remotely
        if git ls-remote --heads origin gh-pages | grep gh-pages; then
          git checkout gh-pages
        else
          # First time: create gh-pages branch
          git checkout -b gh-pages
        fi

        # Reset gh-pages to match main exactly (no conflicts possible)
        git reset --hard origin/main

    - name: Install Helm
      uses: azure/setup-helm@v4

    - name: Create charts directory
      run: mkdir -p docs/charts

    - name: Download chart from release
      run: |
        gh release download v${TO_VERSION} --pattern "catalogi-*.tgz" --dir docs/charts/
      env:
        GH_TOKEN: ${{ github.token }}  # Built-in token, automatically available

    - name: Generate Helm repository index with merge
      run: |
        helm repo index docs/charts/ --url https://github.com/codegouvfr/catalogi/releases/download/v${TO_VERSION}/ --merge docs/charts/index.yaml

    - name: Commit and push to gh-pages
      run: |
        git add docs/charts/index.yaml
        git commit -m "chore: update Helm chart index for v${TO_VERSION}"
        git push origin gh-pages --force
```

**Key changes:**
- `fetch-depth: 0` - Need full history for reset and branch operations
- New step to setup gh-pages branch with `reset --hard origin/main`
- Push to `gh-pages` instead of `main`
- Use `--force` since we're resetting (no conflicts possible, simpler than --force-with-lease)

**Token Usage (No New Configuration Needed):**
- `${{ github.token }}` - Built-in GitHub Actions secret, automatically available in all workflows
- GitHub App token (already configured) - Used for elevated git permissions via existing secrets

### 2. Configure GitHub Pages
**Manual configuration needed** (one-time setup):

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages`
4. Folder: `/docs`
5. Save

**Current setup:** Serving from `main` branch `/docs` folder
**New setup:** Serving from `gh-pages` branch `/docs` folder

### 3. Optional: Clean Up Existing Index (One-Time)
**File:** `docs/charts/index.yaml` on `main` branch

**Option A:** Keep it (harmless, just outdated)
**Option B:** Delete it from `main` since it will live on `gh-pages`

**Recommendation:** Keep it for now, delete later if desired.

### 4. Update Documentation (Optional)
**File:** `deployment-examples/helm/README.md`

Update Helm repository URL (currently shows placeholder):
```markdown
helm repo add catalogi https://codegouvfr.github.io/catalogi/charts
```

This URL works with both approaches (main or gh-pages), so no change needed if already correct.

## Critical Files to Modify

1. **.github/workflows/ci.yaml** - Modify `publish_helm_index` job (lines 105-145)
2. **GitHub repository settings** - Configure Pages to use `gh-pages` branch (manual, one-time)

## Workflow After Implementation

### Release Process:
1. Developer bumps version in `package.json`
2. **Pre-commit hooks run:**
   - Sync Chart.yaml appVersion
   - Bump Chart.yaml version
   - Format code
3. Developer commits and pushes to `main`
4. **CI runs:**
   - Validations pass
   - Version upgrade detected
   - Tag created (e.g., v1.53.5)
   - GitHub release created with chart
   - **`publish_helm_index` job:**
     - Checks out repo
     - Creates/updates `gh-pages` branch
     - Resets `gh-pages` to match `main` exactly (`git reset --hard origin/main`)
     - Downloads chart from release
     - Generates index.yaml
     - Commits to `gh-pages` ✅
     - Force pushes `gh-pages`
   - Docker images built
5. **Result:** `main` has NO extra commit

### Branch Structure:
```
main:      A - B - C - D (version bump)

gh-pages:  A - B - C - D (reset from main)
                        \
                         E (index update) ← only extra commit
```

Next release:
```
main:      A - B - C - D - F - G (next version bump)

gh-pages:  A - B - C - D - F - G (reset to main, previous index commit discarded)
                                \
                                 H (new index update) ← one commit ahead again
```

**Note:** Each release discards the previous index commit and creates a new one. This keeps `gh-pages` always exactly one commit ahead of `main`.

## Edge Cases & Considerations

### Case 1: First Time Setup
**Scenario:** `gh-pages` branch doesn't exist yet.

**Behavior:** Script creates it from `main`, adds index commit.

**Result:** Smooth first-time setup.

### Case 2: No Conflicts Possible
**Scenario:** Using `reset --hard` instead of rebase.

**Behavior:** `gh-pages` is forcefully reset to match `main` exactly, then index commit added.

**Result:** No conflicts ever possible, simpler and more reliable than rebase.

### Case 3: Multiple Releases in Quick Succession
**Scenario:** Two releases triggered before first one finishes.

**Behavior:** Second job will rebase on latest main and update index.

**Result:** Last release wins, index stays consistent.

### Case 4: Manual Edits to gh-pages
**Scenario:** Someone manually edits `gh-pages`.

**Behavior:** Next rebase will potentially lose those changes.

**Mitigation:** Document that `gh-pages` is auto-managed, don't edit manually.

### Case 5: Docs Updates
**Scenario:** Documentation in `docs/` folder is updated on `main`.

**Behavior:** `gh-pages` rebase picks up those changes automatically.

**Result:** Documentation stays in sync across branches.

## Testing Plan

### 1. Branch Setup Testing
- Verify `gh-pages` branch is created correctly
- Verify it resets cleanly to match `main`
- Verify index.yaml is committed only to `gh-pages`
- Verify `gh-pages` is exactly one commit ahead of `main`

### 2. GitHub Pages Testing
- Configure Pages to use `gh-pages` branch
- Verify docs site still loads correctly
- Verify Helm index accessible at: `https://codegouvfr.github.io/catalogi/charts/index.yaml`

### 3. Helm Repository Testing
- Update repo: `helm repo add catalogi https://codegouvfr.github.io/catalogi/charts`
- Search: `helm search repo catalogi`
- Verify versions appear correctly

### 4. Release Cycle Testing
- Trigger a test release
- Verify `publish_helm_index` job runs successfully
- Verify `main` has NO new commit ✅
- Verify `gh-pages` has the index commit
- Verify `gh-pages` is one commit ahead of `main`

### 5. Multiple Release Testing
- Trigger second release
- Verify `gh-pages` resets correctly to new `main`
- Verify still only one commit ahead (old index commit discarded)
- Verify old version still in index (merged via --merge flag in helm repo index)

### 6. Documentation Updates
- Update docs on `main`
- Trigger release
- Verify docs appear on GitHub Pages with updates

## Benefits

✅ **Main branch stays clean** - No index commits
✅ **Minimal changes** - Only modify CI workflow
✅ **No developer requirements** - No local Helm needed
✅ **Standard pattern** - Common GitHub Pages approach
✅ **Easy rollback** - Just delete gh-pages and recreate
✅ **Clear separation** - Source code vs. published artifacts

## Trade-offs

⚠️ **One-time manual config** - Need to update GitHub Pages settings
⚠️ **Separate branch** - Adds gh-pages branch to repo (but it's standard)
⚠️ **Force push** - Using `--force` on gh-pages (safe since it's auto-managed, never edited manually)

## Summary

**Goal:** Eliminate post-release commit on main branch.

**Solution:** Use separate `gh-pages` branch for Helm index, rebased on main each release.

**Changes Required:**
1. Modify `publish_helm_index` job in CI to push to `gh-pages` instead of `main`
2. Configure GitHub Pages to serve from `gh-pages` branch (one-time manual step)

**Result:**
- ✅ Main branch history stays pristine
- ✅ gh-pages has index (one commit ahead of main)
- ✅ Fewer changes than pre-commit hook approach
- ✅ No new developer requirements

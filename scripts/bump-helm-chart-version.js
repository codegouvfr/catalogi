// SPDX-FileCopyrightText: 2021-2025 DINUM <floss@numerique.gouv.fr>
// SPDX-FileCopyrightText: 2024-2025 Université Grenoble Alpes
// SPDX-License-Identifier: MIT

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");

const chartYamlPath = path.join(
  rootDir,
  "helm-charts",
  "catalogi",
  "Chart.yaml"
);

try {
  const chartYamlContent = fs.readFileSync(chartYamlPath, "utf8");
  const chartYaml = yaml.load(chartYamlContent);
  const currentVersion = chartYaml.version;

  // --- This is the new, dependency-free logic ---
  const parts = currentVersion.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `Chart version "${currentVersion}" is not a valid x.y.z format.`
    );
  }

  const patch = parseInt(parts[2], 10);
  if (isNaN(patch)) {
    throw new Error(`Patch version "${parts[2]}" is not a valid number.`);
  }

  parts[2] = patch + 1;
  const newVersion = parts.join(".");
  // --- End of new logic ---

  console.log(
    `Bumping Helm chart version from ${currentVersion} to ${newVersion}...`
  );
  chartYaml.version = newVersion;
  const newChartYamlContent = yaml.dump(chartYaml);
  fs.writeFileSync(chartYamlPath, newChartYamlContent, "utf8");
  console.log("✅ Helm chart version bumped.");
  
  // Stage the changes to Chart.yaml
  try {
    execSync(`git add ${chartYamlPath}`, { stdio: 'inherit' });
    console.log("✅ Chart.yaml changes staged.");
  } catch (error) {
    console.warn("⚠️  Could not stage Chart.yaml changes:", error.message);
  }
} catch (error) {
  console.error("❌ Error bumping Helm chart version:", error.message);
  process.exit(1);
}

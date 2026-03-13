#!/usr/bin/env node

/**
 * Shai-Hulud 2.0 IOC Scanner
 * Scans package.json and pnpm-lock.yaml against DataDog's consolidated IOC list
 */

const fs = require("fs");
const path = require("path");

const IOC_FILE = "iocs.csv";
const PACKAGE_JSON_PATHS = ["package.json", "api/package.json", "web/package.json"];
const PNPM_LOCK_PATH = "pnpm-lock.yaml";

/**
 * Parse IOC CSV file
 * Expected format: package_name,version,description
 */
function parseIOCs(csvPath) {
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n");
    const iocs = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV (simple approach - may need adjustment based on actual format)
        const parts = line.split(",");
        if (parts.length >= 2) {
            iocs.push({
                package: parts[0].trim(),
                version: parts[1].trim(),
                description: parts.slice(2).join(",").trim()
            });
        }
    }

    return iocs;
}

/**
 * Extract dependencies from package.json
 */
function extractDependencies(packageJsonPath) {
    if (!fs.existsSync(packageJsonPath)) {
        return [];
    }

    const content = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const deps = [];

    ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].forEach(depType => {
        if (content[depType]) {
            Object.entries(content[depType]).forEach(([name, version]) => {
                deps.push({ name, version, source: packageJsonPath });
            });
        }
    });

    return deps;
}

/**
 * Parse pnpm-lock.yaml to get resolved versions
 * Extracts package@version pairs from the packages: section
 * Format: '  @scope/name@1.2.3:' or '  name@1.2.3:'
 */
function parsePnpmLock(lockPath) {
    if (!fs.existsSync(lockPath)) {
        console.error(`ERROR: ${lockPath} not found`);
        process.exit(1);
    }

    const content = fs.readFileSync(lockPath, "utf-8");
    const lines = content.split("\n");
    const packages = [];

    let inPackagesSection = false;

    for (const line of lines) {
        if (line === "packages:") {
            inPackagesSection = true;
            continue;
        }

        if (inPackagesSection && line.length > 0 && !line.startsWith(" ")) {
            break;
        }

        if (!inPackagesSection) continue;

        const match = line.match(/^\s{2}'?(@?[^@']+)@([^':]+)'?:/);
        if (match) {
            packages.push({
                name: match[1],
                version: match[2]
            });
        }
    }

    return packages;
}

/**
 * Check if package matches IOC
 */
function matchesIOC(pkg, ioc) {
    // Exact package name match
    if (pkg.name !== ioc.package) {
        return false;
    }

    // Check version
    // If IOC version is "*" or empty, match any version
    if (!ioc.version || ioc.version === "*") {
        return true;
    }

    // Exact version match
    return pkg.version === ioc.version;
}

/**
 * Main scanner function
 */
function scanDependencies() {
    console.log("🔍 Shai-Hulud 2.0 IOC Scanner");
    console.log("================================\n");

    // Load IOCs
    if (!fs.existsSync(IOC_FILE)) {
        console.error(`ERROR: IOC file ${IOC_FILE} not found`);
        console.error("Run: curl -o iocs.csv https://raw.githubusercontent.com/DataDog/indicators-of-compromise/refs/heads/main/shai-hulud-2.0/consolidated_iocs.csv");
        process.exit(1);
    }

    const iocs = parseIOCs(IOC_FILE);
    console.log(`✓ Loaded ${iocs.length} IOCs from ${IOC_FILE}\n`);

    // Extract dependencies from package.json files
    const declaredDeps = [];
    for (const pkgPath of PACKAGE_JSON_PATHS) {
        const deps = extractDependencies(pkgPath);
        declaredDeps.push(...deps);
        if (fs.existsSync(pkgPath)) {
            console.log(`✓ Scanned ${pkgPath}: ${deps.length} dependencies`);
        }
    }

    // Parse pnpm-lock.yaml for resolved versions
    const resolvedDeps = parsePnpmLock(PNPM_LOCK_PATH);
    console.log(`✓ Scanned ${PNPM_LOCK_PATH}: ${resolvedDeps.length} resolved packages\n`);

    // Check for matches
    const matches = [];

    // Check resolved dependencies (from yarn.lock)
    for (const pkg of resolvedDeps) {
        for (const ioc of iocs) {
            if (matchesIOC(pkg, ioc)) {
                matches.push({
                    package: pkg.name,
                    version: pkg.version,
                    source: "pnpm-lock.yaml",
                    ioc: ioc
                });
            }
        }
    }

    // Report results
    console.log("================================");
    if (matches.length === 0) {
        console.log("✅ No malicious packages detected");
        console.log("✅ All dependencies are clean\n");
        process.exit(0);
    } else {
        console.error(`❌ SECURITY ALERT: ${matches.length} malicious package(s) detected!\n`);

        matches.forEach((match, i) => {
            console.error(`[${i + 1}] ${match.package}@${match.version}`);
            console.error(`    Source: ${match.source}`);
            console.error(`    IOC: ${match.ioc.description || "Malicious package"}`);
            console.error("");
        });

        console.error("🚨 DO NOT PROCEED WITH INSTALLATION");
        console.error("🚨 Remove these packages immediately\n");
        process.exit(1);
    }
}

// Run scanner
scanDependencies();

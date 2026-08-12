#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const VALID_LANGUAGES = ["java", "rust", "go", "cpp", "csharp"];
const VALID_TYPES = ["reimplementation", "fork"];
const VALID_STATUSES = ["active", "wip", "abandoned"];

const rootDir = path.join(__dirname, "..");
const filePath = path.join(rootDir, "servers.json");
const serversDir = path.join(rootDir, "servers");
const templatePath = path.join(serversDir, "template.yaml");

let raw;
try {
  raw = fs.readFileSync(filePath, "utf8");
} catch (e) {
  console.error("Could not read servers.json:", e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("servers.json is not valid JSON:", e.message);
  process.exit(1);
}

if (!Array.isArray(data.servers)) {
  console.error('servers.json must have a top-level "servers" array.');
  process.exit(1);
}

function parseFeaturesYAML(text) {
  const features = { complete: [], inDev: [], incomplete: [] };
  let currentKey = null;

  text.split("\n").forEach(line => {
    if (!line.trim()) return;

    const keyMatch = line.match(/^- (\w+):\s*$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      return;
    }

    const itemMatch = line.match(/^\s+- (\S+)\s*$/);
    if (itemMatch && currentKey && features[currentKey]) {
      features[currentKey].push(itemMatch[1]);
    }
  });

  return features;
}

function allFeatureIds(features) {
  return [...features.complete, ...features.inDev, ...features.incomplete];
}

let templateFeatureIds;
try {
  templateFeatureIds = new Set(allFeatureIds(parseFeaturesYAML(fs.readFileSync(templatePath, "utf8"))));
} catch (e) {
  console.error("Could not read servers/template.yaml:", e.message);
  process.exit(1);
}

const errors = [];
const seenNames = new Set();
const seenIds = new Set();

data.servers.forEach((s, i) => {
  const id = `servers[${i}] (${s.name ?? "unnamed"})`;

  const requiredStrings = ["id", "name", "url", "sourceLabel", "mcVersion", "description"];
  for (const field of requiredStrings) {
    if (typeof s[field] !== "string" || s[field].trim() === "") {
      errors.push(`${id}: "${field}" must be a non-empty string.`);
    }
  }

  if (typeof s.id === "string" && s.id.trim() !== "") {
    if (seenIds.has(s.id)) {
      errors.push(`${id}: duplicate id "${s.id}".`);
    }
    seenIds.add(s.id);

    if (s.type !== "fork") {
      const yamlPath = path.join(serversDir, `${s.id}.yaml`);
      if (!fs.existsSync(yamlPath)) {
        errors.push(`${id}: missing features file "servers/${s.id}.yaml".`);
      } else {
        let yamlRaw = null;
        try {
          yamlRaw = fs.readFileSync(yamlPath, "utf8");
        } catch (e) {
          errors.push(`${id}: could not read "servers/${s.id}.yaml": ${e.message}`);
        }

        if (yamlRaw !== null) {
          const ids = allFeatureIds(parseFeaturesYAML(yamlRaw));
          const idSet = new Set(ids);

          const seenInFile = new Set();
          for (const fid of ids) {
            if (seenInFile.has(fid)) {
              errors.push(`${id}: feature "${fid}" is listed more than once in "servers/${s.id}.yaml".`);
            }
            seenInFile.add(fid);
          }

          const missing = [...templateFeatureIds].filter(fid => !idSet.has(fid));
          if (missing.length > 0) {
            errors.push(`${id}: "servers/${s.id}.yaml" is missing feature(s) from template.yaml: ${missing.join(", ")}.`);
          }

          const unknown = [...new Set(ids)].filter(fid => !templateFeatureIds.has(fid));
          if (unknown.length > 0) {
            errors.push(`${id}: "servers/${s.id}.yaml" has feature(s) not present in template.yaml: ${unknown.join(", ")}.`);
          }
        }
      }
    }
  }

  if (!VALID_LANGUAGES.includes(s.language)) {
    errors.push(`${id}: "language" must be one of [${VALID_LANGUAGES.join(", ")}], got "${s.language}".`);
  }

  if (!VALID_TYPES.includes(s.type)) {
    errors.push(`${id}: "type" must be one of [${VALID_TYPES.join(", ")}], got "${s.type}".`);
  }

  if (!VALID_STATUSES.includes(s.status)) {
    errors.push(`${id}: "status" must be one of [${VALID_STATUSES.join(", ")}], got "${s.status}".`);
  }

  if (s.forkNote !== null && typeof s.forkNote !== "string") {
    errors.push(`${id}: "forkNote" must be a string or null.`);
  }

  try {
    new URL(s.url);
  } catch {
    errors.push(`${id}: "url" is not a valid URL: "${s.url}".`);
  }

  if (s.name && seenNames.has(s.name)) {
    errors.push(`${id}: duplicate name "${s.name}".`);
  }
  if (s.name) seenNames.add(s.name);
});

if (errors.length > 0) {
  console.error(`servers.json validation failed with ${errors.length} error(s):\n`);
  errors.forEach(e => console.error("  -", e));
  process.exit(1);
}

console.log(`servers.json is valid. ${data.servers.length} server(s) listed.`);

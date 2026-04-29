#!/usr/bin/env node
/**
 * Centralized version bumper for NanChat.
 *
 * Source of truth: ./version.json  ->  { "version": "x.y.z", "build": N }
 *
 * Updates:
 *   - version.json
 *   - package.json                                 (version)
 *   - src-tauri/tauri.conf.json                    (version)
 *   - android/app/build.gradle                     (versionName, versionCode)
 *   - ios/App/App.xcodeproj/project.pbxproj        (MARKETING_VERSION, CURRENT_PROJECT_VERSION)
 *
 * Usage:
 *   node scripts/bump-version.mjs                  # bumps patch + build
 *   node scripts/bump-version.mjs patch|minor|major
 *   node scripts/bump-version.mjs 1.2.3            # explicit version, build += 1
 *   node scripts/bump-version.mjs 1.2.3 99         # explicit version + build
 *   node scripts/bump-version.mjs --sync           # re-apply current version.json everywhere
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => resolve(root, ...s);

const FILES = {
  version: p('version.json'),
  pkg: p('package.json'),
  tauri: p('src-tauri/tauri.conf.json'),
  gradle: p('android/app/build.gradle'),
  pbxproj: p('ios/App/App.xcodeproj/project.pbxproj'),
};

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [+m[1], +m[2], +m[3]];
}

function bump(version, kind) {
  const [maj, min, pat] = parseSemver(version);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function resolveTarget(current, args) {
  if (args.includes('--sync')) return { version: current.version, build: current.build };

  const [first, second] = args;
  if (!first || ['patch', 'minor', 'major'].includes(first)) {
    return {
      version: bump(current.version, first || 'patch'),
      build: current.build + 1,
    };
  }
  parseSemver(first);
  return {
    version: first,
    build: second ? Number(second) : current.build + 1,
  };
}

function updateFile(file, transform) {
  if (!existsSync(file)) {
    console.warn(`! skip (missing): ${file}`);
    return;
  }
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (before === after) {
    console.warn(`! no change in ${file}`);
    return;
  }
  writeFileSync(file, after);
  console.log(`✓ ${file}`);
}

function main() {
  const current = readJson(FILES.version);
  const { version, build } = resolveTarget(current, process.argv.slice(2));

  console.log(`Bumping to version=${version} build=${build}\n`);

  // version.json
  writeJson(FILES.version, { version, build });
  console.log(`✓ ${FILES.version}`);

  // package.json
  const pkg = readJson(FILES.pkg);
  pkg.version = version;
  writeJson(FILES.pkg, pkg);
  console.log(`✓ ${FILES.pkg}`);

  // tauri.conf.json
  const tauri = readJson(FILES.tauri);
  tauri.version = version;
  writeJson(FILES.tauri, tauri);
  console.log(`✓ ${FILES.tauri}`);

  // android/app/build.gradle
  updateFile(FILES.gradle, (s) =>
    s
      .replace(/versionCode\s+\d+/, `versionCode ${build}`)
      .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`)
  );

  // ios pbxproj (multiple occurrences for each build config)
  updateFile(FILES.pbxproj, (s) =>
    s
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
  );

  console.log(`\nDone.`);
}

main();

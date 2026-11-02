// Patches native plugin sources in node_modules (runs on postinstall).
//
// @capacitor-mlkit/translation (Android) only downloads language models over
// Wi-Fi: on mobile data the download never starts and translation silently
// fails. iOS already allows cellular, do the same on Android.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const patches = [
  {
    file: 'node_modules/@capacitor-mlkit/translation/android/src/main/java/io/capawesome/capacitorjs/plugins/mlkit/translation/Translation.java',
    from: 'new DownloadConditions.Builder().requireWifi().build()',
    to: 'new DownloadConditions.Builder().build()',
  },
];

for (const { file, from, to } of patches) {
  const path = join(root, file);
  if (!existsSync(path)) {
    console.warn(`[patch-native-plugins] skipped, not found: ${file}`);
    continue;
  }
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) {
    if (!source.includes(to)) console.warn(`[patch-native-plugins] pattern not found, check ${file}`);
    continue;
  }
  writeFileSync(path, source.split(from).join(to));
  console.log(`[patch-native-plugins] patched ${file}`);
}

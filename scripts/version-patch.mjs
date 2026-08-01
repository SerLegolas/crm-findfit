import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionPath = resolve(__dirname, "../public/version.json");

const data = JSON.parse(readFileSync(versionPath, "utf-8"));
let [major, minor, patch] = data.version.split(".").map(Number);

patch += 1;

if (patch >= 100) {
  patch = 0;
  minor += 1;
}

if (minor >= 100) {
  minor = 0;
  major += 1;
}

data.version = `${major}.${minor}.${patch}`;
writeFileSync(versionPath, JSON.stringify(data, null, 2) + "\n");

console.log(`✅ Versione aggiornata: ${data.version}`);

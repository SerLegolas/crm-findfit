// Script locale (non committare): imposta SUPER_JWT_SECRET e SUPER_PASSWORD
// su Vercel (production) scrivendo il valore direttamente sullo stdin di
// vercel CLI, senza newline finale (evita il warning "Value contains newlines"
// e il fallimento del login con password "sporca").
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

function addEnv(name, value) {
  const res = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--yes"],
    { input: value, encoding: "utf8", shell: process.platform === "win32" }
  );
  if (res.status !== 0) {
    console.error(`[ERR] ${name}: ${res.stderr || res.stdout}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`[OK] ${name}`);
  return true;
}

const jwt = randomBytes(32).toString("hex");
const pass = randomBytes(18).toString("base64url");

if (addEnv("SUPER_JWT_SECRET", jwt) && addEnv("SUPER_PASSWORD", pass)) {
  // Stampa i valori per copiarli in .env.local
  console.log("SUPER_JWT_SECRET=" + jwt);
  console.log("SUPER_PASSWORD=" + pass);
}

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY non configurata nelle variabili d'ambiente"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Cripta un testo in chiaro usando AES-256-GCM.
 * Restituisce una stringa nel formato `iv:authTag:ciphertext` (tutto in hex).
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decripta una stringa prodotta da `encrypt()`.
 * Se la stringa è vuota o non nel formato atteso, la ritorna così com'è.
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  const parts = encryptedData.split(":");
  if (parts.length !== 3) return encryptedData;
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function loadBackupKey(value = process.env.AIHR_BACKUP_KEY) {
  if (!value) throw new Error("AIHR_BACKUP_KEY is required (32 random bytes encoded as base64url). ");
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error("AIHR_BACKUP_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptBackup(data, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return {
    format: "aihr-encrypted-backup",
    version: 1,
    algorithm: "aes-256-gcm",
    createdAt: new Date().toISOString(),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

export function decryptBackup(envelope, key) {
  if (envelope?.format !== "aihr-encrypted-backup" || envelope?.version !== 1) {
    throw new Error("Unsupported AI HR backup format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

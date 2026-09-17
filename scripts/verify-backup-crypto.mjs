import { randomBytes } from "node:crypto";
import { decryptBackup, encryptBackup } from "./backup-crypto.mjs";

const key = randomBytes(32);
const source = { organizationId: "verification", data: { records: [{ id: "1" }], audit: [] } };
const envelope = encryptBackup(source, key);
const restored = decryptBackup(envelope, key);
if (JSON.stringify(restored) !== JSON.stringify(source)) throw new Error("Encrypted backup round trip failed.");
let tamperBlocked = false;
try {
  const index = Math.floor(envelope.ciphertext.length / 2);
  const replacement = envelope.ciphertext[index] === "A" ? "B" : "A";
  const ciphertext = `${envelope.ciphertext.slice(0, index)}${replacement}${envelope.ciphertext.slice(index + 1)}`;
  decryptBackup({ ...envelope, ciphertext }, key);
} catch {
  tamperBlocked = true;
}
if (!tamperBlocked) throw new Error("Tampered encrypted backup was accepted.");
console.log("Encrypted backup round trip and tamper detection passed.");

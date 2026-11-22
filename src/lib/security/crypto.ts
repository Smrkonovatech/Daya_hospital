/**
 * ============================================================================
 * SMRKOMED SECURE CREDENTIAL ENCRYPTION & MASKING ENGINE
 * ============================================================================
 *
 * Implements AES-256-GCM encryption at rest for sensitive provider credentials
 * (Exotel API keys, tokens, webhook secrets, and Sarvam API keys).
 *
 * Security Invariants:
 * - Encryption key derived from master AUTH_SECRET / SMRKO_ENCRYPTION_KEY.
 * - Random 12-byte IV per encryption to prevent ciphertext pattern analysis.
 * - Authenticated ciphertext with GCM 16-byte auth tag.
 * - Zero raw secrets in browser payloads or application logs.
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
export const AUTH_TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const secret =
    process.env.SMRKO_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "smrkomed-hospital-master-encryption-key-2026-v2-secure";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext secret into an authenticated AES-256-GCM format:
 * `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || plainText.startsWith("enc:v1:")) {
    return plainText; // Already encrypted or empty
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an authenticated AES-256-GCM string back to plaintext.
 * Safely falls back to plaintext if the string was not encrypted.
 */
export function decryptSecret(encryptedString?: string | null): string {
  if (!encryptedString) return "";
  if (!encryptedString.startsWith("enc:v1:")) {
    return encryptedString; // Legacy or unencrypted fallback
  }

  try {
    const parts = encryptedString.split(":");
    if (parts.length !== 5) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(parts[2], "hex");
    const authTag = Buffer.from(parts[3], "hex");
    const cipherText = parts[4];

    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("[Security] Decryption failed for credential:", err instanceof Error ? err.message : err);
    return "";
  }
}

/**
 * Masks credentials for display in administrative UI and API payloads.
 * Exposes only prefix and suffix if sufficiently long, otherwise a fixed mask.
 */
export function maskCredential(secret?: string | null, fullRedact = false): string {
  if (!secret) return "[NOT_CONFIGURED]";
  
  // If encrypted, decrypt temporarily to compute mask representation
  const plain = secret.startsWith("enc:v1:") ? decryptSecret(secret) : secret;
  if (!plain) return "[NOT_CONFIGURED]";

  if (fullRedact) return "[CONFIGURED]";
  if (plain.length <= 8) return "••••••••";
  return `${plain.slice(0, 4)}••••••••${plain.slice(-4)}`;
}

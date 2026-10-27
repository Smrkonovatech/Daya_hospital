import { AuthSession } from "@/types";

const AUTH_COOKIE_NAME = "daya_auth_session";
const SESSION_DURATION_HOURS = 8;
const SECRET_KEY =
  process.env.AUTH_SECRET || "daya-hospital-ai-calling-hmac-sha256-secret-key-2026";

// In-memory token revocation list
const revokedTokens = new Set<string>();

/**
 * Binary-safe Base64URL encode/decode helpers compatible with Edge & Node
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

function base64UrlToString(base64Url: string): string {
  return new TextDecoder().decode(base64UrlToBytes(base64Url));
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Create a cryptographically signed HMAC-SHA256 session token
 */
export async function createSessionToken(
  sessionData: Omit<AuthSession, "expiresAt">,
  durationHours = SESSION_DURATION_HOURS
): Promise<string> {
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;
  const session: AuthSession = { ...sessionData, expiresAt };

  const payloadStr = JSON.stringify(session);
  const encodedPayload = stringToBase64Url(payloadStr);

  const key = await getHmacKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(encodedPayload)
  );

  const encodedSignature = bytesToBase64Url(new Uint8Array(signatureBuffer));

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a signed session token, checking HMAC signature and expiration
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<AuthSession | null> {
  if (!token || typeof token !== "string") return null;

  if (revokedTokens.has(token)) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSignature] = parts;

  try {
    const key = await getHmacKey();
    const enc = new TextEncoder();

    // Reconstruct binary signature bytes directly
    const signatureBytes = base64UrlToBytes(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      enc.encode(encodedPayload)
    );

    if (!isValid) return null;

    const payloadJson = base64UrlToString(encodedPayload);
    const session: AuthSession = JSON.parse(payloadJson);

    // Check expiration
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch (err) {
    console.error("Token verification error:", err);
    return null;
  }
}

/**
 * Revoke an active session token (instant logout/invalidation)
 */
export function revokeSessionToken(token: string): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export { AUTH_COOKIE_NAME, SESSION_DURATION_HOURS };

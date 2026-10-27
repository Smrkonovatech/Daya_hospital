import { AuthSession } from "@/types";

const AUTH_COOKIE_NAME = "daya_auth_session";
const SESSION_DURATION_HOURS = 8;
const SECRET_KEY =
  process.env.AUTH_SECRET || "daya-hospital-ai-calling-hmac-sha256-secret-key-2026";

// In-memory token revocation list
const revokedTokens = new Set<string>();

/**
 * Base64URL encode/decode helpers compatible with Edge & Node
 */
function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf-8");
  }
  return atob(base64);
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
  const encodedPayload = base64UrlEncode(payloadStr);

  const key = await getHmacKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(encodedPayload)
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureBinary = String.fromCharCode(...signatureArray);
  const encodedSignature = base64UrlEncode(signatureBinary);

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

    // Reconstruct binary signature
    const signatureBinary = base64UrlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(
      Array.from(signatureBinary).map((char) => char.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      enc.encode(encodedPayload)
    );

    if (!isValid) return null;

    const payloadJson = base64UrlDecode(encodedPayload);
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

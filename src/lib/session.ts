// Session token helpers. Must work in BOTH the Edge runtime (middleware)
// and the Node.js runtime (route handlers), so only Web Crypto + Web APIs
// (crypto.subtle, atob/btoa, TextEncoder) are used here — no `node:crypto`
// and no `Buffer`.

const AUTH_SECRET =
  process.env.AUTH_SECRET || "jaipur-admin-panel-default-secret-please-change";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(input: string): string {
  const base64 = btoa(input);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

async function hmacHex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(signature);
}

export async function createSessionToken(adminId: number): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${adminId}:${expiresAt}`;
  const signature = await hmacHex(payload);
  return `${base64UrlEncode(payload)}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<{ adminId: number } | null> {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  let payload: string;
  try {
    payload = base64UrlDecode(encodedPayload);
  } catch {
    return null;
  }

  const expectedSignature = await hmacHex(payload);
  if (expectedSignature !== signature) return null;

  const [idPart, expiresPart] = payload.split(":");
  const adminId = Number(idPart);
  const expiresAt = Number(expiresPart);
  if (!Number.isFinite(adminId) || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  return { adminId };
}

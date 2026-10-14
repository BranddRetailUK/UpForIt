import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function keyFromEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return createHash("sha256").update(value).digest();
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnvironment("EMAIL_JOB_ENCRYPTION_KEY"), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptJson<T>(value: string): T {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromEnvironment("EMAIL_JOB_ENCRYPTION_KEY"),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8")
  ) as T;
}

// Existing v1 codes remain valid through a bounded verification-key overlap.
function qrKeys() {
  // Signing uses the exact configured value. Preserve it during verification,
  // while retaining trimmed keys for previously issued codes and key rotation.
  const keys = [process.env.TICKET_QR_SIGNING_SECRET, ...(process.env.TICKET_QR_PREVIOUS_SIGNING_SECRETS || "").split(",")]
    .filter((key): key is string => Boolean(key?.trim()));
  return [...new Set(keys.flatMap(key => [key, key.trim()]))];
}
export function createTicketQrToken(publicId: string) {
  const secret = process.env.TICKET_QR_SIGNING_SECRET;
  if (!secret) throw new Error("TICKET_QR_SIGNING_SECRET is not set");
  const signature = createHmac("sha256", secret).update(`v1.${publicId}`).digest("base64url");
  return `v1.${publicId}.${signature}`;
}
export function verifyTicketQrToken(token: string) {
  const match = /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i.exec(token.trim());
  if (!match) return null;
  const [, publicId, signature] = match;
  const actual = Buffer.from(signature, "base64url");
  if (actual.toString("base64url") !== signature) return null;
  return qrKeys().some(secret => {
    const expected = createHmac("sha256",secret).update(`v1.${publicId}`).digest();
    return actual.length === expected.length && timingSafeEqual(actual,expected);
  }) ? publicId : null;
}

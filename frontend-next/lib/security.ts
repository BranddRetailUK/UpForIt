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

export function createTicketQrToken(publicId: string) {
  const secret = process.env.TICKET_QR_SIGNING_SECRET;
  if (!secret) throw new Error("TICKET_QR_SIGNING_SECRET is not set");
  const signature = createHmac("sha256", secret).update(`v1.${publicId}`).digest("base64url");
  return `v1.${publicId}.${signature}`;
}

export function verifyTicketQrToken(token: string) {
  const [version, publicId, signature] = token.trim().split(".");
  const secret = process.env.TICKET_QR_SIGNING_SECRET;
  if (version !== "v1" || !publicId || !signature || !secret) return null;
  const expected = createHmac("sha256", secret).update(`v1.${publicId}`).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? publicId : null;
}


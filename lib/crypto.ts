import crypto from "crypto";

// v1: server-side encryption of secret values with AES-256-GCM.
// The key comes from MASTER_ENCRYPTION_KEY (64 hex chars = 32 bytes).
//
// NOTE: This is intentionally a localized module. The PRD's zero-knowledge/E2E
// design will replace this scheme with client-side encryption + per-user key
// wrapping without changing the shape stored on Secret (ciphertext/iv/authTag).

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.MASTER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY must be set to 64 hex characters (32 bytes). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedValue {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encrypt(plaintext: string): EncryptedValue {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decrypt(value: EncryptedValue): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(value.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

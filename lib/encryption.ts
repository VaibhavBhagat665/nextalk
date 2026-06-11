const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret).slice(0, 32),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("nextalk-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string): Promise<string> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) return plaintext; // Skip encryption if no secret

  const key = await getKey(secret);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString("base64");
}

export async function decrypt(ciphertext: string): Promise<string> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) return ciphertext; // Skip decryption if no secret

  try {
    const key = await getKey(secret);
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.slice(0, IV_LENGTH);
    const encrypted = data.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, return the original text (might be unencrypted)
    return ciphertext;
  }
}

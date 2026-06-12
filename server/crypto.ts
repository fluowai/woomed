import crypto from "crypto";

/**
 * Módulo de criptografia para secrets sensíveis (payment gateway keys, API tokens, etc)
 * Usa AES-256-GCM com derivação de chave PBKDF2
 */

const MASTER_KEY = (() => {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error(
      "ERRO CRÍTICO: ENCRYPTION_MASTER_KEY não configurado em produção. " +
      "Gere com: ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)"
    );
  }
  // Se não configurado em dev, gera uma chave temporária
  return key ? Buffer.from(key, "hex") : crypto.randomBytes(32);
})();

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const TAG_POSITION = IV_LENGTH + SALT_LENGTH;
const ENCRYPTED_DATA_POSITION = TAG_POSITION + AUTH_TAG_LENGTH;

/**
 * Criptografa um string sensível
 * Retorna: base64(salt + iv + authTag + encryptedData)
 */
export function encryptSecret(secret: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derivar chave com salt
    const key = crypto.pbkdf2Sync(MASTER_KEY, salt, 100000, 32, "sha256");

    // Criptografar
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(secret, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combinar: salt + iv + authTag + encryptedData
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString("base64");
  } catch (error) {
    console.error("[CRYPTO] Erro ao criptografar secret:", error);
    throw new Error("Falha ao criptografar dados sensíveis");
  }
}

/**
 * Descriptografa um string criptografado
 */
export function decryptSecret(encryptedSecret: string): string {
  try {
    const buffer = Buffer.from(encryptedSecret, "base64");

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
    const authTag = buffer.subarray(TAG_POSITION, ENCRYPTED_DATA_POSITION);
    const encrypted = buffer.subarray(ENCRYPTED_DATA_POSITION);

    // Derivar chave com salt
    const key = crypto.pbkdf2Sync(MASTER_KEY, salt, 100000, 32, "sha256");

    // Descriptografar
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[CRYPTO] Erro ao descriptografar secret:", error);
    throw new Error("Falha ao descriptografar dados - pode estar corrompido ou usando chave errada");
  }
}

/**
 * Testa se um string está criptografado (começa com "enc_")
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith("enc_");
}

/**
 * Wrapper que criptografa apenas se não estiver já criptografado
 */
export function ensureEncrypted(value: string): string {
  if (!value) return value;
  if (isEncrypted(value)) return value;
  return "enc_" + encryptSecret(value);
}

/**
 * Wrapper que descriptografa apenas se estiver criptografado
 */
export function ensureDecrypted(value: string): string {
  if (!value || !isEncrypted(value)) return value;
  return decryptSecret(value.substring(4)); // Remove "enc_" prefix
}

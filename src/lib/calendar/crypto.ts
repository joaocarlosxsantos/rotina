import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

/**
 * Obtém a chave AES-256 (32 bytes) a partir da variável de ambiente CALENDAR_TOKEN_KEY (base64).
 * Se keyOverride for fornecido, utiliza a chave especificada.
 */
export function getCalendarTokenKey(keyOverride?: string | Buffer): Buffer | null {
  if (Buffer.isBuffer(keyOverride)) {
    if (keyOverride.length === 32) return keyOverride;
    return null;
  }

  const raw = keyOverride ?? process.env.CALENDAR_TOKEN_KEY;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const buf = Buffer.from(raw.trim(), "base64");
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    // Chave malformada
  }

  return null;
}

export function isCalendarCryptoConfigured(keyOverride?: string | Buffer): boolean {
  return getCalendarTokenKey(keyOverride) !== null;
}

/**
 * Encripta um texto claro usando AES-256-GCM.
 * Formato retornado: v1:iv:tag:cipher (iv, tag e cipher em hexadecimal).
 */
export function encryptToken(plainText: string, keyOverride?: string | Buffer): string {
  if (typeof plainText !== "string") {
    throw new CryptoError("Texto a encriptar deve ser uma string.");
  }

  const key = getCalendarTokenKey(keyOverride);
  if (!key) {
    throw new CryptoError("Chave CALENDAR_TOKEN_KEY não configurada ou inválida (requer base64 de 32 bytes).");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${cipherText.toString("hex")}`;
}

/**
 * Decripta um payload versionado no formato v1:iv:tag:cipher usando AES-256-GCM.
 */
export function decryptToken(payload: string, keyOverride?: string | Buffer): string {
  if (typeof payload !== "string" || !payload.startsWith("v1:")) {
    throw new CryptoError("Formato de payload encriptado inválido ou versão incompatível.");
  }

  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new CryptoError("Formato de payload encriptado corrompido.");
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  if (!ivHex || !tagHex || !cipherHex) {
    throw new CryptoError("Partes criptográficas incompletas no payload.");
  }

  const key = getCalendarTokenKey(keyOverride);
  if (!key) {
    throw new CryptoError("Chave CALENDAR_TOKEN_KEY não configurada ou inválida.");
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const cipherText = Buffer.from(cipherHex, "hex");

    if (iv.length !== 12 || tag.length !== 16) {
      throw new CryptoError("Tamanhos de parâmetros criptográficos inválidos.");
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof CryptoError) throw error;
    throw new CryptoError("Falha na autenticação ou decodificação do token.");
  }
}

/* ====== تشفير النسخ الاحتياطية المرتبط بحساب المستخدم ======
 * النسخة تُشفّر في المتصفح قبل رفعها إلى Google Drive.
 * مفتاح المستخدم يُدار في Neon Data API خلف RLS؛ لا توجد كلمة مرور إضافية.
 * هذا يوفر تشفيراً تلقائياً للنسخة، لكنه ليس تشفيراً طرفياً ضد مشغّل Neon.
 */
import { neonClient } from "./neon";
import { sha256Hex } from "./utils";

export const BACKUP_ENVELOPE_VERSION = 1;
const IV_LENGTH = 12;

export interface EncryptedBackupEnvelope {
  app: "sajil";
  format: "encrypted-backup";
  version: number;
  ownerHash: string;
  keyVersion: number;
  exportedAt: string;
  iv: string;
  ciphertext: string;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("بنية النسخة غير صالحة");
  return value as Record<string, unknown>;
}

async function createKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportKey(key: CryptoKey): Promise<string> {
  return bytesToB64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64ToBytes(raw), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

interface KeyRow { key_material?: string; key_version?: number }
interface KeyResponse { data: KeyRow | null; error: { message?: string } | null }
interface KeyTable {
  select: (columns: string) => { limit: (count: number) => { maybeSingle: () => Promise<KeyResponse> } };
  insert: (values: Record<string, unknown>) => { select: (columns: string) => { single: () => Promise<KeyResponse> } };
}

/** الحصول على مفتاح الحساب أو إنشاؤه مرة واحدة عبر Data API المحمي بـ RLS. */
export async function getUserBackupKey(): Promise<{ key: CryptoKey; version: number }> {
  if (!neonClient) {
    throw new Error("يلزم ضبط VITE_NEON_DATA_API_URL لتفعيل تشفير النسخ المرتبط بالحساب");
  }

  const table = neonClient.from("sijll_user_crypto_keys") as unknown as KeyTable;
  const found = await table.select("key_material,key_version").limit(1).maybeSingle();
  if (found.error) throw new Error(found.error.message || "تعذر قراءة مفتاح تشفير الحساب");
  if (found.data?.key_material) {
    return { key: await importKey(found.data.key_material), version: Number(found.data.key_version) || 1 };
  }

  const key = await createKey();
  const keyMaterial = await exportKey(key);
  const inserted = await table.insert({ key_material: keyMaterial, key_version: 1 }).select("key_material,key_version").single();
  if (inserted.error) {
    /* قد يكون مستخدم آخر/تبويب آخر أنشأ المفتاح بين القراءة والإدراج؛ أعد القراءة. */
    const retry = await table.select("key_material,key_version").limit(1).maybeSingle();
    if (retry.data?.key_material) return { key: await importKey(retry.data.key_material), version: Number(retry.data.key_version) || 1 };
    throw new Error(inserted.error.message || "تعذر إنشاء مفتاح تشفير الحساب");
  }
  return { key, version: Number(inserted.data?.key_version) || 1 };
}

export async function backupOwnerHash(userId: string): Promise<string> {
  return (await sha256Hex(`sajil-owner|${userId}`)).slice(0, 24);
}

export async function encryptBackup(data: Record<string, unknown>, userId: string): Promise<EncryptedBackupEnvelope> {
  const { key, version } = await getUserBackupKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ownerHash = await backupOwnerHash(userId);
  const exportedAt = new Date().toISOString();
  const aad = new TextEncoder().encode(`sajil|${BACKUP_ENVELOPE_VERSION}|${ownerHash}|${version}`);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plain);

  return {
    app: "sajil",
    format: "encrypted-backup",
    version: BACKUP_ENVELOPE_VERSION,
    ownerHash,
    keyVersion: version,
    exportedAt,
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackup(value: unknown, userId: string): Promise<Record<string, unknown>> {
  const envelope = asRecord(value) as Partial<EncryptedBackupEnvelope>;
  if (envelope.app !== "sajil" || envelope.format !== "encrypted-backup" || envelope.version !== BACKUP_ENVELOPE_VERSION) {
    throw new Error("هذه ليست نسخة سجل مشفرة بالإصدار المدعوم");
  }
  const expectedOwnerHash = await backupOwnerHash(userId);
  if (envelope.ownerHash !== expectedOwnerHash) throw new Error("النسخة لا تخص حساب المستخدم الحالي");
  if (!envelope.iv || !envelope.ciphertext) throw new Error("النسخة المشفرة ناقصة");

  const { key, version } = await getUserBackupKey();
  if (Number(envelope.keyVersion) !== version) throw new Error("إصدار مفتاح التشفير غير متوافق");
  const aad = new TextEncoder().encode(`sajil|${envelope.version}|${envelope.ownerHash}|${envelope.keyVersion}`);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(envelope.iv), additionalData: aad },
    key,
    b64ToBytes(envelope.ciphertext),
  );
  return asRecord(JSON.parse(new TextDecoder().decode(plain)));
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<EncryptedBackupEnvelope>;
  return v.app === "sajil" && v.format === "encrypted-backup";
}

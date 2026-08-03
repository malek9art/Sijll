/* ====== النسخ الاحتياطي إلى Google Drive =====
 * تكامل مباشر من المتصفح عبر Google Identity Services + Drive API v3.
 * يتطلب Client ID لتطبيق OAuth (نوع Web) مصرّحاً بنطاق الموقع في Google Cloud Console.
 * نطاق الصلاحية drive.file: يصل فقط للملفات التي أنشأها التطبيق.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const FOLDER_NAME = "سجل - نسخ احتياطية";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (e: unknown) => void;
          }) => { requestAccessToken: (o?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let accessToken = "";
let expiresAt = 0;
let currentClientId = "";

export function isDriveConnected(): boolean {
  return !!accessToken && Date.now() < expiresAt;
}

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("تعذر تحميل خدمة قوقل — تحقق من الاتصال بالإنترنت"));
    document.head.appendChild(s);
  });
}

/** طلب رمز وصول من قوقل (يفتح نافذة الموافقة عند الحاجة) */
export async function connectDrive(clientId: string): Promise<boolean> {
  currentClientId = clientId;
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.access_token) {
          accessToken = resp.access_token;
          expiresAt = Date.now() + 50 * 60 * 1000; // ~50 دقيقة
          resolve(true);
        } else {
          reject(new Error(resp.error || "رفضت قوقل منح الصلاحية"));
        }
      },
      error_callback: () => reject(new Error("فشل الاتصال بقوقل")),
    });
    client.requestAccessToken();
  });
}

export function disconnectDrive(): void {
  accessToken = "";
  expiresAt = 0;
}

async function ensureFolder(): Promise<string> {
  const q = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const find = await fetch(`${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const findJson = await find.json();
  if (findJson.files?.length) return findJson.files[0].id;
  const create = await fetch(DRIVE_FILES, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const created = await create.json();
  return created.id;
}

/** رفع نسخة احتياطية إلى مجلد التطبيق في درايف */
export async function uploadBackupToDrive(blob: Blob, fileName: string): Promise<void> {
  if (!isDriveConnected()) await connectDrive(currentClientId);
  const folderId = await ensureFolder();
  const meta = { name: fileName, mimeType: "application/json", parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob);
  const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) throw new Error(`فشل الرفع (${res.status})`);
}

export interface DriveBackupFile { id: string; name: string; modifiedTime: string; size: string }

/** قائمة النسخ الاحتياطية في مجلد التطبيق */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  if (!isDriveConnected()) await connectDrive(currentClientId);
  const q = `name contains 'sajil-backup' and trashed=false`;
  const res = await fetch(`${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  return (json.files || []) as DriveBackupFile[];
}

/** تنزيل نسخة من درايف كنص */
export async function downloadBackupFromDrive(fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("تعذر تنزيل الملف");
  return res.text();
}

/** حذف نسخة من درايف (يُستخدم في سياسة الاحتفاظ بالنسخ الأخيرة فقط) */
export async function deleteDriveBackup(fileId: string): Promise<void> {
  if (!isDriveConnected()) await connectDrive(currentClientId);
  const res = await fetch(`${DRIVE_FILES}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`فشل حذف النسخة (${res.status})`);
}

/* ====== عميل Neon Data API الاختياري — مفاتيح التشفير وبيانات النسخ فقط ====== */
import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";
import { NEON_AUTH_URL } from "./auth";

export const NEON_DATA_API_URL = (import.meta.env.VITE_NEON_DATA_API_URL || "").trim();
export const NEON_DATA_CONFIGURED = Boolean(NEON_AUTH_URL && NEON_DATA_API_URL);

/**
 * لا نضع اتصال PostgreSQL أو كلمة مرور في الواجهة.
 * هذا العميل يستخدم Neon Data API عبر HTTPS مع JWT وRLS.
 */
export const neonClient = NEON_DATA_CONFIGURED
  ? createClient({
      auth: { url: NEON_AUTH_URL, adapter: BetterAuthReactAdapter() },
      dataApi: { url: NEON_DATA_API_URL },
    })
  : null;

/* ====== قفل بيومتري عبر WebAuthn (بصمة / Face ID / مفتاح الجهاز) =====
 *
 * ⚠️ تنبيه أمني: هذا التطبيق يعمل بالكامل في المتصفح (client-side only)
 * بدون خادم خلفي. لذلك لا يمكن التحقق من صحة WebAuthn assertion على الخادم.
 *
 * التحقق البيومتري هنا يوفر **راحة استخدام** (convenience) وليس أمانًا حقيقيًا.
 * أي كود JavaScript في المتصفح يمكنه نظريًا تجاوز هذا التحقق.
 *
 * للحماية الفعلية، يعتمد التطبيق على:
 * 1. تشفير PBKDF2 للـ PIN (القوة الحقيقية)
 * 2. Rate limiting على محاولات PIN
 * 3. البيانات محفوظة في IndexedDB (محمية بصلاحيات المتصفح)
 *
 * البصمة/Face ID هنا = اختصار سريع لفتح الجلسة، وليست بديلاً عن PIN.
 */

const bufToB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const b64ToBuf = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** تسجيل اعتماد بيومتري جديد وإرجاع معرّفه للتخزين */
export async function registerBiometric(): Promise<string> {
  if (!window.isSecureContext) throw new Error("يتطلب الاتصال البيومتري بيئة آمنة (HTTPS)");
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "سجل", id: window.location.hostname },
      user: { id: userId, name: "sajil-user", displayName: "مستخدم سجل" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("أُلغي إنشاء الاعتماد البيومتري");
  return bufToB64(cred.rawId);
}

/** التحقق البيومتري مقابل اعتماد مسجل */
export async function verifyBiometric(credentialIdB64: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: b64ToBuf(credentialIdB64) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

/* ====== التوثيق البيومتري للمستندات (التوقيع بالبصمة) ======
 * يطلب من حساس البصمة بالجهاز (WebAuthn — platform authenticator) تحققاً فورياً
 * بهوية المستخدم، ويعيد "إثبات التوثيق" (assertion) يُحفظ مع المستند:
 *   • البصمة نفسها لا تُخزَّن ولا تخرج من الحساس أبداً — خصوصية كاملة.
 *   • ما يُحفظ: معرّف الاعتماد، التحدي (مشتق من بصمة المستند الرقمية)،
 *     بيانات الاعتماد المشفرة، والتوقيع — دليل تحقق بيومتري فوري مربوط بالمستند.
 */
export interface BiometricAttestation {
  credentialId: string;      // b64
  challenge: string;         // b64
  clientDataJSON: string;    // b64
  authenticatorData: string; // b64
  signature: string;         // b64
  rpId: string;
}

/** توقيع/توثيق مستند بحساس البصمة — يعيد إثبات تحقق بيومتري مربوط بالتحدي الممرَّر */
export async function signWithBiometric(challengeText: string, knownCredentialIdB64?: string): Promise<BiometricAttestation> {
  if (!window.isSecureContext) throw new Error("يتطلب التوثيق البيومتري بيئة آمنة (HTTPS)");
  if (!window.PublicKeyCredential) throw new Error("هذا الجهاز لا يدعم التوثيق البيومتري (WebAuthn)");
  if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    throw new Error("لا يتوفر حساس بصمة على هذا الجهاز");
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) throw new Error("لا يتوفر حساس بصمة على هذا الجهاز");

  const challenge = new TextEncoder().encode(challengeText);
  const allowCredentials: PublicKeyCredentialDescriptor[] = knownCredentialIdB64
    ? [{ type: "public-key", id: b64ToBuf(knownCredentialIdB64) }]
    : [];

  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials,
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("أُلغي التوثيق البيومتري");

  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: bufToB64(cred.rawId),
    challenge: bufToB64(challenge),
    clientDataJSON: bufToB64(res.clientDataJSON),
    authenticatorData: bufToB64(res.authenticatorData),
    signature: bufToB64(res.signature),
    rpId: window.location.hostname,
  };
}

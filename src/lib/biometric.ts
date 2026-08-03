/* ====== قفل بيومتري عبر WebAuthn (بصمة / Face ID / مفتاح الجهاز) ===== */

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

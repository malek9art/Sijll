import { describe, expect, it } from "vitest";
import { isValidOtp, normalizeOtp } from "@/lib/otp";

describe("email OTP helpers", () => {
  it("يدعم الأرقام الإنجليزية والعربية", () => {
    expect(normalizeOtp("١٢٣٤٥٦")).toBe("123456");
    expect(normalizeOtp(" 12-34 56 ")).toBe("123456");
  });

  it("لا يقبل إلا ستة أرقام", () => {
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("1234567")).toBe(false);
    expect(isValidOtp("abcdef")).toBe(false);
  });
});

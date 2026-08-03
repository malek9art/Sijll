/* ====== Error Boundary — يلتقط أخطاء React ويعرض شاشة استرداد بدلاً من الشاشة البيضاء ====== */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    /* تسجيل الخطأ في وحدة التحكم للتشخيص */
    console.error("[ErrorBoundary] خطأ غير معالج في React:", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.hash = "#/";
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        lang="ar"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)",
          padding: "24px",
          fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          {/* الشعار */}
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 20px",
              borderRadius: 18,
              background: "linear-gradient(135deg, #10b981, #065f46)",
              display: "grid",
              placeItems: "center",
              fontSize: 32,
              boxShadow: "0 8px 32px rgba(16, 185, 129, 0.3)",
            }}
          >
            ⚠️
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", margin: "0 0 8px" }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.8, margin: "0 0 24px" }}>
            تعذر على التطبيق المتابعة بسبب خطأ تقني. بياناتك محفوظة بأمان في قاعدة البيانات المحلية.
          </p>

          {/* تفاصيل الخطأ */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 24,
              textAlign: "right",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "#f87171", margin: "0 0 6px" }}>
              تفاصيل الخطأ:
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#cbd5e1",
                margin: 0,
                fontFamily: "monospace",
                wordBreak: "break-all",
                lineHeight: 1.6,
                direction: "ltr",
              }}
            >
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>

          {/* الأزرار */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={this.reload}
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 12,
                border: "none",
                background: "#047857",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🔄 إعادة تحميل الصفحة
            </button>
            <button
              onClick={this.goHome}
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "#e2e8f0",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🏠 العودة للرئيسية
            </button>
          </div>

          <p style={{ fontSize: 11, color: "#64748b", marginTop: 32, lineHeight: 1.7 }}>
            إذا تكرر الخطأ، يُرجى تصدير نسخة احتياطية من الإعدادات وإعادة تحميل التطبيق.
            <br />
            <span style={{ fontWeight: 700, color: "#10b981" }}>سِجِلّ</span> — تطوير Malek Logic
          </p>
        </div>
      </div>
    );
  }
}

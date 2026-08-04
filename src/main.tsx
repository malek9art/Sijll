import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

function boot(): void {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );

  /* تسجيل عامل الخدمة بمسار نسبي — يعمل على الجذر وعلى المسارات الفرعية في GitHub Pages */
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      const swUrl = new URL("sw.js", document.baseURI).href;
      const scope = new URL("./", document.baseURI).href;
      navigator.serviceWorker.register(swUrl, { scope }).then(() => {
        /* الاستماع لرسائل التحديث من عامل الخدمة */
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "SAJIL_UPDATE_AVAILABLE") {
            const msg = document.createElement("div");
            msg.dir = "rtl";
            msg.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#047857;color:#fff;padding:12px 20px;border-radius:12px;font-family:system-ui,sans-serif;font-size:14px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;gap:8px;";
            msg.innerHTML = '🔄 تحديث جديد متاح — اضغط للتطبيق';
            msg.onclick = () => window.location.reload();
            document.body.appendChild(msg);
          }
        });
      }).catch(() => {
        /* التطبيق يعمل بالكامل حتى دون عامل الخدمة */
      });
    });
  }
}

void boot();

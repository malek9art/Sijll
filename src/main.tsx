import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initDB } from "./lib/db";

async function boot(): Promise<void> {
  try {
    await initDB();
  } catch (err) {
    console.error("تعذر تهيئة قاعدة البيانات:", err);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  /* تسجيل عامل الخدمة بمسار نسبي — يعمل على الجذر وعلى المسارات الفرعية في GitHub Pages */
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      const swUrl = new URL("sw.js", document.baseURI).href;
      const scope = new URL("./", document.baseURI).href;
      navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
        /* التطبيق يعمل بالكامل حتى دون عامل الخدمة */
      });
    });
  }
}

void boot();

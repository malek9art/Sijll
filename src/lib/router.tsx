/* ====== موجه مسارات خفيف يعمل مع GitHub Pages (Hash-based) ====== */
import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";

export interface Route {
  segments: string[];
  search: URLSearchParams;
}

export function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean);
  return { segments, search: new URLSearchParams(query) };
}

export function navigate(to: string): void {
  window.location.hash = `#/${to.replace(/^\/+/, "")}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function Link({ to, className, children, onNavigate, title }: { to: string; className?: string; children: ReactNode; onNavigate?: () => void; title?: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigate?.();
    navigate(to);
  };
  return (
    <a href={`#/${to.replace(/^\/+/, "")}`} className={className} onClick={handle} title={title}>
      {children}
    </a>
  );
}

export function useNavigate(): (to: string) => void {
  return useCallback((to: string) => navigate(to), []);
}

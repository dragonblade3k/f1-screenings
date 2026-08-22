"use client";

import { useEffect } from "react";

export default function AdminHeaderInjector() {
  useEffect(() => {
    const handler = async (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (!form || form.tagName !== "FORM") return;

      const action = form.getAttribute("action") || "";
      if (!action.startsWith("/api/admin/")) return;

      e.preventDefault();

      const token = (window as any).__ADMIN_TOKEN__ || "";
      if (!token) {
        alert("Missing ADMIN token. Run the console snippet on this page once.");
        return;
      }

      const fd = new FormData(form);
      const res = await fetch(action, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd
      });

      if (res.redirected) window.location.href = res.url;
      else window.location.reload();
    };

    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, []);

  return null;
}

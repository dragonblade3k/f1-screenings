import type { ReactNode } from "react";

export const metadata = {
  title: "F1 Screenings (Local POC)",
  description: "Mumbai + Thane + Navi Mumbai"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>
        <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}>
              F1 Screenings (POC)
            </a>
            <a href="/admin/inbox">Admin</a>
          </div>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}

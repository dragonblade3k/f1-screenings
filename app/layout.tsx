import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Paddock — F1 screenings in the Mumbai metro",
  description:
    "Find where Formula 1 races are being screened across Mumbai, Thane, and Navi Mumbai. Every listing is verified by a human before it goes live.",
  openGraph: {
    title: "Paddock — F1 screenings in the Mumbai metro",
    description: "Find where Formula 1 races are being screened near you."
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap inner">
            <a href="/" className="wordmark">
              <span className="bars" aria-hidden="true"><i /><i /><i /></span>
              Paddock
            </a>
            <nav className="nav">
              <a href="/">Screenings</a>
              <a href="/admin/inbox">Admin</a>
            </nav>
          </div>
        </header>

        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "WOS Tools - Whiteout Survival Toolkit",
  description:
    "集結シミュレーターとSVS褒賞抽選ツール for Whiteout Survival",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-wos-border bg-wos-panel px-4 py-4">
          <div className="mx-auto max-w-6xl text-center text-xs text-gray-500">
            WOS Tools &copy; 2026 &mdash; Whiteout Survival Community Toolkit
          </div>
        </footer>
      </body>
    </html>
  );
}

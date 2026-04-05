import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "WOS Tools - Whiteout Survival Toolkit",
  description:
    "集結シミュレーターとSVS褒賞抽選for564ツール for Whiteout Survival",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        {/* ヘッダー */}
        <Header />

        {/* メインコンテンツ */}
        <main className="relative">{children}</main>

        {/* フッター */}
        <footer className="bg-[#2a4a6a] px-4 py-4">
          <div className="gold-divider mx-auto mb-3 max-w-xs" />
          <div className="mx-auto max-w-6xl text-center text-xs text-white/50">
            WOS Tools &copy; 2026 &mdash; Whiteout Survival Community Toolkit
          </div>
        </footer>
      </body>
    </html>
  );
}

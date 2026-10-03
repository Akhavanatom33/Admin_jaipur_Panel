import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "پنل مدیریت جی پور | Jaipur Admin Panel",
  description: "پنل مدیریت کامل ربات تلگرام برای زمان‌بندی پیام، کمپین‌های تکرارشونده و مدیریت گروه‌ها.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-950 font-[Vazirmatn,sans-serif] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

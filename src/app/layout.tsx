import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { AppProvider } from "@/providers/app-provider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WEGO ELECTRIC - ניהול פרויקטי חשמל",
  description: "מערכת ניהול פרויקטי חשמל מתקדמת",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

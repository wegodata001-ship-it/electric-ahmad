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
  title: "אחמד אבו גרה · ניהול פרויקטי חשמל",
  description: "ניהול פרויקטי חשמל",
  applicationName: "אחמד אבו גרה",
  icons: {
    icon: [{ url: "/logopng.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/logopng.jpeg", type: "image/jpeg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='elec.a11y.settings.v1';var r=localStorage.getItem(k);var s=r?JSON.parse(r):null;var d=document.documentElement;var scale=(s&&typeof s.fontScale==='number')?s.fontScale:1;d.style.setProperty('--a11y-font-scale',String(scale));d.dataset.a11yContrast=s&&s.highContrast?'high':'off';d.dataset.a11yGrayscale=s&&s.grayscale?'on':'off';d.dataset.a11yLinks=s&&s.highlightLinks?'on':'off';d.dataset.a11yFont=s&&s.readableFont?'readable':'default';d.dataset.a11ySpacing=s&&s.wideSpacing?'wide':'default';var reduce=s?!!s.reduceMotion:(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);d.dataset.a11yMotion=reduce?'reduce':'default';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${heebo.variable} font-sans antialiased`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

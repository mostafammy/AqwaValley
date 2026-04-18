import "~/styles/globals.css";

import { type Metadata } from "next";
import { Cairo } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import AssistLoopLoader from "~/app/_components/AssistLoopLoader";
import NavigationProgressBar from "~/app/_components/NavigationProgressBar";
import PageTransition from "./_components/PageTransition";

export const metadata: Metadata = {
  title: "أكوا الوادي — نظام إدارة المياه",
  description: "Water Management System — New Valley Governorate, Egypt",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      {/* Anti-flash: restore settings before first paint */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('aquavalley:settings:v2')||'{}');var h=document.documentElement;if(s.fontSize)h.setAttribute('data-font-size',s.fontSize);if(s.contrast)h.setAttribute('data-contrast',s.contrast);if(s.reduceMotion)h.setAttribute('data-reduce-motion','true');}catch(e){}})();`,
          }}
        />
      </head>
      <AssistLoopLoader />
      <body className="antialiased">
        <NavigationProgressBar />
        <PageTransition>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </PageTransition>
      </body>
    </html>
  );
}

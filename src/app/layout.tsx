import "~/styles/globals.css";

import { type Metadata } from "next";
import { Cairo } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Script from "next/script";

export const metadata: Metadata = {
  title: "أكوا الوادي — نظام إدارة المياه",
  description: "Water Management System — New Valley Governorate, Egypt",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
      <Script
        src="https://assistloop.ai/assistloop-widget.js"
        strategy="afterInteractive"
      />
      <Script
        id="assistloop-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.AssistLoopWidget?.init({ agentId: "${process.env.NEXT_PUBLIC_ASSISTLOOP_AGENT_ID}" })`,
        }}
      />
      <body className="antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}

import "~/styles/globals.css";

import { type Metadata } from "next";
import { Cairo } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import AssistLoopLoader from "~/app/_components/AssistLoopLoader";

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
      <AssistLoopLoader />
      <body className="antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}

import "~/styles/globals.css";

import { type Metadata } from "next";
import { Cairo, Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import AssistLoopLoader from "~/app/_components/AssistLoopLoader";
import NavigationProgressBar from "~/app/_components/NavigationProgressBar";
import PageTransition from "./_components/PageTransition";
import { cn } from "~/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ar" dir="rtl" className={cn("font-sans", geist.variable)}>
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

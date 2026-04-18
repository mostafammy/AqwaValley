import type { Metadata } from "next";
import { SettingsClient } from "./_components/settings-client";

export const metadata: Metadata = {
  title: "الإعدادات | AquaValley",
  description: "تخصيص تجربة الاستخدام وإعدادات إمكانية الوصول",
};

export default function SettingsPage() {
  return <SettingsClient />;
}

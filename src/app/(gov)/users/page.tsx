import { type Metadata } from "next";
import { UserManagementClient } from "./_components/users-page-client";

export const metadata: Metadata = {
  title: "إدارة المستخدمين | AqwaValley",
  description: "إنشاء هويات جديدة للمستخدمين وإرسال دعوات تفعيل آمنة.",
};

export default function UserManagementPage() {
  return <UserManagementClient />;
}

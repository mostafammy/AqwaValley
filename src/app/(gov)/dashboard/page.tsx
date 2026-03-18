import { DashboardHeader } from "~/app/_components/layouts/DashboardHeader";

export default function DashboardPage() {
  return (
    <div>
      <DashboardHeader 
        title="لوحة التحكم الرئيسية" 
        subtitle="تحديث مباشر كل 15 دقيقة" 
      />
    </div>
  );
}
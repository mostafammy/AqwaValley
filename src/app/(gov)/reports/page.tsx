import { type Metadata } from "next";
import { ReportsClient } from "./_components/ReportsClient";

export const metadata: Metadata = {
  title: "التقارير | AqwaValley",
  description: "عرض وإدارة التقارير والنماذج",
};

export default function ReportsPage() {
  return <ReportsClient />;
}

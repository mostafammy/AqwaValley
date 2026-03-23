"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "~/app/_components/UI/Button";

export function DemoAlertButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const triggerDemoAlerts = async () => {
    setIsLoading(true);
    setMessage("⏳ جارٍ إنشاء تنبيهات تجريبية...");

    try {
      // Get wells using tRPC
      const wellsResponse = await fetch("/api/trpc/wells.list?input=%7B%22json%22%3A%7B%22page%22%3A1%2C%22pageSize%22%3A3%7D%7D");
      
      if (!wellsResponse.ok) {
        setMessage("⚠️ خطأ في جلب قائمة الآبار");
        setIsLoading(false);
        return;
      }

      const wellsData = await wellsResponse.json();
      const wells = wellsData.result?.data?.json?.items ?? [];

      if (wells.length === 0) {
        setMessage("⚠️ لا توجد آبار في النظام. يرجى تشغيل سكريبت الزراعة أولاً (pnpm seed)");
        setIsLoading(false);
        return;
      }

      // Different alert scenarios with clear Arabic messages
      const alertScenarios = [
        { 
          sensorType: "water_level", 
          value: 3,
          severity: "حرج",
          color: "🔴",
          title: "انخفاض حاد في منسوب المياه",
          description: "انخفض منسوب المياه في البئر إلى مستويات حرجة!",
        },
        { 
          sensorType: "flow_rate", 
          value: 12,
          severity: "تحذير",
          color: "🟡",
          title: "ارتفاع في معدل التدفق",
          description: "تم تجاوز الحد الآمن لمعدل تدفق المياه.",
        },
        { 
          sensorType: "pressure", 
          value: 5,
          severity: "تحذير",
          color: "🟡",
          title: "ارتفاع ضغط غير طبيعي",
          description: "تم اكتشاف ضغط عالي غير طبيعي في النظام.",
        },
      ];

      const results = [];
      
      for (let i = 0; i < Math.min(wells.length, 3); i++) {
        const well = wells[i];
        const scenario = alertScenarios[i]!;
        const wellName = well.name ?? `البئر ${i + 1}`;

        try {
          const response = await fetch("/api/admin/mock-ingest", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wellId: well.id,
              value: scenario.value,
              sensorType: scenario.sensorType,
            }),
          });

          if (response.ok) {
            results.push(`${scenario.color} ${wellName}: ${scenario.title}`);
          }
        } catch {
          // Skip failed wells
        }
      }

      if (results.length > 0) {
        setMessage(`✅ تم إنشاء ${results.length} تنبيه تجريبي:\n\n${results.join("\n")}\n\nℹ️ ستظهر هذه التنبيهات في صفحة التنبيهات والإشعارات`);
        router.refresh();
        
        setTimeout(() => setMessage(null), 6000);
      } else {
        setMessage("❌ فشلت عملية إنشاء التنبيهات. تأكد من وجود حساسات في الآبار.");
      }
    } catch {
      setMessage("❌ حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="danger"
        size="sm"
        onClick={triggerDemoAlerts}
        disabled={isLoading}
        icon={isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
      >
        {isLoading ? "جارٍ..." : "تشغيل تنبيهات تجريبية"}
      </Button>
      {message && (
        <div className="text-xs text-right whitespace-pre-line bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-800">
          {message}
        </div>
      )}
    </div>
  );
}

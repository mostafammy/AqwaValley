"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "~/app/_components/UI/Button";

type DemoWell = {
  id: string;
  name?: string | null;
};

type WellsListPayload = {
  result?: {
    data?: {
      json?: {
        items?: DemoWell[];
      };
    };
  };
};

function extractWells(payload: unknown): DemoWell[] {
  if (!payload || typeof payload !== "object") return [];

  const items = (payload as WellsListPayload).result?.data?.json?.items;
  if (!Array.isArray(items)) return [];

  return items.filter(
    (item): item is DemoWell =>
      !!item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      (typeof item.name === "string" || item.name == null),
  );
}

export function DemoAlertButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const triggerDemoAlerts = async () => {
    setIsLoading(true);
    setMessage("جارٍ إنشاء تنبيهات تجريبية...");

    try {
      // Get wells using tRPC
      const wellsResponse = await fetch("/api/trpc/wells.list?input=%7B%22json%22%3A%7B%22page%22%3A1%2C%22pageSize%22%3A3%7D%7D");
      
      if (!wellsResponse.ok) {
        setMessage("خطأ في جلب قائمة الآبار");
        setIsLoading(false);
        return;
      }

      const wellsPayload: unknown = await wellsResponse.json();
      const wells = extractWells(wellsPayload);

      if (wells.length === 0) {
        setMessage("لا توجد آبار في النظام. يرجى تشغيل سكريبت الزراعة أولاً (pnpm seed)");
        setIsLoading(false);
        return;
      }

      // Different alert scenarios with clear Arabic messages
      const alertScenarios = [
        { 
          sensorType: "water_level", 
          value: 3,
          severity: "حرج",
          color: "[حرج]",
          title: "انخفاض حاد في منسوب المياه",
          description: "انخفض منسوب المياه في البئر إلى مستويات حرجة!",
        },
        { 
          sensorType: "flow_rate", 
          value: 12,
          severity: "تحذير",
          color: "[تحذير]",
          title: "ارتفاع في معدل التدفق",
          description: "تم تجاوز الحد الآمن لمعدل تدفق المياه.",
        },
        { 
          sensorType: "pressure", 
          value: 5,
          severity: "تحذير",
          color: "[تحذير]",
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
        setMessage(`تم إنشاء ${results.length} تنبيه تجريبي:\n\n${results.join("\n")}\n\nستظهر هذه التنبيهات في صفحة التنبيهات والإشعارات`);
        router.refresh();
        
        setTimeout(() => setMessage(null), 6000);
      } else {
        setMessage("فشلت عملية إنشاء التنبيهات. تأكد من وجود حساسات في الآبار.");
      }
    } catch {
      setMessage("حدث خطأ أثناء الاتصال بالخادم");
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

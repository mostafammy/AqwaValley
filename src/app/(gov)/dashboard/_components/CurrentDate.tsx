"use client";

import { useEffect, useState } from "react";

export function CurrentDate() {
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    // Generate the date string only on the client
    const date = new Date();
    setDateStr(
      date.toLocaleDateString("ar-EG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  // Return an empty span or a skeleton-like space during CSR boot to avoid layout shift
  if (!dateStr) return <span className="opacity-0">جاري تحميل التاريخ...</span>;

  return <span>{dateStr}</span>;
}

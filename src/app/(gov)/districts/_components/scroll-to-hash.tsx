"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function ScrollToHash() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;

    // Wait for page to render then scroll
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return null;
}
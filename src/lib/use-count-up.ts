"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 800, decimals = 0) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease out cubic
      const current  = start + diff * eased;
      
      setValue(current);

      if (progress < 1) rafId = requestAnimationFrame(tick);
      else prev.current = target;
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [target, duration]);

  // Round only the return value so the internal state is smooth
  return Number(value.toFixed(decimals));
}
"use client";

import Script from "next/script";
import { useCallback } from "react";

type AssistLoopWin = {
  AssistLoopWidget?: {
    init?: (opts: { agentId: string }) => void;
  };
};

export default function AssistLoopLoader() {
  const agentId = process.env.NEXT_PUBLIC_ASSISTLOOP_AGENT_ID;

  const onReady = useCallback(() => {
    const win = window as unknown as AssistLoopWin;
    if (win?.AssistLoopWidget?.init) {
      try {
        win.AssistLoopWidget.init({ agentId: agentId! });
      } catch (e) {
        console.error("AssistLoop init failed:", e);
      }
      return;
    }

    // Fallback polling in case the widget attaches slightly after onReady
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (win?.AssistLoopWidget?.init) {
        clearInterval(iv);
        try {
          win.AssistLoopWidget.init({ agentId: agentId! });
        } catch (e) {
          console.error("AssistLoop init failed:", e);
        }
      } else if (tries > 10) {
        clearInterval(iv);
      }
    }, 200);
  }, [agentId]);

  if (!agentId) return null;

  return (
    <Script
      src="https://assistloop.ai/assistloop-widget.js"
      strategy="afterInteractive"
      onReady={onReady}
    />
  );
}

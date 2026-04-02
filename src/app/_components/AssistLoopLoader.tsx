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
    if (!agentId || !win?.AssistLoopWidget?.init) return;

    try {
      win.AssistLoopWidget.init({ agentId });
    } catch (e) {
      console.error("AssistLoop init failed:", e);
    }
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
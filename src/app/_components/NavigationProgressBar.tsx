// app/_components/NavigationProgressBar.tsx
"use client";

import NextTopLoader from "nextjs-toploader";

export default function NavigationProgressBar() {
  return (
    <NextTopLoader
      color="#1D6FA8"
      height={3}
      initialPosition={0.08}
      crawlSpeed={220}
      speed={280}
      crawl={true}
      showSpinner={false}
      easing="ease"
      shadow="0 0 10px #1D6FA8, 0 0 5px #1D6FA8"
      zIndex={9999}
      // Debug options (remove these two lines after it works)
      showAtBottom={false}
    />
  );
}
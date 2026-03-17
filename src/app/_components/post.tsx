"use client";

import { api } from "~/trpc/react";

export function LatestPost() {
  const testMessage = api.post.getSecretMessage.useQuery();

  return (
    <div className="w-full max-w-xs rounded-lg border border-white/20 bg-white/5 p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">System Status</h3>
      {testMessage.data ? (
        <p className="text-sm text-white/70">{testMessage.data}</p>
      ) : testMessage.isLoading ? (
        <p className="text-sm text-white/50">Loading...</p>
      ) : testMessage.error ? (
        <p className="text-sm text-red-400">
          Error: {testMessage.error.message}
        </p>
      ) : null}
    </div>
  );
}

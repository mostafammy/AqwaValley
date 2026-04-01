/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "**/.pnpm-store/**",
        "**/pnpm/store/**",
      ],
    },
  },
};

// Plugin options for @sentry/webpack-plugin — passed as the 2nd arg to withSentryConfig
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "aqwa-valley",
  project: "sentry-alizarin-forest",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Webpack-related tweaks that Sentry can apply
  webpack: {
    // Cron scheduling is managed externally via QStash and synchronized from this repo.
    automaticVercelMonitors: false,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
};

export default withSentryConfig(config, sentryWebpackPluginOptions);

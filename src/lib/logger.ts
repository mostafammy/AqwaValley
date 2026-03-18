import pino from "pino";
import pretty from "pino-pretty";

const isDev = process.env.NODE_ENV === "development";
const level = process.env.LOG_LEVEL ?? "info";

const loggerConfig: pino.LoggerOptions = { level };

// Use in-process pretty stream in development to avoid transport worker crashes
// in Next.js route worker environments.
const prettyStream = isDev
  ? pretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    })
  : undefined;

export const logger = prettyStream
  ? pino(loggerConfig, prettyStream)
  : pino(loggerConfig);

/**
 * Logger terstruktur untuk Posyandu+ (F1-10 & NFR6).
 * Menyediakan format log JSON standar yang kompatibel dengan Vercel, Supabase, dan Sentry.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogPayload {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function emitLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload: LogPayload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(payload);

  switch (level) {
    case "error":
      console.error(jsonString);
      break;
    case "warn":
      console.warn(jsonString);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(jsonString);
      }
      break;
    default:
      console.log(jsonString);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emitLog("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emitLog("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emitLog("error", message, context),
  debug: (message: string, context?: Record<string, unknown>) => emitLog("debug", message, context),
};


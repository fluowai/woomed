type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const req = entry.requestId ? ` [${entry.requestId}]` : "";
  const user = entry.userId ? ` [user:${entry.userId}]` : "";
  const tenant = entry.tenantId ? ` [tenant:${entry.tenantId}]` : "";
  const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : "";
  return `${base}${req}${user}${tenant} ${entry.message}${meta}`;
}

export function log(level: LogLevel, message: string, context?: { requestId?: string; userId?: string; tenantId?: string; meta?: Record<string, unknown> }) {
  if (!shouldLog(level)) return;
  const entry: LogEntry = {
    level,
    message,
    requestId: context?.requestId,
    userId: context?.userId,
    tenantId: context?.tenantId,
    meta: context?.meta,
    timestamp: new Date().toISOString(),
  };
  const formatted = formatLog(entry);
  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Parameters<typeof log>[2]) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Parameters<typeof log>[2]) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Parameters<typeof log>[2]) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Parameters<typeof log>[2]) => log("error", msg, ctx),
};

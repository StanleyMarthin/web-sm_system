import { logger } from "@/observability/logger";

export function registerProcessErrorHooks(): void {
  process.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { error });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", { error: reason });
    process.exit(1);
  });
}

// Task Execution Page (mechanic)
import { Suspense } from "react";
import { TaskExecutionPageClient } from "@/features/task-execution/components/task-execution-page-client";
import { Loader2 } from "lucide-react";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TaskExecutionPageClient />
    </Suspense>
  );
}

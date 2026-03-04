// Projects Page — Server Component shell
import { Suspense } from "react";
import { ProjectsPageClient } from "@/features/projects/components/projects-page-client";
import { Loader2 } from "lucide-react";

function ProjectsFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsFallback />}>
      <ProjectsPageClient />
    </Suspense>
  );
}

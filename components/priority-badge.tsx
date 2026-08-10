import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types";

const priorityConfig: Record<
  Priority,
  { label: string; variant: "destructive" | "warning" | "success" }
> = {
  high: { label: "Alta", variant: "destructive" },
  medium: { label: "Media", variant: "warning" },
  low: { label: "Bassa", variant: "success" },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const config = priorityConfig[priority];
  return (
    <Badge variant={config.variant} className={cn("font-medium", className)}>
      {config.label}
    </Badge>
  );
}

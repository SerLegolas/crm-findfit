import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types";

const priorityConfig: Record<
  Priority,
  { label: string; variant: "destructive" | "warning" | "success" }
> = {
  high: { label: "Alta", variant: "destructive" },
  medium: { label: "Media", variant: "warning" },
  low: { label: "Bassa", variant: "success" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}

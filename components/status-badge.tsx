import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/types";

const statusConfig: Record<
  ClientStatus,
  { label: string; variant: "info" | "warning" | "success" | "muted" }
> = {
  lead: { label: "Lead", variant: "info" },
  suspect: { label: "Suspect", variant: "warning" },
  won: { label: "Won", variant: "success" },
  close: { label: "Close", variant: "muted" },
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}

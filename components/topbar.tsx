"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Bell, CalendarDays } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface TopbarProps {
  onMenuClick: () => void;
}

interface OverdueTask {
  id: string;
  title: string;
  dueDate: number;
  clientId: string | null;
  clientName: string | null;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);

  const fetchOverdueTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const now = Date.now();
      const overdue = data
        .filter(
          (t: any) =>
            (t.status === "todo" || t.status === "in_progress") &&
            t.dueDate &&
            new Date(t.dueDate).getTime() < now
        )
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          dueDate: new Date(t.dueDate).getTime(),
          clientId: t.clientId || null,
          clientName: t.clientName || null,
        }))
        .sort((a: OverdueTask, b: OverdueTask) => (a.dueDate ?? 0) - (b.dueDate ?? 0));

      setOverdueTasks(overdue);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setUser(json.user);
      })
      .catch(() => {});

    fetchOverdueTasks();
    const interval = setInterval(fetchOverdueTasks, 60000); // refresh ogni minuto
    return () => clearInterval(interval);
  }, [fetchOverdueTasks]);

  const initials = user
    ? user.name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2)
    : "CF";

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "DELETE" });
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link href="/dashboard" className="hover:underline">
        <h1 className="text-lg font-semibold">CRM FindFit</h1>
      </Link>

      <div className="flex-1" />

      {/* Pulsante task scaduti */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {overdueTasks.length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px]"
              >
                {overdueTasks.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>
            Task scaduti ({overdueTasks.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {overdueTasks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nessun task scaduto
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="p-1">
                {overdueTasks.map((task) => {
                  const daysLate = Math.floor((Date.now() - (task.dueDate ?? 0)) / (1000 * 60 * 60 * 24));
                  return (
                    <DropdownMenuItem key={task.id} asChild>
                      <Link
                        href={task.clientId ? `/clienti/${task.clientId}` : "/task"}
                        className="flex flex-col items-start gap-0.5 py-2 cursor-pointer w-full border-b border-border/50 last:border-b-0"
                      >
                        <div className="flex items-center justify-between w-full text-xs text-destructive">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>{formatDate(task.dueDate)}</span>
                          </span>
                          <span className="font-semibold">+{daysLate} g</span>
                        </div>
                        <span className="text-sm font-medium leading-snug text-left w-full">
                          {task.title}
                        </span>
                        {task.clientName && (
                          <span className="text-xs text-muted-foreground text-left w-full">
                            {task.clientName}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/task" className="justify-center text-sm font-medium cursor-pointer">
              Vedi tutti i task
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {user ? (
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
              </div>
            ) : (
              "Il mio account"
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            Esci
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

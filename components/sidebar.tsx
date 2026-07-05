"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CalendarCheck,
  CalendarDays,
  FileText,
  Settings,
  Shield,
  Server,
  Facebook,
  LogOut,
  X,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Trattative", icon: Kanban },
  { href: "/clienti", label: "Lista Clienti", icon: Users },
  { href: "/task-calendar", label: "Calendario Task", icon: CalendarDays },
  { href: "/task", label: "Task Scaduti", icon: CalendarCheck },
  { href: "/note", label: "Note Recenti", icon: FileText },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const router = usePathname(); // just for reactivity

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    fetch("/api/company-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.denominazione) setCompanyName(data.denominazione);
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "DELETE" });
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col items-center justify-center h-14 border-b px-4 lg:hidden">
          <span className="font-semibold text-sm">CRM FindFit</span>
          {companyName?.trim() && (
            <span className="text-[10px] text-muted-foreground leading-tight">{companyName.trim()}</span>
          )}
          <Button variant="ghost" size="icon" className="absolute right-2 top-3" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* Titolo desktop */}
          <div className="hidden lg:flex flex-col items-center px-3 pb-4 border-b mb-4">
            <p className="font-semibold text-sm text-center">CRM FindFit</p>
            {companyName?.trim() && (
              <p className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">{companyName.trim()}</p>
            )}
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const isImpostazioni = item.href === "/impostazioni";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                    isImpostazioni && "hidden lg:flex"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Admin section */}
            {user?.role === "admin" && (
              <div className="hidden lg:block">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className="mt-4 mb-1 px-3 flex items-center justify-between w-full text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Admin</span>
                  {adminOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                {adminOpen && (
                  <>
                <Link
                  href="/admin/users"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === "/admin/users"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Shield className="h-5 w-5 shrink-0" />
                  <span>Gestione Utenti</span>
                </Link>
                <Link
                  href="/admin/imap"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === "/admin/imap"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Server className="h-5 w-5 shrink-0" />
                  <span>Configurazione Email</span>
                </Link>
                <Link
                  href="/test-email"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === "/test-email"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Download className="h-5 w-5 shrink-0" />
                  <span>Recupero email</span>
                </Link>
                <Link
                  href="/admin/facebook-post"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === "/admin/facebook-post"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Facebook className="h-5 w-5 shrink-0" />
                  <span>Facebook Post</span>
                </Link>
              </>
            )}
              </div>
            )}
          </nav>
        </div>

        <div className="border-t p-4 space-y-2">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Esci">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

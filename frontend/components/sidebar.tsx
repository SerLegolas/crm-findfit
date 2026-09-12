"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_VERSION_LABEL } from "@/lib/app-version";
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
  BarChart3,
  History,
  MailIcon,
  User,
  Building2,
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
];

// Mappa: href del navItem → feature key
// Solo gli item con una feature key vengono filtrati; /dashboard è sempre visibile.
const navFeatureMap: Record<string, string> = {
  "/clienti": "clienti",
  "/kanban": "kanban",
  "/task": "task",
  "/task-calendar": "task",
  "/note": "note",
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [strumentiOpen, setStrumentiOpen] = useState(false);
  const [impostazioniOpen, setImpostazioniOpen] = useState(() =>
    pathname.startsWith("/impostazioni")
  );
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean> | null>(null);
  const [featuresAdmin, setFeaturesAdmin] = useState<Record<string, boolean> | null>(null);

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

    // Carica le regole azienda per filtrare le voci di menu
    fetch("/api/company-rules")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          if (data.features) setEnabledFeatures(data.features);
          if (data.featuresAdmin) setFeaturesAdmin(data.featuresAdmin);
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Mantieni aperto il menu Impostazioni quando si è in una sottopagina
  useEffect(() => {
    if (pathname.startsWith("/impostazioni")) setImpostazioniOpen(true);
  }, [pathname]);

  // Mappa: href admin → featureAdmin key (opt-in)
  const adminLinkFeature: Record<string, string> = {
    "/admin/users": "gestione_utenti",
    "/admin/imap": "configurazione_email",
    "/admin/auto-reply": "configurazione_email",
    "/test-email": "recupero_email",
    "/admin/facebook-post": "facebook_post",
  };

  // Filtra i link admin in base a featuresAdmin
  function isAdminLinkEnabled(href: string): boolean {
    const key = adminLinkFeature[href];
    if (!key) return true; // link senza feature key sempre visibile
    if (!featuresAdmin) return true; // nessuna regola = tutto visibile
    return featuresAdmin[key] === true; // opt-in
  }

  // Filtra navItems in base alle feature abilitate
  // Modello opt-in: mostra solo gli item la cui feature key è esplicitamente true
  const filteredNavItems = navItems.filter((item) => {
    // Se le features non sono ancora caricate, mostra tutto
    if (!enabledFeatures) return true;

    // /dashboard è sempre visibile
    if (item.href === "/dashboard") return true;

    // Cerca la feature key corrispondente all'href
    const featureKey = navFeatureMap[item.href];

    // Se non c'è una feature associata, mostra sempre
    if (!featureKey) return true;

    // Mostra SOLO se la feature è esplicitamente true nell'oggetto features
    return enabledFeatures[featureKey] === true;
  });

  // Dropdown "Strumenti": visibile se almeno una feature tra analisi, template e comunicazioni è attiva
  const strumentiVisible =
    !enabledFeatures ||
    enabledFeatures.analisi === true ||
    enabledFeatures.template === true ||
    enabledFeatures.comunicazioni === true;

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#eef2ff] transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col items-center justify-center h-14 border-b border-[#e2e8f0] px-4 lg:hidden">
          <span className="font-semibold text-sm text-[#2563eb]">CRM FindFit</span>
          {companyName?.trim() && (
            <span className="text-[10px] text-[#475569] leading-tight">{companyName.trim()}</span>
          )}
          <Button variant="ghost" size="icon" className="absolute right-2 top-3 text-[#475569] hover:text-[#1e293b]" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* Titolo desktop */}
          <div className="hidden lg:flex flex-col items-center px-3 pb-4 border-b border-[#e2e8f0] mb-4">
            <p className="font-semibold text-sm text-center text-[#2563eb]">CRM FindFit</p>
            {companyName?.trim() && (
              <p className="text-[10px] text-[#475569] text-center leading-tight mt-0.5">{companyName.trim()}</p>
            )}
          </div>
          <nav className="flex flex-col gap-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    isActive
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Strumenti dropdown — visibile se almeno una feature tra analisi, template e comunicazioni è attiva */}
            {strumentiVisible && (
            <div className="mt-1">
              <button
                onClick={() => setStrumentiOpen(!strumentiOpen)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]"
              >
                <span className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 shrink-0" />
                  <span>Strumenti</span>
                </span>
                {strumentiOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {strumentiOpen && (
                <div className="mt-1 space-y-1">
                  {(!enabledFeatures || enabledFeatures.analisi === true) && (
                  <Link
                    href="/analisi"
                    onClick={onClose}
                    className={cn(
                      "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                      pathname === "/analisi" || pathname.startsWith("/analisi/")
                        ? "bg-[#dbeafe] text-[#1e293b]"
                        : "text-[#475569]"
                    )}
                  >
                    <BarChart3 className="h-5 w-5 shrink-0" />
                    <span>Nuova Analisi</span>
                  </Link>
                  )}
                  {(!enabledFeatures || enabledFeatures.analisi === true) && (
                  <Link
                    href="/analisi-salvate"
                    onClick={onClose}
                    className={cn(
                      "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                      pathname === "/analisi-salvate" || pathname.startsWith("/analisi-salvate/")
                        ? "bg-[#dbeafe] text-[#1e293b]"
                        : "text-[#475569]"
                    )}
                  >
                    <History className="h-5 w-5 shrink-0" />
                    <span>Analisi Salvate</span>
                  </Link>
                  )}
                  {(!enabledFeatures || enabledFeatures.template === true) && (
                  <Link
                    href="/template-nuovo"
                    onClick={onClose}
                    className={cn(
                      "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                      pathname === "/template-nuovo" || pathname.startsWith("/template-nuovo/")
                        ? "bg-[#dbeafe] text-[#1e293b]"
                        : "text-[#475569]"
                    )}
                  >
                    <FileText className="h-5 w-5 shrink-0" />
                    <span>Nuovo Template</span>
                  </Link>
                  )}
                  {(!enabledFeatures || enabledFeatures.template === true) && (
                  <Link
                    href="/template-salvati"
                    onClick={onClose}
                    className={cn(
                      "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                      pathname === "/template-salvati" || pathname.startsWith("/template-salvati/")
                        ? "bg-[#dbeafe] text-[#1e293b]"
                        : "text-[#475569]"
                    )}
                  >
                    <FileText className="h-5 w-5 shrink-0" />
                    <span>Template Salvati</span>
                  </Link>
                  )}
                  {(!enabledFeatures || enabledFeatures.comunicazioni === true) && (
                  <Link
                    href="/comunicazioni"
                    onClick={onClose}
                    className={cn(
                      "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                      pathname === "/comunicazioni" || pathname.startsWith("/comunicazioni/")
                        ? "bg-[#dbeafe] text-[#1e293b]"
                        : "text-[#475569]"
                    )}
                  >
                    <MailIcon className="h-5 w-5 shrink-0" />
                    <span>Comunicazioni</span>
                  </Link>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Impostazioni dropdown — visibile se feature "impostazioni" attiva */}
            {(!enabledFeatures || enabledFeatures.impostazioni === true) && (
              <div className="mt-1">
                <button
                  onClick={() => setImpostazioniOpen(!impostazioniOpen)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]"
                >
                  <span className="flex items-center gap-3">
                    <Settings className="h-5 w-5 shrink-0" />
                    <span>Impostazioni</span>
                  </span>
                  {impostazioniOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                {impostazioniOpen && (
                  <div className="mt-1 space-y-1">
                    <Link
                      href="/impostazioni/generali"
                      onClick={onClose}
                      className={cn(
                        "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                        pathname === "/impostazioni/generali" || pathname.startsWith("/impostazioni/generali/")
                          ? "bg-[#dbeafe] text-[#1e293b]"
                          : "text-[#475569]"
                      )}
                    >
                      <Settings className="h-5 w-5 shrink-0" />
                      <span>Generali</span>
                    </Link>
                    <Link
                      href="/impostazioni/utente"
                      onClick={onClose}
                      className={cn(
                        "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                        pathname === "/impostazioni/utente" || pathname.startsWith("/impostazioni/utente/")
                          ? "bg-[#dbeafe] text-[#1e293b]"
                          : "text-[#475569]"
                      )}
                    >
                      <User className="h-5 w-5 shrink-0" />
                      <span>Utente</span>
                    </Link>
                    <Link
                      href="/impostazioni/azienda"
                      onClick={onClose}
                      className={cn(
                        "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                        pathname === "/impostazioni/azienda" || pathname.startsWith("/impostazioni/azienda/")
                          ? "bg-[#dbeafe] text-[#1e293b]"
                          : "text-[#475569]"
                      )}
                    >
                      <Building2 className="h-5 w-5 shrink-0" />
                      <span>Azienda</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Admin section — visibile se impostazioni è true oppure qualche admin feature è true */}
            {user?.role === "admin" && (
              !enabledFeatures ||
              enabledFeatures.impostazioni === true ||
              (featuresAdmin && Object.values(featuresAdmin).some(v => v === true))
            ) && (
              <div className="hidden lg:block">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className="mt-4 mb-1 px-3 flex items-center justify-between w-full text-xs font-semibold uppercase text-[#475569] hover:text-[#1e293b] transition-colors"
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
                {isAdminLinkEnabled("/admin/users") && (
                <Link
                  href="/admin/users"
                  onClick={onClose}
                  className={cn(
                    "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    pathname === "/admin/users"
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <Shield className="h-5 w-5 shrink-0" />
                  <span>Gestione Utenti</span>
                </Link>
                )}
                {isAdminLinkEnabled("/admin/imap") && (
                <Link
                  href="/admin/imap"
                  onClick={onClose}
                  className={cn(
                    "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    pathname === "/admin/imap"
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <Server className="h-5 w-5 shrink-0" />
                  <span>Configurazione Email</span>
                </Link>
                )}
                {isAdminLinkEnabled("/admin/auto-reply") && (
                <Link
                  href="/admin/auto-reply"
                  onClick={onClose}
                  className={cn(
                    "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    pathname === "/admin/auto-reply"
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <MailIcon className="h-5 w-5 shrink-0" />
                  <span>Risposta automatica</span>
                </Link>
                )}
                {isAdminLinkEnabled("/test-email") && (
                <Link
                  href="/test-email"
                  onClick={onClose}
                  className={cn(
                    "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    pathname === "/test-email"
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <Download className="h-5 w-5 shrink-0" />
                  <span>Recupero email</span>
                </Link>
                )}
                {isAdminLinkEnabled("/admin/facebook-post") && (
                <Link
                  href="/admin/facebook-post"
                  onClick={onClose}
                  className={cn(
                    "ml-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#dbeafe] hover:text-[#1e293b]",
                    pathname === "/admin/facebook-post"
                      ? "bg-[#dbeafe] text-[#1e293b]"
                      : "text-[#475569]"
                  )}
                >
                  <Facebook className="h-5 w-5 shrink-0" />
                  <span>Facebook Post</span>
                </Link>
                )}
              </>
            )}
              </div>
            )}
          </nav>
        </div>

        <div className="border-t border-[#e2e8f0] p-4 space-y-2">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1e293b] truncate">{user.name}</p>
                <p className="text-xs text-[#475569] capitalize">{user.role}</p>
                {APP_VERSION_LABEL && (
                  <p className="text-[10px] text-[#475569] italic mt-0.5">{APP_VERSION_LABEL}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="text-[#475569] hover:text-[#1e293b]" onClick={handleLogout} title="Esci">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

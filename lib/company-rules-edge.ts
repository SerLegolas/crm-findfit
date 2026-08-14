/**
 * Edge-compatible utility per leggere le regole azienda.
 * Usa @libsql/client che funziona nell'Edge Runtime di Next.js.
 */
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export interface CompanyRuleData {
  features: Record<string, boolean> | null;
  maxUsers: number;
  maxClients: number;
  maxTasks: number;
}

/**
 * Mappa: route path → feature key
 */
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  // /dashboard non è qui perché è sempre accessibile
  // /admin non è qui: la visibilità è gestita dalla sidebar (featuresAdmin) e le API danno 403
  "/clienti": "clienti",
  "/kanban": "kanban",
  "/task": "task",
  "/note": "note",
  "/impostazioni": "impostazioni",
  "/comunicazioni": "comunicazioni",
  "/template-nuovo": "template",
  "/template-salvati": "template",
  "/template-anteprima": "template",
  "/analisi": "analisi",
  "/analisi-salvate": "analisi",
};

/**
 * Legge le regole per una company (edge-safe).
 */
export async function getCompanyRules(
  companyId: string
): Promise<CompanyRuleData | null> {
  try {
    const result = await client.execute({
      sql: "SELECT max_users, max_clients, max_tasks, features FROM company_rules WHERE company_id = ?",
      args: [companyId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    let features: Record<string, boolean> | null = null;
    try {
      features = JSON.parse(row.features as string);
    } catch {
      features = {};
    }

    return {
      maxUsers: Number(row.max_users) || 0,
      maxClients: Number(row.max_clients) || 0,
      maxTasks: Number(row.max_tasks) || 0,
      features,
    };
  } catch (e) {
    console.error("[company-rules-edge] Errore lettura regole:", e);
    return null;
  }
}

/**
 * Verifica se una feature è abilitata per una company (edge-safe).
 * Restituisce true se abilitata o se non ci sono regole.
 */
export async function isFeatureEnabled(
  companyId: string,
  featureKey: string
): Promise<boolean> {
  const rules = await getCompanyRules(companyId);
  // Nessuna regola → tutto permesso
  if (!rules || !rules.features) return true;
  // Se l'oggetto features è vuoto, tutto permesso
  if (Object.keys(rules.features).length === 0) return true;
  // Opt-in: abilitata solo se esplicitamente true
  return rules.features[featureKey] === true;
}

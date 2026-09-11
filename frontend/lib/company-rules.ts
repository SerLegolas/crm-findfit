import { db } from "@/lib/db";
import { companyRules, users, clients, tasks } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export type FeatureMap = Record<string, boolean>;

interface Rules {
  maxUsers: number;
  maxClients: number;
  maxTasks: number;
  features: FeatureMap;
  featuresAdmin: FeatureMap;
}

async function getRules(companyId: string): Promise<Rules | null> {
  const [rule] = await db
    .select()
    .from(companyRules)
    .where(eq(companyRules.companyId, companyId))
    .limit(1);

  if (!rule) return null;

  return {
    maxUsers: rule.maxUsers,
    maxClients: rule.maxClients,
    maxTasks: rule.maxTasks,
    features: (rule.features ?? {}) as FeatureMap,
    featuresAdmin: (rule.featuresAdmin ?? {}) as FeatureMap,
  };
}

export async function checkMaxUsers(companyId: string): Promise<void> {
  const rules = await getRules(companyId);
  if (!rules || rules.maxUsers === 0) return; // 0 = illimitato

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.companyId, companyId));

  const currentCount = Number(result?.count || 0);
  if (currentCount >= rules.maxUsers) {
    throw new MaxLimitError(
      `Limite massimo raggiunto (${rules.maxUsers} utenti).`
    );
  }
}

export async function checkMaxClients(companyId: string): Promise<void> {
  const rules = await getRules(companyId);
  if (!rules || rules.maxClients === 0) return;

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(eq(clients.companyId, companyId));

  const currentCount = Number(result?.count || 0);
  if (currentCount >= rules.maxClients) {
    throw new MaxLimitError(
      `Limite massimo raggiunto (${rules.maxClients} clienti).`
    );
  }
}

export async function checkMaxTasks(companyId: string): Promise<void> {
  const rules = await getRules(companyId);
  if (!rules || rules.maxTasks === 0) return;

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.companyId, companyId));

  const currentCount = Number(result?.count || 0);
  if (currentCount >= rules.maxTasks) {
    throw new MaxLimitError(
      `Limite massimo raggiunto (${rules.maxTasks} task).`
    );
  }
}

/**
 * Verifica che una funzionalità sia abilitata per la company (modello opt-in).
 * Lancia FeatureDisabledError se disabilitata o non esplicitamente true.
 */
export async function checkFeatureEnabled(
  companyId: string,
  featureKey: string
): Promise<void> {
  const rules = await getRules(companyId);
  if (!rules) return; // nessuna regola = tutto permesso

  const features = rules.features ?? {};
  // Se non ci sono features definite, tutto permesso
  if (Object.keys(features).length === 0) return;

  // Opt-in: abilitata SOLO se esplicitamente true
  if (features[featureKey] !== true) {
    throw new FeatureDisabledError(
      `Funzionalità "${featureKey}" non abilitata per questa azienda. Contatta il super admin.`
    );
  }
}

/**
 * Verifica che una funzionalità admin sia abilitata per la company (modello opt-in).
 * Usa il campo featuresAdmin della tabella company_rules.
 */
export async function checkAdminFeatureEnabled(
  companyId: string,
  featureKey: string
): Promise<void> {
  const rules = await getRules(companyId);
  if (!rules) return;

  const featAdmin = rules.featuresAdmin ?? {};
  if (Object.keys(featAdmin).length === 0) return; // nessuna regola admin = permesso

  if (featAdmin[featureKey] !== true) {
    throw new FeatureDisabledError(
      `Funzionalità admin "${featureKey}" non abilitata per questa azienda. Contatta il super admin.`
    );
  }
}

export class MaxLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaxLimitError";
  }
}

export class FeatureDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureDisabledError";
  }
}

import { useState, useEffect, useCallback } from 'react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  fishermen,
  purchaseEntries,
  payments,
  type Fisherman,
  type NewFisherman,
} from '../db/schema';

// ── Types ──────────────────────────────────────────────────────
export interface FishermanWithBalance extends Fisherman {
  totalPurchases: number;
  totalPaid:      number;
  balance:        number;
}

// ── Hook ───────────────────────────────────────────────────────
export function useFishermen() {
  const [fishermanList, setFishermanList] = useState<FishermanWithBalance[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const fetchFishermen = useCallback(async () => {
    try {
      setLoading(true);

      // Get all fishermen
      const rows = await db
        .select()
        .from(fishermen)
        .orderBy(desc(fishermen.createdAt));

      // For each fisherman calculate balance
      const withBalances: FishermanWithBalance[] = await Promise.all(
        rows.map(async (f) => {
          // Sum of all purchase entry totals
          const purchaseResult = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(purchaseEntries)
            .where(eq(purchaseEntries.fishermenId, f.id));

          // Sum of all payments made to this fisherman
          const paymentResult = await db
            .select({ total: sql<number>`COALESCE(SUM(p.amount), 0)` })
            .from(payments)
            .innerJoin(
              purchaseEntries,
              eq(purchaseEntries.id, payments.referenceId)
            )
            .where(
              sql`${payments.referenceType} = 'purchase' AND ${purchaseEntries.fishermenId} = ${f.id}`
            );

          const totalPurchases = purchaseResult[0]?.total ?? 0;
          const totalPaid      = paymentResult[0]?.total  ?? 0;

          return {
            ...f,
            totalPurchases,
            totalPaid,
            balance: totalPurchases - totalPaid,
          };
        })
      );

      setFishermanList(withBalances);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFishermen();
  }, [fetchFishermen]);

  // ── Add ──
const addFisherman = useCallback(
  async (data: Omit<NewFisherman, 'id' | 'createdAt'>) => {
    await db.insert(fishermen).values({
      ...data,
      createdAt: new Date().toISOString(),
    });
    // Don't call fetchFishermen here — the list screen
    // will refetch via useFocusEffect when we goBack()
  },
  []
);

// ── Update ──
const updateFisherman = useCallback(
  async (id: number, data: Partial<Omit<NewFisherman, 'id' | 'createdAt'>>) => {
    await db.update(fishermen).set(data).where(eq(fishermen.id, id));
  },
  []
);

// ── Delete ──
const deleteFisherman = useCallback(
  async (id: number) => {
    await db.delete(fishermen).where(eq(fishermen.id, id));
    await fetchFishermen(); // Keep this — delete stays on same screen
  },
  [fetchFishermen]
);

  // ── Get single ──
  const getFisherman = useCallback(async (id: number): Promise<Fisherman | null> => {
    const rows = await db
      .select()
      .from(fishermen)
      .where(eq(fishermen.id, id))
      .limit(1);
    return rows[0] ?? null;
  }, []);

  return {
    fishermanList,
    loading,
    error,
    refetch: fetchFishermen,
    addFisherman,
    updateFisherman,
    deleteFisherman,
    getFisherman,
  };
}
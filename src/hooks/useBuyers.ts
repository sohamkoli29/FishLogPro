import { useCallback } from 'react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  buyers,
  salesOrders,
  payments,
  type Buyer,
  type NewBuyer,
} from '../db/schema';

export interface BuyerWithBalance extends Buyer {
  totalSales:  number;
  totalPaid:   number;
  balance:     number;
}

export function useBuyers() {

  // ── Get single buyer ──
  const getBuyer = useCallback(async (id: number): Promise<Buyer | null> => {
    const rows = await db
      .select()
      .from(buyers)
      .where(eq(buyers.id, id))
      .limit(1);
    return rows[0] ?? null;
  }, []);

  // ── Add ──
  const addBuyer = useCallback(
    async (data: Omit<NewBuyer, 'id' | 'createdAt'>) => {
      await db.insert(buyers).values({
        ...data,
        createdAt: new Date().toISOString(),
      });
    },
    []
  );

  // ── Update ──
  const updateBuyer = useCallback(
    async (id: number, data: Partial<Omit<NewBuyer, 'id' | 'createdAt'>>) => {
      await db.update(buyers).set(data).where(eq(buyers.id, id));
    },
    []
  );

  // ── Delete ──
  const deleteBuyer = useCallback(async (id: number) => {
    await db.delete(buyers).where(eq(buyers.id, id));
  }, []);

  return { getBuyer, addBuyer, updateBuyer, deleteBuyer };
}
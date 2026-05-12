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
    // Step 1: get all sales order IDs for this buyer
    const orders = await db
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .where(eq(salesOrders.buyerId, id));

    // Step 2: delete payments linked to each sales order
    for (const order of orders) {
      await db
        .delete(payments)
        .where(
          sql`${payments.referenceType} = 'sale'
              AND ${payments.referenceId} = ${order.id}`
        );
    }

    // Step 3: delete buyer (cascades sales_orders + sales_items)
    await db.delete(buyers).where(eq(buyers.id, id));
  }, []);

  return { getBuyer, addBuyer, updateBuyer, deleteBuyer };
}
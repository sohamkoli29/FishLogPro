import { useCallback } from 'react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  purchaseEntries,
  purchaseItems,
  fishermen,
  payments,
  type PurchaseEntry,
  type PurchaseItem,
  type NewPurchaseEntry,
  type NewPurchaseItem,
} from '../db/schema';

// ── Extended types ─────────────────────────────────────────────
export interface PurchaseEntryWithItems extends Omit<PurchaseEntry, 'notes'> {
  fishermanName: string;
  fishermanBoat: string;
  notes:         string | null;
  items:         PurchaseItem[];
  totalPaid:     number;
  balance:       number;
}

export interface PurchaseItemInput {
  fishName:     string;
  quantity:     number;
  unit:         'kg' | 'lbs' | 'pcs' | 'crate';
  pricePerUnit: number;
}

// ── Hook ───────────────────────────────────────────────────────
export function usePurchases() {

  // ── Get all entries for a fisherman ──
  const getEntriesForFisherman = useCallback(
    async (fishermenId: number): Promise<PurchaseEntryWithItems[]> => {
      const entries = await db
        .select({
          id:            purchaseEntries.id,
          fishermenId:   purchaseEntries.fishermenId,
          date:          purchaseEntries.date,
          notes:         purchaseEntries.notes,
          totalAmount:   purchaseEntries.totalAmount,
          createdAt:     purchaseEntries.createdAt,
          fishermanName: fishermen.name,
          fishermanBoat: fishermen.boatName,
        })
        .from(purchaseEntries)
        .innerJoin(fishermen, eq(fishermen.id, purchaseEntries.fishermenId))
        .where(eq(purchaseEntries.fishermenId, fishermenId))
        .orderBy(desc(purchaseEntries.date));

      const result: PurchaseEntryWithItems[] = await Promise.all(
        entries.map(async (entry) => {
          const items = await db
            .select()
            .from(purchaseItems)
            .where(eq(purchaseItems.entryId, entry.id));

          const [paymentRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
            .from(payments)
            .where(
              sql`${payments.referenceType} = 'purchase'
                  AND ${payments.referenceId} = ${entry.id}`
            );

          const totalPaid = Number(paymentRes?.total ?? 0);

          return {
            ...entry,
            notes: entry.notes ?? null,
            items,
            totalPaid,
            balance: entry.totalAmount - totalPaid,
          };
        })
      );

      return result;
    },
    []
  );

  // ── Get single entry ──
  const getEntry = useCallback(
    async (entryId: number): Promise<PurchaseEntryWithItems | null> => {
      const rows = await db
        .select({
          id:            purchaseEntries.id,
          fishermenId:   purchaseEntries.fishermenId,
          date:          purchaseEntries.date,
          notes:         purchaseEntries.notes,
          totalAmount:   purchaseEntries.totalAmount,
          createdAt:     purchaseEntries.createdAt,
          fishermanName: fishermen.name,
          fishermanBoat: fishermen.boatName,
        })
        .from(purchaseEntries)
        .innerJoin(fishermen, eq(fishermen.id, purchaseEntries.fishermenId))
        .where(eq(purchaseEntries.id, entryId))
        .limit(1);

      if (!rows[0]) return null;

      const entry = rows[0];

      const items = await db
        .select()
        .from(purchaseItems)
        .where(eq(purchaseItems.entryId, entry.id));

      const [paymentRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(
          sql`${payments.referenceType} = 'purchase'
              AND ${payments.referenceId} = ${entry.id}`
        );

      const totalPaid = Number(paymentRes?.total ?? 0);

      return {
        ...entry,
        notes: entry.notes ?? null,
        items,
        totalPaid,
        balance: entry.totalAmount - totalPaid,
      };
    },
    []
  );

  // ── Create entry with items (single transaction) ──
  const createEntry = useCallback(
    async (
      fishermenId: number,
      date: string,
      items: PurchaseItemInput[],
      notes?: string
    ): Promise<number> => {
      // Calculate total
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.pricePerUnit,
        0
      );

      // Insert entry
      const result = await db
        .insert(purchaseEntries)
        .values({
          fishermenId,
          date,
          notes,
          totalAmount,
          createdAt: new Date().toISOString(),
        })
        .returning({ id: purchaseEntries.id });

      const entryId = result[0].id;

      // Insert all items
      await db.insert(purchaseItems).values(
        items.map((item) => ({
          entryId,
          fishName:     item.fishName,
          quantity:     item.quantity,
          unit:         item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice:   item.quantity * item.pricePerUnit,
        }))
      );

      return entryId;
    },
    []
  );

  // ── Delete entry (cascade deletes items) ──
  const deleteEntry = useCallback(async (entryId: number): Promise<void> => {
    await db.delete(purchaseItems).where(eq(purchaseItems.entryId, entryId));
    await db.delete(purchaseEntries).where(eq(purchaseEntries.id, entryId));
  }, []);

  return {
    getEntriesForFisherman,
    getEntry,
    createEntry,
    deleteEntry,
  };
}
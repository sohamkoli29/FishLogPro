import { useCallback } from 'react';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import {
  payments,
  purchaseEntries,
  salesOrders,
  type Payment,
  type NewPayment,
} from '../db/schema';

export type PaymentMode = 'cash' | 'bank' | 'upi' | 'cheque' | 'other';

export interface PaymentInput {
  amount:      number;
  mode:        PaymentMode;
  paymentDate: string;
  notes?:      string;
}

export function usePayments() {

  // ── Get payments for a purchase entry ──
  const getPaymentsForPurchase = useCallback(
    async (entryId: number): Promise<Payment[]> => {
      return db
        .select()
        .from(payments)
        .where(
          sql`${payments.referenceType} = 'purchase'
              AND ${payments.referenceId} = ${entryId}`
        )
        .orderBy(desc(payments.paymentDate));
    },
    []
  );

  // ── Get payments for a sales order ──
  const getPaymentsForSale = useCallback(
    async (orderId: number): Promise<Payment[]> => {
      return db
        .select()
        .from(payments)
        .where(
          sql`${payments.referenceType} = 'sale'
              AND ${payments.referenceId} = ${orderId}`
        )
        .orderBy(desc(payments.paymentDate));
    },
    []
  );

  // ── Record a payment ──
  const recordPayment = useCallback(
    async (
      referenceType: 'purchase' | 'sale',
      referenceId:   number,
      input:         PaymentInput
    ): Promise<void> => {
      await db.insert(payments).values({
        referenceType,
        referenceId,
        amount:      input.amount,
        mode:        input.mode,
        paymentDate: input.paymentDate,
        notes:       input.notes,
      });
    },
    []
  );

  // ── Delete a payment ──
  const deletePayment = useCallback(async (paymentId: number): Promise<void> => {
    await db.delete(payments).where(eq(payments.id, paymentId));
  }, []);

  // ── Get total paid for a reference ──
  const getTotalPaid = useCallback(
    async (
      referenceType: 'purchase' | 'sale',
      referenceId:   number
    ): Promise<number> => {
      const [res] = await db
        .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(
          sql`${payments.referenceType} = ${referenceType}
              AND ${payments.referenceId} = ${referenceId}`
        );
      return Number(res?.total ?? 0);
    },
    []
  );

  return {
    getPaymentsForPurchase,
    getPaymentsForSale,
    recordPayment,
    deletePayment,
    getTotalPaid,
  };
}
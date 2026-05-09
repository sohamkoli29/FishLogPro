import { useCallback } from 'react';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  salesOrders,
  salesItems,
  buyers,
  payments,
  type SalesOrder,
  type SalesItem,
  type NewSalesOrder,
  type NewSalesItem,
} from '../db/schema';

// ── Types ──────────────────────────────────────────────────────
export interface SalesOrderWithItems extends SalesOrder {
  buyerName: string;
  items:     SalesItem[];
  totalPaid: number;
  balance:   number;
}

export interface SalesItemInput {
  fishName:     string;
  quantity:     number;
  unit:         'kg' | 'lbs' | 'pcs' | 'crate';
  pricePerUnit: number;
}

export type OrderStatus = 'pending' | 'partial' | 'complete';

// ── Hook ───────────────────────────────────────────────────────
export function useSales() {

  // ── Get all orders for a buyer ──
  const getOrdersForBuyer = useCallback(
    async (buyerId: number): Promise<SalesOrderWithItems[]> => {
      const orders = await db
        .select({
          id:          salesOrders.id,
          buyerId:     salesOrders.buyerId,
          date:        salesOrders.date,
          status:      salesOrders.status,
          totalAmount: salesOrders.totalAmount,
          createdAt:   salesOrders.createdAt,
          buyerName:   buyers.name,
        })
        .from(salesOrders)
        .innerJoin(buyers, eq(buyers.id, salesOrders.buyerId))
        .where(eq(salesOrders.buyerId, buyerId))
        .orderBy(desc(salesOrders.date));

      const result: SalesOrderWithItems[] = await Promise.all(
        orders.map(async (order) => {
          const items = await db
            .select()
            .from(salesItems)
            .where(eq(salesItems.orderId, order.id));

          const [paymentRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
            .from(payments)
            .where(
              sql`${payments.referenceType} = 'sale'
                  AND ${payments.referenceId} = ${order.id}`
            );

          const totalPaid = Number(paymentRes?.total ?? 0);

          return {
            ...order,
            items,
            totalPaid,
            balance: order.totalAmount - totalPaid,
          };
        })
      );

      return result;
    },
    []
  );

  // ── Get single order ──
  const getOrder = useCallback(
    async (orderId: number): Promise<SalesOrderWithItems | null> => {
      const rows = await db
        .select({
          id:          salesOrders.id,
          buyerId:     salesOrders.buyerId,
          date:        salesOrders.date,
          status:      salesOrders.status,
          totalAmount: salesOrders.totalAmount,
          createdAt:   salesOrders.createdAt,
          buyerName:   buyers.name,
        })
        .from(salesOrders)
        .innerJoin(buyers, eq(buyers.id, salesOrders.buyerId))
        .where(eq(salesOrders.id, orderId))
        .limit(1);

      if (!rows[0]) return null;

      const order = rows[0];

      const items = await db
        .select()
        .from(salesItems)
        .where(eq(salesItems.orderId, order.id));

      const [paymentRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(
          sql`${payments.referenceType} = 'sale'
              AND ${payments.referenceId} = ${order.id}`
        );

      const totalPaid = Number(paymentRes?.total ?? 0);

      return {
        ...order,
        items,
        totalPaid,
        balance: order.totalAmount - totalPaid,
      };
    },
    []
  );

  // ── Create order with items ──
  const createOrder = useCallback(
    async (
      buyerId:  number,
      date:     string,
      status:   OrderStatus,
      items:    SalesItemInput[],
    ): Promise<number> => {
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.pricePerUnit,
        0
      );

      const result = await db
        .insert(salesOrders)
        .values({
          buyerId,
          date,
          status,
          totalAmount,
          createdAt: new Date().toISOString(),
        })
        .returning({ id: salesOrders.id });

      const orderId = result[0].id;

      await db.insert(salesItems).values(
        items.map((item) => ({
          orderId,
          fishName:     item.fishName,
          quantity:     item.quantity,
          unit:         item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice:   item.quantity * item.pricePerUnit,
        }))
      );

      return orderId;
    },
    []
  );

  // ── Update order status ──
  const updateOrderStatus = useCallback(
    async (orderId: number, status: OrderStatus): Promise<void> => {
      await db
        .update(salesOrders)
        .set({ status })
        .where(eq(salesOrders.id, orderId));
    },
    []
  );

  // ── Delete order ──
  const deleteOrder = useCallback(async (orderId: number): Promise<void> => {
    await db.delete(salesItems).where(eq(salesItems.orderId, orderId));
    await db.delete(salesOrders).where(eq(salesOrders.id, orderId));
  }, []);

  return {
    getOrdersForBuyer,
    getOrder,
    createOrder,
    updateOrderStatus,
    deleteOrder,
  };
}
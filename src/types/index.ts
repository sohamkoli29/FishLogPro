// ── Entities ──────────────────────────────────────────────────
export interface Fisherman {
  id: number;
  name: string;
  boatName: string;
  phone?: string;
  createdAt: string;
}

export interface PurchaseEntry {
  id: number;
  fishermenId: number;
  date: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
  fishermanName?: string;
  fishermanBoat?: string;
}

export interface PurchaseItem {
  id: number;
  entryId: number;
  fishName: string;
  quantity: number;
  unit: 'kg' | 'lbs' | 'pcs' | 'crate';
  pricePerUnit: number;
  totalPrice: number;
}

export interface Buyer {
  id: number;
  name: string;
  type: 'supplier' | 'company' | 'other';
  phone?: string;
  createdAt: string;
}

export interface SalesOrder {
  id: number;
  buyerId: number;
  date: string;
  status: 'pending' | 'partial' | 'complete';
  totalAmount: number;
  createdAt: string;
  buyerName?: string;
}

export interface SalesItem {
  id: number;
  orderId: number;
  fishName: string;
  quantity: number;
  unit: 'kg' | 'lbs' | 'pcs' | 'crate';
  pricePerUnit: number;
  totalPrice: number;
  sourceEntryId?: number;
}

export interface Payment {
  id: number;
  referenceType: 'purchase' | 'sale';
  referenceId: number;
  amount: number;
  mode: 'cash' | 'bank' | 'upi' | 'cheque' | 'other';
  paymentDate: string;
  notes?: string;
}

export interface FishName {
  id: number;
  name: string;
}

// ── Navigation ──────────────────────────────────────────────────
export type RootStackParamList = {
  MainTabs: undefined;
  NewPurchaseEntry: { fishermenId?: number };
  EntryDetail: { entryId: number };
  NewSalesOrder: { buyerId?: number };
  OrderDetail: { orderId: number };
  PaymentsScreen: {
    referenceType: 'purchase' | 'sale';
    referenceId: number;
    name: string;
  };
  StatementScreen: { type: 'fisherman' | 'buyer'; id: number; name: string };
  BackupRestore: undefined;
  Settings: undefined;
  AddFisherman: { fishermenId?: number };
  AddBuyer: { buyerId?: number };
};

export type TabParamList = {
  Home: undefined;
  Fishermen: undefined;
  Buyers: undefined;
  Register: undefined;
  SettingsTab: undefined;
};
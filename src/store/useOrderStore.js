import { create } from "zustand";
import { persist } from "zustand/middleware";

const useOrderStore = create(
  persist(
    (set, get) => ({
      orders: [],

      addOrder: (order) =>
        set((state) => ({
          orders: [...state.orders, { ...order, status: "Completed", customer: "", payment: "Cash" }],
        })),

      updateOrderStatus: (receiptNo, status) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.receiptNo === receiptNo ? { ...o, status } : o
          ),
        })),

      returnOrder: (receiptNo) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.receiptNo === receiptNo ? { ...o, status: "Cancelled" } : o
          ),
        })),

      getTodayOrders: () => {
        const today = new Date().toDateString();
        return get().orders.filter(
          (o) => new Date(o.createdAt).toDateString() === today
        );
      },

      getYesterdayOrders: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return get().orders.filter(
          (o) => new Date(o.createdAt).toDateString() === yesterday.toDateString()
        );
      },
    }),
    { name: "dpos-orders" }
  )
);

export default useOrderStore;
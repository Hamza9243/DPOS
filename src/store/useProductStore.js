import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products as initialProducts, categories as initialCategories } from "../data/products";

const useProductStore = create(
  persist(
    (set) => ({
      products: initialProducts.map((p) => ({ ...p, costPrice: 0, stock: 0, image: "" })),
      categories: initialCategories,

      addProduct: (product) =>
        set((state) => ({ products: [...state.products, product] })),

      updateProduct: (id, updated) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...updated } : p)),
        })),

      deleteProduct: (id) =>
        set((state) => ({ products: state.products.filter((p) => p.id !== id) })),

      addCategory: (name) =>
        set((state) => ({
          categories: [...state.categories, { id: Date.now(), name }],
        })),

      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),
    }),
    { name: "dpos-products" }
  )
);

export default useProductStore; 
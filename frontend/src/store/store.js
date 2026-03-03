import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cart store
export const useCartStore = create(
  persist(
    (set, get) => ({
      cart: [],
      tableNumber: null,
      
      setTableNumber: (tableNumber) => set({ tableNumber }),
      
      addToCart: (item, halfFull = null) => {
        const { cart } = get()
        const existingIndex = cart.findIndex(
          (cartItem) => 
            cartItem.id === item.id && 
            cartItem.halfFull === halfFull
        )
        
        if (existingIndex >= 0) {
          const updatedCart = [...cart]
          updatedCart[existingIndex].quantity += 1
          set({ cart: updatedCart })
        } else {
          set({ 
            cart: [...cart, { 
              ...item, 
              halfFull, 
              quantity: 1 
            }] 
          })
        }
      },
      
      removeFromCart: (itemId, halfFull = null) => {
        const { cart } = get()
        set({ 
          cart: cart.filter(
            (item) => !(item.id === itemId && item.halfFull === halfFull)
          ) 
        })
      },
      
      updateQuantity: (itemId, halfFull = null, quantity) => {
        const { cart } = get()
        if (quantity <= 0) {
          set({ 
            cart: cart.filter(
              (item) => !(item.id === itemId && item.halfFull === halfFull)
            ) 
          })
        } else {
          const updatedCart = cart.map((item) =>
            item.id === itemId && item.halfFull === halfFull
              ? { ...item, quantity }
              : item
          )
          set({ cart: updatedCart })
        }
      },

      updateDrinkType: (itemId, halfFull = null, drinkType = 'hot') => {
        const { cart } = get()
        const updatedCart = cart.map((item) =>
          item.id === itemId && item.halfFull === halfFull
            ? { ...item, drinkType }
            : item
        )
        set({ cart: updatedCart })
      },

      updateComboDrink: (itemId, halfFull = null, linkedDrinkItemId = null, linkedDrinkName = null) => {
        const { cart } = get()
        const updatedCart = cart.map((item) =>
          item.id === itemId && item.halfFull === halfFull
            ? {
                ...item,
                linkedDrinkItemId,
                linkedDrinkName,
                drinkTemp: linkedDrinkItemId ? (item.drinkTemp || 'hot') : null,
              }
            : item
        )
        set({ cart: updatedCart })
      },

      updateComboDrinkTemp: (itemId, halfFull = null, drinkTemp = 'hot') => {
        const { cart } = get()
        const updatedCart = cart.map((item) =>
          item.id === itemId && item.halfFull === halfFull
            ? { ...item, drinkTemp }
            : item
        )
        set({ cart: updatedCart })
      },
      
      clearCart: () => set({ cart: [] }),
      
      getTotal: () => {
        const { cart } = get()
        return cart.reduce((total, item) => {
          const icedSurcharge = item.isCombo && item.linkedDrinkItemId && item.drinkTemp === 'iced' ? 3 : 0
          return total + ((item.price + icedSurcharge) * item.quantity)
        }, 0)
      },
      
      getItemCount: () => {
        const { cart } = get()
        return cart.reduce((count, item) => count + item.quantity, 0)
      }
    }),
    {
      name: 'delicacy-cart',
      partialize: (state) => ({ cart: state.cart, tableNumber: state.tableNumber })
    }
  )
)

// Order store
export const useOrderStore = create((set) => ({
  currentOrder: null,
  orderHistory: [],
  
  setCurrentOrder: (order) => set({ currentOrder: order }),
  addToHistory: (order) => set((state) => ({ 
    orderHistory: [order, ...state.orderHistory] 
  })),
  clearCurrentOrder: () => set({ currentOrder: null })
}))

// Theme store
export const useThemeStore = create(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (value) => set({ darkMode: value }),
      resetDarkMode: () => {
        // Reset to light mode and clear localStorage
        localStorage.removeItem('delicacy-theme')
        set({ darkMode: false })
      }
    }),
    {
      name: 'delicacy-theme'
    }
  )
)

// Toast notifications store
export const useToastStore = create((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = Date.now()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }))
    
    // Auto remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }))
    }, toast.duration || 3000)
  },
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}))

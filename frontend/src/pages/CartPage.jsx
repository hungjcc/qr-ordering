import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, Minus, ArrowLeft, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../store'

export default function CartPage() {
  const { tableNumber } = useParams()
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, getTotal, getTax, getGrandTotal, clearCart, tableNumber: cartTableNumber } = useCartStore()
  const [isClearing, setIsClearing] = useState(false)
  
  const taxPercentage = 5
  const subtotal = getTotal()
  const tax = getTax(taxPercentage)
  const grandTotal = getGrandTotal(taxPercentage)
  
  const prefix = tableNumber ? `/table/${tableNumber}` : ''
  
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold mb-2 dark:text-white">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add some delicious items to get started!</p>
          <Link to={prefix || '/'} className="btn-primary">
            Browse Menu
          </Link>
        </motion.div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to={prefix || '/'}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
                >
                  <ArrowLeft className="w-5 h-5 dark:text-white" />
                </motion.button>
              </Link>
              <h1 className="text-xl font-bold dark:text-white">Your Cart</h1>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsClearing(true)}
              className="text-red-500 text-sm font-medium"
            >
              Clear All
            </motion.button>
          </div>
        </div>
      </div>
      
      {/* Cart Items */}
      <div className="max-w-4xl mx-auto px-4 py-4 pb-36">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.div
              key={`${item.id}-${item.size}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="card p-4 mb-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    {item.size === 'half' ? 'Half' : 'Full'} • ${item.price} each
                  </p>
                  {item.prep_time_minutes && (
                    <p className="text-xs text-gray-400 mt-1">
                      ~{item.prep_time_minutes} mins
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-gray-600"
                    >
                      <Minus className="w-4 h-4 dark:text-white" />
                    </button>
                    <span className="w-6 text-center font-medium dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-gray-600"
                    >
                      <Plus className="w-4 h-4 dark:text-white" />
                    </button>
                  </div>
                  
                  {/* Item Total */}
                  <div className="text-right min-w-[70px]">
                    <span className="font-bold text-primary-600 dark:text-primary-400">
                      ${item.price * item.quantity}
                    </span>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Cart Summary */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg"
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Tax (5%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <Link to={`${prefix}/checkout`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full btn-primary"
            >
              Proceed to Checkout
            </motion.button>
          </Link>
        </div>
      </motion.div>
      
      {/* Clear Cart Confirmation */}
      <AnimatePresence>
        {isClearing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setIsClearing(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2 dark:text-white">Clear Cart?</h3>
              <p className="text-gray-500 mb-6">Are you sure you want to remove all items?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearCart()
                    setIsClearing(false)
                  }}
                  className="flex-1 btn-danger"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsClearing(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

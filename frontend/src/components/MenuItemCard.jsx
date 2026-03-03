import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Star, Leaf, Drumstick } from 'lucide-react'
import { useCartStore, useToastStore } from '../store'

export default function MenuItemCard({ item }) {
  const [selectedSize, setSelectedSize] = useState('full')
  const [showOptions, setShowOptions] = useState(false)
  const [quantity, setQuantity] = useState(1)
  
  const { addItem } = useCartStore()
  const { addToast } = useToastStore()
  
  const price = selectedSize === 'half' ? item.price_half : item.price_full
  const hasHalfOption = item.price_half !== null
  
  const handleAddToCart = () => {
    addItem(item, selectedSize, quantity)
    addToast(`${item.name} (${selectedSize}) added to cart`, 'success')
    setShowOptions(false)
    setQuantity(1)
  }
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`badge ${item.category === 'veg' ? 'badge-veg' : 'badge-non-veg'}`}>
              {item.category === 'veg' ? <Leaf className="w-3 h-3 mr-1" /> : <Drumstick className="w-3 h-3 mr-1" />}
              {item.category === 'veg' ? 'Veg' : 'Non-Veg'}
            </span>
            {item.is_popular && (
              <span className="badge badge-popular">
                <Star className="w-3 h-3 mr-1" /> Popular
              </span>
            )}
          </div>
        </div>
        
        {/* Name & Description */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {item.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
          {item.description}
        </p>
        
        {/* Price & Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              ${price}
            </span>
            {hasHalfOption && (
              <span className="text-sm text-gray-500">
                / {selectedSize === 'half' ? 'Half' : 'Full'}
              </span>
            )}
          </div>
          
          <motion.button
            onClick={() => setShowOptions(true)}
            className="btn-primary text-sm py-2 px-4"
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4 mr-1 inline" /> Add
          </motion.button>
        </div>
        
        {/* Prep Time */}
        {item.prep_time_minutes && (
          <p className="text-xs text-gray-400 mt-2">
            ⏱️ ~{item.prep_time_minutes} mins
          </p>
        )}
      </div>
      
      {/* Size Options Modal */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowOptions(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 dark:text-white">{item.name}</h3>
              
              {/* Size Selection */}
              {hasHalfOption ? (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setSelectedSize('half')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      selectedSize === 'half'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Half ${item.price_half}
                  </button>
                  <button
                    onClick={() => setSelectedSize('full')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                      selectedSize === 'full'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Full ${item.price_full}
                  </button>
                </div>
              ) : (
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-4">
                  ${item.price_full}
                </p>
              )}
              
              {/* Quantity */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5 dark:text-white" />
                </button>
                <span className="text-2xl font-bold dark:text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              {/* Total */}
              <div className="text-center mb-4">
                <span className="text-gray-500">Total: </span>
                <span className="text-2xl font-bold dark:text-white">${price * quantity}</span>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOptions(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToCart}
                  className="btn-primary flex-1"
                >
                  Add to Cart
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

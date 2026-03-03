import { Outlet, useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, Moon, Sun, Home, Utensils } from 'lucide-react'
import { useCartStore, useThemeStore, useMenuStore } from '../store'

export default function CustomerLayout() {
  const { tableNumber } = useParams()
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode } = useThemeStore()
  const { getItemCount, setTableNumber } = useCartStore()
  const { fetchMenu } = useMenuStore()
  
  const itemCount = getItemCount()
  
  useEffect(() => {
    if (tableNumber) {
      setTableNumber(parseInt(tableNumber))
    }
    fetchMenu()
  }, [tableNumber])
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-2"
              onClick={() => navigate(tableNumber ? `/table/${tableNumber}` : '/')}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-10 h-10 rounded-xl gradient-orange flex items-center justify-center">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">熊熊冰室</h1>
                {tableNumber && (
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    Table {tableNumber}
                  </p>
                )}
              </div>
            </motion.div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              
              <Link to={tableNumber ? `/table/${tableNumber}/cart` : '/cart'}>
                <motion.button
                  className="relative p-2 rounded-xl bg-primary-500 hover:bg-primary-600 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <ShoppingCart className="w-5 h-5 text-white" />
                  {itemCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                    >
                      {itemCount}
                    </motion.span>
                  )}
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pb-24">
        <Outlet />
      </main>
      
      {/* Restaurant Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">熊熊冰室</h2>
            <p className="text-gray-400 text-sm mb-2">
              Shop No. 2,3,4, Angan Apt, Radha Nagar, Tulinj Road
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Near Amantaran Bar, Nallasopara East, Palghar - 401209
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-400">
              <span>📞 7030802567</span>
              <span>📞 7798757769</span>
            </div>
            <p className="text-gray-500 text-xs mt-4">
              Open: 11:30 AM – 11:30 PM
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

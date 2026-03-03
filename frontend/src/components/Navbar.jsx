import { Menu, ShoppingCart, Sun, Moon, Home, ChefHat, Settings } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useCartStore, useThemeStore } from '../store/store'
import { motion } from 'framer-motion'

export default function Navbar({ showMenuToggle = true, showCart = true }) {
  const { tableNumber } = useParams()
  const location = useLocation()
  const { darkMode, toggleDarkMode } = useThemeStore()
  const { getItemCount } = useCartStore()
  
  const itemCount = getItemCount()
  const isKitchen = location.pathname === '/kitchen'
  const isAdmin = location.pathname.startsWith('/admin')
  const isOrderStatus = location.pathname.startsWith('/order/')
  const isCustomerView = tableNumber && !isKitchen && !isAdmin && !isOrderStatus
  
  return (
    <nav className="sticky top-0 z-40 glass border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {showMenuToggle && (
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
                onClick={() => document.getElementById('mobile-menu')?.classList.toggle('hidden')}
              >
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  Delicacy
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">餐廳</p>
              </div>
            </Link>
          </div>
          
          {/* Table Info */}
          {isCustomerView && (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-full"
            >
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                餐桌 {tableNumber}
              </span>
            </motion.div>
          )}
          
          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Order Status Link - Show for customers */}
            {isCustomerView && (
              <Link
                to={tableNumber ? `/table/${tableNumber}` : '/'}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="查看菜單"
              >
                <Home className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </Link>
            )}
            
            {/* Kitchen Link - Hide from customer panel */}
            {!isKitchen && !isCustomerView && !isOrderStatus && (
              <Link
                to="/kitchen"
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="廚房看板"
              >
                <ChefHat className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </Link>
            )}
            
            {/* Admin Link - Hide from customer panel */}
            {!isAdmin && !isCustomerView && !isOrderStatus && (
              <Link
                to="/admin"
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="管理後台"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </Link>
            )}
            
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={darkMode ? '淺色模式' : '深色模式'}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
            
            {/* Cart Button - Only show for customer view */}
            {showCart && isCustomerView && itemCount > 0 && (
              <Link
                to={`/table/${tableNumber}`}
                className="relative p-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-white" />
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

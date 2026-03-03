import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, DollarSign, QrCode, Plus, Edit, Trash2,
  Eye, EyeOff, Search, Download, RefreshCw, BarChart3,
  Home, Menu, X, ChevronRight, Users, TrendingUp, Clock,
  Table as TableIcon, Tag, Calendar, TrendingDown, PieChart,
  Filter, MoreVertical, ArrowUp, ArrowDown, FileText, Printer,
  Sun, Moon
} from 'lucide-react'
import {
  getMenu, getSalesReport, getAdminStats, getAnalytics,
  generateQRCode, seedMenu, deleteMenuItem,
  getTables, createTable, updateTableStatus, deleteTable,
  getOrders, updateOrderStatus, getDiscounts, createDiscount, deleteDiscount,
  validateDiscount, exportData
} from '../lib/api'
import Navbar from '../components/Navbar'
import { useToastStore, useThemeStore } from '../store/store'
import useWebSocket from '../hooks/useWebSocket'

// Components
import Dashboard from './admin/Dashboard'
import MenuManagement from './admin/MenuManagement'
import OrderManagement from './admin/OrderManagement'
import TableManagement from './admin/TableManagement'
import DiscountManagement from './admin/DiscountManagement'
import Analytics from './admin/Analytics'
import QRGenerator from './admin/QRGenerator'
import SettingsPage from './admin/Settings'

export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode } = useThemeStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { addToast } = useToastStore()

  const navItems = [
    { path: '/admin', icon: <BarChart3 className="w-5 h-5" />, label: '儀表板', exact: true },
    { path: '/admin/orders', icon: <FileText className="w-5 h-5" />, label: '訂單' },
    { path: '/admin/menu', icon: <Menu className="w-5 h-5" />, label: '菜單' },
    { path: '/admin/tables', icon: <TableIcon className="w-5 h-5" />, label: '餐桌' },
    { path: '/admin/discounts', icon: <Tag className="w-5 h-5" />, label: '折扣' },
    { path: '/admin/analytics', icon: <PieChart className="w-5 h-5" />, label: '分析' },
    { path: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: '設定' },
    { path: '/admin/qr', icon: <QrCode className="w-5 h-5" />, label: 'QR 碼' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar showCart={false} />

      <div className="flex">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed bottom-6 left-6 z-50 p-4 bg-primary-500 text-white rounded-full shadow-lg"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-16 lg:top-0 h-screen lg:h-[calc(100vh-64px)] w-64 
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 
          lg:z-0 transition-transform duration-300 
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              管理後台
            </h2>
          </div>

          {/* Dark mode toggle */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {darkMode ? '淺色模式' : '深色模式'}
              </span>
              {darkMode ? (
                <SunIcon className="w-5 h-5 text-yellow-500" />
              ) : (
                <MoonIcon className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                icon={item.icon}
                label={item.label}
                active={item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/kitchen"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <RefreshCw className="w-5 h-5" />
              <span className="font-medium">廚房檢視</span>
            </Link>
            <Link
              to="/table/1"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">顧客檢視</span>
            </Link>
          </div>
        </aside>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-3 lg:p-6 w-full lg:ml-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrderManagement />} />
            <Route path="/menu" element={<MenuManagement />} />
            <Route path="/tables" element={<TableManagement />} />
            <Route path="/discounts" element={<DiscountManagement />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/qr" element={<QRGenerator />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function NavLink({ to, icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  )
}

function SunIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

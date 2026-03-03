import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Clock, RefreshCw, Plus, BarChart3,
  Calendar, ArrowUp, ArrowDown
} from 'lucide-react'
import { getAdminStats, getSalesReport, seedMenu, getAnalytics } from '../../lib/api'
import { useToastStore } from '../../store/store'
import useWebSocket from '../../hooks/useWebSocket'

export default function Dashboard() {
  const [stats, setStats] = useState({
    today_revenue: 0, today_orders: 0, pending_orders: 0,
    preparing_orders: 0, month_revenue: 0, all_time_revenue: 0,
    all_time_orders: 0, menu_items_count: 0
  })
  const [sales, setSales] = useState({ total_revenue: 0, total_orders: 0, items_sold: {} })
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('daily')
  const { addToast } = useToastStore()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, salesData, analyticsData] = await Promise.all([
        getAdminStats().catch(() => ({})),
        getSalesReport().catch(() => ({ total_revenue: 0, total_orders: 0, items_sold: {} })),
        getAnalytics(period).catch(() => (null))
      ])
      setStats(statsData || {})
      setSales(salesData || { total_revenue: 0, total_orders: 0, items_sold: {} })
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'new_order' || data.type === 'order_updated' || data.type === 'payment_completed') {
      fetchData()
    }
  }, [fetchData])

  useWebSocket('admin', null, handleWebSocketMessage)

  const handleSeedMenu = async () => {
    try {
      await seedMenu()
      addToast({ type: 'success', message: '菜單初始化成功！' })
      fetchData()
    } catch (error) {
      addToast({ type: 'error', message: '菜單初始化失敗' })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: "今日營收",
      value: `$${stats.today_revenue?.toFixed(0) || 0}`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'from-green-400 to-green-600',
      trend: '+12%'
    },
    {
      title: "今日訂單",
      value: stats.today_orders || 0,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-blue-400 to-blue-600',
      trend: '+5%'
    },
    {
      title: '待處理訂單',
      value: stats.pending_orders || 0,
      icon: <Clock className="w-6 h-6" />,
      color: 'from-orange-400 to-orange-600',
      trend: null
    },
    {
      title: '菜單品項',
      value: stats.menu_items_count || 0,
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'from-purple-400 to-purple-600',
      trend: null
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">儀表板</h1>
          <p className="text-gray-500 dark:text-gray-400">餐廳即時營運總覽</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <option value="daily">今天</option>
            <option value="weekly">本週</option>
            <option value="monthly">本月</option>
          </select>
          <button
            onClick={fetchData}
            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 text-white`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                {stat.trend && (
                  <div className="flex items-center gap-1 mt-1 text-sm">
                    <ArrowUp className="w-3 h-3" />
                    <span>{stat.trend}</span>
                  </div>
                )}
              </div>
              <div className="p-2 bg-white/20 rounded-lg">{stat.icon}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">本月</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">${stats.month_revenue?.toFixed(0) || 0}</p>
          <p className="text-xs text-gray-400">營收</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">累計</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">${stats.all_time_revenue?.toFixed(0) || 0}</p>
          <p className="text-xs text-gray-400">營收</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">累計</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.all_time_orders || 0}</p>
          <p className="text-xs text-gray-400">訂單</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">廚房</p>
          <p className="text-xl font-bold text-orange-500">{stats.preparing_orders || 0}</p>
          <p className="text-xs text-gray-400">製作中</p>
        </div>
      </div>

      {/* Top Selling Items */}
      {sales.items_sold && Object.keys(sales.items_sold).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            熱銷品項
          </h2>
          <div className="space-y-3">
            {Object.entries(sales.items_sold)
              .sort((a, b) => (b[1]?.revenue || 0) - (a[1]?.revenue || 0))
              .slice(0, 5)
              .map(([name, data], i) => (
                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">{name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">已售 {data?.quantity || 0}</span>
                    <span className="font-bold text-green-600">${data?.revenue?.toFixed(0) || 0}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速操作</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={handleSeedMenu}
            className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-center hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            <Plus className="w-6 h-6 mx-auto text-primary-600 mb-2" />
            <p className="text-sm font-medium text-primary-600">初始化菜單</p>
          </button>
          <button
            onClick={() => window.location.href = '/admin/orders'}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <TrendingUp className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-sm font-medium text-blue-600">查看訂單</p>
          </button>
          <button
            onClick={() => window.location.href = '/admin/analytics'}
            className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <BarChart3 className="w-6 h-6 mx-auto text-green-600 mb-2" />
            <p className="text-sm font-medium text-green-600">分析報表</p>
          </button>
          <button
            onClick={() => window.location.href = '/admin/qr'}
            className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Calendar className="w-6 h-6 mx-auto text-purple-600 mb-2" />
            <p className="text-sm font-medium text-purple-600">QR 碼</p>
          </button>
        </div>
      </div>
    </div>
  )
}

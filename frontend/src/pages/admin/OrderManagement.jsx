import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, RefreshCw, Eye, X } from 'lucide-react'
import { getOrders, getOrder, updateOrderStatus } from '../../lib/api'
import { useToastStore } from '../../store/store'
import useWebSocket from '../../hooks/useWebSocket'

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

const paymentStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

const statusLabels = {
  pending: '待處理',
  accepted: '已接受',
  preparing: '製作中',
  ready: '可取餐',
  completed: '已完成',
  cancelled: '已取消'
}

const paymentStatusLabels = {
  pending: '待付款',
  paid: '已付款',
  failed: '付款失敗'
}

export default function OrderManagement() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false)
  const { addToast } = useToastStore()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      
      const data = await getOrders(params)
      setOrders(data || [])
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      addToast({ type: 'error', message: '載入訂單失敗' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, addToast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'new_order' || data.type === 'order_updated') {
      fetchOrders()
    }
  }, [fetchOrders])

  useWebSocket('admin', null, handleWebSocketMessage)

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus)
      addToast({ type: 'success', message: '訂單狀態已更新' })
      setSelectedOrder(null)
      fetchOrders()
    } catch (error) {
      addToast({ type: 'error', message: '更新狀態失敗' })
    }
  }

  const handleOrderClick = async (order) => {
    try {
      setSelectedOrderLoading(true)
      const fullOrder = await getOrder(order.id)
      setSelectedOrder(fullOrder)
    } catch (error) {
      console.error('Failed to fetch order details:', error)
      addToast({ type: 'error', message: '載入訂單詳情失敗' })
    } finally {
      setSelectedOrderLoading(false)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleString('zh-TW', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">訂單管理</h1>
          <p className="text-gray-500 dark:text-gray-400">查看並管理所有訂單</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
          重新整理
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="依訂單編號搜尋..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <option value="">全部狀態</option>
          <option value="pending">待處理</option>
          <option value="accepted">已接受</option>
          <option value="preparing">製作中</option>
          <option value="ready">可取餐</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-500">載入訂單中...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">找不到訂單</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">訂單</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">桌號</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">顧客</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">總額</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">狀態</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">付款</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">時間</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      餐桌 {order.table_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      ${order.total_amount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStatusColors[order.payment_status] || 'bg-gray-100'}`}>
                        {paymentStatusLabels[order.payment_status] || order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOrderClick(order)}
                        className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function OrderDetailModal({ order, onClose, onStatusUpdate }) {
  const formatTime = (date) => {
    return new Date(date).toLocaleString('zh-TW', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">訂單詳情</h2>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">訂單編號</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">桌號</p>
              <p className="font-medium text-gray-900 dark:text-white">餐桌 {order.table_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">顧客</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">電話</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">狀態</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">付款</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : order.payment_status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {paymentStatusLabels[order.payment_status] || order.payment_status}
              </span>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">品項</p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2">
              {order.items_json && order.items_json.length > 0 ? (
                order.items_json.map((item, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-900 dark:text-white font-medium">{item.quantity}x</span>
                      <div>
                        <span className="text-gray-900 dark:text-white">{item.name}</span>
                        {item.half_full && (
                          <span className="text-gray-400 text-sm ml-1">({item.half_full})</span>
                        )}
                        {item.notes && (
                          <p className="text-gray-400 text-xs italic">{item.notes}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-600 dark:text-gray-300">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-2">沒有品項</p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">小計</span>
              <span className="text-gray-900 dark:text-white">${order.subtotal?.toFixed(2)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-500">折扣（{order.discount_code}）</span>
                <span className="text-green-500">-${order.discount_amount?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">稅金（GST）</span>
              <span className="text-gray-900 dark:text-white">${order.tax_amount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span className="text-gray-900 dark:text-white">總計</span>
              <span className="text-primary-600">${order.total_amount?.toFixed(2)}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-xs text-gray-500 space-y-1">
            <p>建立時間：{formatTime(order.created_at)}</p>
            {order.updated_at && <p>更新時間：{formatTime(order.updated_at)}</p>}
            {order.completed_at && <p>完成時間：{formatTime(order.completed_at)}</p>}
          </div>

          {/* Payment Info */}
          {order.payment_id && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">付款編號</p>
              <p className="font-mono text-sm text-gray-900 dark:text-white">{order.payment_id}</p>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">備註</p>
              <p className="text-sm text-gray-900 dark:text-white">{order.notes}</p>
            </div>
          )}

          {/* Status Actions */}
          <div className="flex flex-wrap gap-2 pt-4">
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <>
                {order.status === 'pending' && (
                  <button
                    onClick={() => onStatusUpdate(order.id, 'accepted')}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    接受
                  </button>
                )}
                {order.status === 'accepted' && (
                  <button
                    onClick={() => onStatusUpdate(order.id, 'preparing')}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    開始製作
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => onStatusUpdate(order.id, 'ready')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    標記可取餐
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => onStatusUpdate(order.id, 'completed')}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    完成
                  </button>
                )}
                <button
                  onClick={() => onStatusUpdate(order.id, 'cancelled')}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  取消訂單
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

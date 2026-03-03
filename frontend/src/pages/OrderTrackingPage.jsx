import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, CheckCircle, XCircle, ChefHat, Bell, RefreshCw } from 'lucide-react'
import axios from 'axios'
import { useOrderStore, useWebSocketStore, useToastStore } from '../store'

const statusSteps = [
  { status: 'pending', label: '待處理', icon: Clock },
  { status: 'accepted', label: '已接受', icon: CheckCircle },
  { status: 'preparing', label: '製作中', icon: ChefHat },
  { status: 'ready', label: '可取餐', icon: Bell },
]

const statusLabels = {
  pending: '待處理',
  accepted: '已接受',
  preparing: '製作中',
  ready: '可取餐',
  completed: '已完成',
  rejected: '已拒絕',
  cancelled: '已取消'
}

export default function OrderTrackingPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { currentOrder, setCurrentOrder, updateOrderStatus } = useOrderStore()
  const { connect, subscribeToOrder, setMessageHandler, disconnect } = useWebSocketStore()
  const { addToast } = useToastStore()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  useEffect(() => {
    fetchOrder()
    
    // Connect to WebSocket for real-time updates
    const { ws, connectionId } = connect('customer')
    
    setMessageHandler((data) => {
      if (data.type === 'status_change' && data.data.id === parseInt(orderId)) {
        updateOrderStatus(data.data.id, data.data.order_status)
        addToast(`訂單狀態：${statusLabels[data.data.order_status] || data.data.order_status}`)
      }
    })
    
    if (ws && connectionId) {
      subscribeToOrder(parseInt(orderId))
    }
    
    return () => {
      disconnect()
    }
  }, [orderId])
  
  const fetchOrder = async () => {
    try {
      const response = await axios.get(`/api/orders/${orderId}`)
      setCurrentOrder(response.data.order)
    } catch (error) {
      console.error('Failed to fetch order:', error)
      addToast('載入訂單詳情失敗', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchOrder()
    setRefreshing(false)
  }
  
  const getCurrentStep = () => {
    if (!currentOrder) return 0
    const index = statusSteps.findIndex(s => s.status === currentOrder.order_status)
    return index >= 0 ? index : 0
  }
  
  const getStatusColor = (status) => {
    if (!currentOrder) return 'bg-gray-300'
    
    const currentIndex = statusSteps.findIndex(s => s.status === currentOrder.order_status)
    const stepIndex = statusSteps.findIndex(s => s.status === status)
    
    if (stepIndex < currentIndex) return 'bg-green-500'
    if (stepIndex === currentIndex) return 'bg-primary-500'
    return 'bg-gray-300'
  }
  
  const isOrderRejected = currentOrder?.order_status === 'rejected'
  const isOrderCompleted = currentOrder?.order_status === 'completed'
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-500">載入訂單詳情中...</p>
        </div>
      </div>
    )
  }
  
  if (!currentOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">找不到訂單</p>
          <Link to="/" className="btn-primary">
            返回首頁
          </Link>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/">
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5 dark:text-white" />
              </motion.button>
            </Link>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                <RefreshCw className={`w-5 h-5 dark:text-white ${refreshing ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Order Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">訂單編號</p>
              <h1 className="text-2xl font-bold dark:text-white">{currentOrder.order_number}</h1>
            </div>
            <div className={`px-4 py-2 rounded-xl font-semibold ${
              isOrderRejected ? 'bg-red-100 text-red-600' :
              isOrderCompleted ? 'bg-green-100 text-green-600' :
              'bg-primary-100 text-primary-600'
            }`}>
              {isOrderRejected ? '已拒絕' :
               isOrderCompleted ? '已完成' :
               statusLabels[currentOrder.order_status] || currentOrder.order_status}
            </div>
          </div>
          
          {/* Table Info */}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
            <span>餐桌 {currentOrder.table_number}</span>
            <span>•</span>
            <span>{currentOrder.customer_name}</span>
          </div>
          
          {/* Order Items */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h3 className="font-semibold mb-3 dark:text-white">訂單品項</h3>
            {currentOrder.items.map((item, index) => (
              <div key={index} className="flex justify-between py-2 text-sm">
                <span className="dark:text-gray-300">
                  {item.quantity}x {item.name} ({item.size})
                </span>
                <span className="dark:text-white">${item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          
          {/* Total */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div className="flex justify-between font-bold text-lg dark:text-white">
              <span>已付款總額</span>
              <span>${currentOrder.total.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Special Notes */}
          {currentOrder.special_notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl mt-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                📝 {currentOrder.special_notes}
              </p>
            </div>
          )}
        </motion.div>
        
        {/* Order Status Timeline */}
        {!isOrderRejected && !isOrderCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 mb-6"
          >
            <h2 className="text-lg font-semibold mb-6 dark:text-white">訂單狀態</h2>
            
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              
              {/* Steps */}
              <div className="space-y-6">
                {statusSteps.map((step, index) => {
                  const isCompleted = index <= getCurrentStep()
                  const isCurrent = index === getCurrentStep()
                  
                  return (
                    <motion.div
                      key={step.status}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative flex items-center gap-4"
                    >
                      {/* Step Icon */}
                      <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center ${
                        isCompleted ? getStatusColor(step.status) : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        <step.icon className={`w-6 h-6 ${isCompleted ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      
                      {/* Step Label */}
                      <div className={`${isCurrent ? 'font-semibold' : ''} dark:text-white`}>
                        {step.label}
                        {isCurrent && (
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-sm text-primary-500 mt-1"
                          >
                            處理中...
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Rejected Message */}
        {isOrderRejected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <XCircle className="w-8 h-8 text-red-500" />
              <h2 className="text-xl font-bold text-red-600">訂單已拒絕</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              很抱歉，您的訂單已被拒絕。請聯絡現場人員取得協助。
            </p>
          </motion.div>
        )}
        
        {/* Ready for Collection */}
        {currentOrder.order_status === 'ready' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Bell className="w-8 h-8 text-green-500" />
              </motion.div>
              <h2 className="text-xl font-bold text-green-600">可取餐！</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              您的訂單已可取餐，請前往櫃台領取。
            </p>
          </motion.div>
        )}
        
        {/* Status History */}
        {currentOrder.status_history && currentOrder.status_history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold mb-4 dark:text-white">狀態紀錄</h2>
            <div className="space-y-3">
              {currentOrder.status_history.map((history, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary-500" />
                  <div>
                    <p className="font-medium capitalize dark:text-white">
                      {statusLabels[history.status] || history.status.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(history.timestamp).toLocaleString()}
                    </p>
                    {history.message && (
                      <p className="text-sm text-gray-400 mt-1">{history.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, ShoppingCart, Plus, Minus, X, 
  CheckCircle, Clock, Utensils, Leaf, Flame, 
  CreditCard, ChevronRight, Star, MapPin, ChefHat,
  Phone, Home, Wifi, MicOff, Filter
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getMenu, getCategories, createOrder, createPaymentOrder, verifyPayment, getPricingSettings } from '../lib/api'
import { useCartStore, useThemeStore, useToastStore } from '../store/store'

// Categories with proper hierarchy
const categories = [
  { id: 'all', name: '全部餐點', icon: '🍽️', subcategories: [] },
  { id: 'soups', name: '湯品與粥品', icon: '🥣', subcategories: ['湯品', '粥品'] },
  { id: 'starters', name: '小食', icon: '🍗', subcategories: ['小食'] },
  { id: 'rice_noodles', name: '飯類與粉麵', icon: '🍚', subcategories: ['炒飯', '炒粉麵', '粉麵'] },
  { id: 'main_course', name: '主食', icon: '🍛', subcategories: ['主食'] },
  { id: 'biryani', name: '港式飯類', icon: '🍲', subcategories: ['飯類'] },
  { id: 'rolls', name: '三文治與卷類', icon: '🥪', subcategories: ['三文治', '卷類'] },
  { id: 'breads', name: '包點與多士', icon: '🍞', subcategories: ['包點', '多士'] },
  { id: 'combos', name: '套餐', icon: '📦', subcategories: ['早餐套餐', '午市套餐', '常餐', '焗飯套餐', '粉麵套餐', '小食拼盤'] },
  { id: 'south_indian', name: '其他精選', icon: '🍛', subcategories: ['其他'] },
  { id: 'beverages', name: '飲品', icon: '🥤', subcategories: ['熱飲', '凍飲'] },
]

const vegFilterOptions = [
  { id: 'all', name: '全部', icon: '🍽️' },
  { id: 'veg', name: '只看素食', icon: '🥬' },
  { id: 'non-veg', name: '只看葷食', icon: '🍗' },
]

const statusSteps = [
  { key: 'pending', label: '待處理', icon: Clock },
  { key: 'accepted', label: '已接受', icon: CheckCircle },
  { key: 'preparing', label: '製作中', icon: ChefHat },
  { key: 'ready', label: '可取餐', icon: Star },
]

export default function CustomerPage() {
  const { tableNumber } = useParams()
  const navigate = useNavigate()
  const [menu, setMenu] = useState([])
  const [filteredMenu, setFilteredMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState(null)
  const [vegFilter, setVegFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [showCart, setShowCart] = useState(false)
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(null)
  const [orderStatus, setOrderStatus] = useState('pending')
  const [isOnline, setIsOnline] = useState(true) // Default to true, only show offline if confirmed
  const [pricingSettings, setPricingSettings] = useState(null)
  const [categoryNameById, setCategoryNameById] = useState({})

  const { cart, addToCart, removeFromCart, updateQuantity, updateComboDrink, updateComboDrinkTemp, clearCart, setTableNumber, getTotal } = useCartStore()
  const { addToast } = useToastStore()

  useEffect(() => {
    if (tableNumber) {
      setTableNumber(parseInt(tableNumber))
    } else {
      navigate('/table/1', { replace: true })
    }
  }, [tableNumber, navigate])

  useEffect(() => {
    // More robust online/offline detection
    const handleOnline = () => {
      setIsOnline(true)
      addToast({ type: 'success', message: '已恢復連線！' })
    }
    const handleOffline = () => {
      // Don't immediately set offline - verify with a ping
      const verifyOffline = async () => {
        try {
          await fetch('http://localhost:8000/api/menu', { mode: 'cors', cache: 'no-store' })
          // If fetch succeeds, we're actually online
          setIsOnline(true)
        } catch (e) {
          // Only set offline if ping also fails
          console.log('Connection check failed, might be offline')
        }
      }
      verifyOffline()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [addToast])

  useEffect(() => {
    fetchMenu()
    fetchCategories()
    fetchPricingSettings()
  }, [])
  
  useEffect(() => {
    filterMenu()
  }, [menu, search, selectedCategory, selectedSubcategory, vegFilter, sortBy])
  
  const [retryCount, setRetryCount] = useState(0)
  const [errorDetails, setErrorDetails] = useState(null)
  
  const fetchMenu = async () => {
    try {
      setLoading(true)
      setErrorDetails(null)
      const data = await getMenu()
      console.log('Menu loaded successfully:', data.length, 'items')
      setMenu(data)
      setFilteredMenu(data)
      setIsOnline(true) // Menu loaded successfully, we're online
      if (data.length === 0) {
        addToast({ type: 'warning', message: '菜單目前為空，請通知店員新增餐點。' })
      }
    } catch (error) {
      console.error('Failed to load menu:', error)
      setErrorDetails(error.message || '未知錯誤')
      if (error.response) {
        if (error.response.status === 404) {
          addToast({ type: 'error', message: '找不到菜單 API，請確認伺服器是否已啟動。' })
        } else if (error.response.status === 500) {
          addToast({ type: 'error', message: '伺服器錯誤，請稍後再試。' })
        } else {
          addToast({ type: 'error', message: `錯誤：${error.response.status}` })
        }
      } else if (error.request) {
        addToast({ type: 'error', message: '無法連線到伺服器，請確認後端是否在 8000 埠運行。' })
      } else {
        addToast({ type: 'error', message: '載入菜單失敗' })
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const categories = await getCategories()
      const mapping = {}
      categories.forEach((cat) => {
        mapping[cat.id] = cat.name
      })
      setCategoryNameById(mapping)
    } catch (error) {
      setCategoryNameById({})
    }
  }

  const fetchPricingSettings = async () => {
    try {
      const data = await getPricingSettings()
      setPricingSettings(data)
    } catch (error) {
      setPricingSettings(null)
    }
  }
  
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    fetchMenu()
  }
  
  const filterMenu = useCallback(() => {
    let filtered = [...menu]
    
    if (search) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (selectedCategory !== 'all') {
      // Match by category_id from database or resolved category name
      filtered = filtered.filter(item => 
        item.category_id === parseInt(selectedCategory) || 
        categoryNameById[item.category_id] === selectedCategory ||
        item.category === selectedCategory
      )
    }
    
    if (selectedSubcategory) {
      filtered = filtered.filter(item => item.subcategory === selectedSubcategory)
    }
    
    if (vegFilter === 'veg') {
      filtered = filtered.filter(item => item.is_vegetarian)
    } else if (vegFilter === 'non-veg') {
      filtered = filtered.filter(item => !item.is_vegetarian)
    }
    
    if (sortBy === 'price-low') {
      filtered.sort((a, b) => (a.price_half || a.price) - (b.price_half || b.price))
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => (b.price_half || b.price) - (a.price_half || a.price))
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }
    
    setFilteredMenu(filtered)
  }, [menu, search, selectedCategory, selectedSubcategory, vegFilter, sortBy, categoryNameById])
  
  const handleAddToCart = (item, halfFull) => {
    const price = halfFull === 'half' ? item.price_half : item.price_full || item.price
    addToCart({
      id: item.id,
      name: item.name,
      price: price,
      halfFull: halfFull,
      hasHalfFull: item.has_half_full,
      isCombo: item.is_combo,
      linkedDrinkItemId: null,
      linkedDrinkName: null,
      drinkTemp: null,
      pricingNote: item.pricing_note,
      mealPeriod: item.meal_period
    })
    addToast({ type: 'success', message: `${item.name} 已加入！` })
  }
  
  const handleCheckout = async (formData) => {
    if (cart.length === 0) {
      addToast({ type: 'error', message: 'Cart is empty!' })
      return
    }
    
    if (!isOnline) {
      addToast({ type: 'error', message: '請檢查網路連線' })
      return
    }
    
    try {
      const orderData = {
        table_number: parseInt(tableNumber) || 1,
        customer_name: formData.name,
        customer_phone: formData.phone,
        items: cart.map(item => ({
          menu_item_id: item.id,
          name: item.name,
          price: item.price + (item.isCombo && item.linkedDrinkItemId && item.drinkTemp === 'iced' ? 3 : 0),
          quantity: item.quantity,
          half_full: item.halfFull,
          linked_drink_item_id: item.linkedDrinkItemId || null,
          drink_temp: item.linkedDrinkItemId ? (item.drinkTemp || 'hot') : null
        })),
        notes: formData.notes
      }
      
      const orderResult = await createOrder(orderData)
      setCurrentOrder(orderResult)
      
      const paymentResult = await createPaymentOrder(orderResult.order_id, orderResult.total_amount)
      
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SEULnJj6ZBfPb4',
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        order_id: paymentResult.order_id,
        name: '熊熊冰室',
        description: `Order #${orderResult.order_number}`,
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
            setOrderPlaced(true)
            setCheckoutMode(false)
            clearCart()
            addToast({ type: 'success', message: '付款成功！訂單已送出。' })
          } catch (err) {
            addToast({ type: 'error', message: '付款驗證失敗' })
          }
        },
        prefill: {
          name: formData.name,
          phone: formData.phone
        },
        theme: { color: '#ed751d' }
      }
      
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options)
        razorpay.open()
      } else {
        addToast({ type: 'error', message: '付款系統載入中' })
      }
      
    } catch (error) {
      addToast({ type: 'error', message: '下單失敗' })
    }
  }
  
  const cartTotal = getTotal()
  const beverageOptions = menu.filter((menuItem) => categoryNameById[menuItem.category_id] === 'beverages')
  
  if (orderPlaced && currentOrder) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Navbar showCart={false} />
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-md w-full"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
            >
              <CheckCircle className="w-16 h-16 text-white" />
            </motion.div>
            
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl font-bold mb-2 text-white"
            >
              訂單已送出！
            </motion.h2>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-2 text-gray-400"
            >
              Order #{currentOrder.order_number}
            </motion.p>
            
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={() => navigate(`/order/${currentOrder.order_number}`)}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold mb-3"
            >
              追蹤訂單
            </motion.button>
            
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={() => {
                setOrderPlaced(false)
                setCurrentOrder(null)
              }}
              className="w-full py-4 rounded-xl font-bold bg-gray-800 text-white"
            >
              返回菜單
            </motion.button>
          </motion.div>
        </div>
        <Footer />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {!isOnline && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2"
        >
          <MicOff className="w-4 h-4" />
          <span className="text-sm">離線中</span>
        </motion.div>
      )}
      
      <Navbar />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white py-6 px-4"
      >
        <h1 className="text-xl sm:text-2xl font-bold mb-1">熊熊冰室</h1>
        {tableNumber && (
          <p className="text-white/90 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4" /> 餐桌 {tableNumber}
          </p>
        )}
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-16 z-30 shadow-md px-4 py-3 bg-white dark:bg-gray-800"
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋餐點..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary-500 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id)
                setSelectedSubcategory(null)
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                selectedCategory === cat.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        
        {/* Subcategory Tabs */}
        {selectedCategory !== 'all' && categories.find(c => c.id === selectedCategory)?.subcategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
            <button
              onClick={() => setSelectedSubcategory(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                selectedSubcategory === null
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              全部
            </button>
            {categories.find(c => c.id === selectedCategory)?.subcategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubcategory(sub)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize ${
                  selectedSubcategory === sub
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
        
        {/* Filters Row */}
        <div className="flex items-center justify-between pt-2 gap-2">
          {/* Veg/Non-Veg Filter */}
          <div className="flex gap-1">
            {vegFilterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setVegFilter(opt.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                  vegFilter === opt.id
                    ? opt.id === 'veg' 
                      ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400'
                      : opt.id === 'non-veg'
                        ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-700 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {opt.icon}
              </button>
            ))}
          </div>
          
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border-0 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="name">排序：名稱</option>
            <option value="price-low">價格：低到高</option>
            <option value="price-high">價格：高到低</option>
          </select>
        </div>
      </motion.div>
      
      <div className="flex-1 max-w-7xl mx-auto px-4 py-4 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 skeleton h-40 bg-white dark:bg-gray-800" />
            ))}
          </div>
        ) : filteredMenu.length === 0 && !errorDetails ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Utensils className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>找不到餐點</p>
          </div>
        ) : filteredMenu.length === 0 && errorDetails ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Utensils className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <p className="text-red-500 mb-4">菜單載入失敗</p>
            <p className="text-sm mb-4 opacity-70">{errorDetails}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              重試 ({retryCount})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenu.map((item, index) => (
              <MenuCard
                key={item.id}
                item={item}
                index={index}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {(showCart || checkoutMode) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => { setShowCart(false); setCheckoutMode(false) }}
            />
            {checkoutMode ? (
              <CheckoutPage
                cart={cart}
                total={cartTotal}
                tableNumber={tableNumber}
                pricingSettings={pricingSettings}
                onBack={() => setCheckoutMode(false)}
                onSubmit={handleCheckout}
              />
            ) : (
              <CartSidebar
                cart={cart}
                total={cartTotal}
                pricingSettings={pricingSettings}
                beverageOptions={beverageOptions}
                onClose={() => setShowCart(false)}
                onRemove={removeFromCart}
                onUpdate={updateQuantity}
                onUpdateComboDrink={updateComboDrink}
                onUpdateComboDrinkTemp={updateComboDrinkTemp}
                onCheckout={() => setCheckoutMode(true)}
              />
            )}
          </>
        )}
      </AnimatePresence>
      
      {!showCart && !checkoutMode && cart.length > 0 && (
        <motion.button
          initial={{ scale: 0, y: 100 }}
          animate={{ scale: 1, y: 0 }}
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-30 bg-primary-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
            ${cartTotal.toFixed(0)}
          </span>
        </motion.button>
      )}
      
      <Footer />
    </div>
  )
}

function MenuCard({ item, index, onAddToCart }) {
  const [showHalfFull, setShowHalfFull] = useState(false)
  
  const handleAdd = (halfFull) => {
    onAddToCart(item, halfFull)
    setShowHalfFull(false)
  }
  
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all bg-white dark:bg-gray-800"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {item.is_vegetarian ? (
              <span className="text-xl" title="素食">🥬</span>
            ) : (
              <span className="text-xl" title="葷食">🍗</span>
            )}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />{item.preparation_time}分鐘
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm mb-3 line-clamp-2 text-gray-500 dark:text-gray-400">{item.description}</p>
        
        <div className="flex items-center justify-between">
          <div className="text-sm">
            {item.has_half_full ? (
              <div className="flex gap-3">
                <span className="text-gray-400">半份：${item.price_half}</span>
                <span className="font-bold text-primary-600 dark:text-orange-400">全份：${item.price_full}</span>
              </div>
            ) : (
              <span className="text-lg font-bold text-primary-600 dark:text-orange-400">${item.price}</span>
            )}
          </div>
          
          <button
            onClick={() => setShowHalfFull(true)}
            className="flex items-center gap-1 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> 加入
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {showHalfFull && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-2"
            onClick={() => setShowHalfFull(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-sm w-full bg-white dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">{item.name}</h3>
              <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">選擇份量</p>
              
              <div className="space-y-2 sm:space-y-3">
                {item.has_half_full ? (
                  <>
                    <button onClick={() => handleAdd('half')} className="w-full p-3 sm:p-4 border-2 rounded-xl hover:border-primary-500 flex items-center justify-between border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                      <div><p className="font-semibold text-gray-900 dark:text-white">半份</p><p className="text-sm text-gray-500 dark:text-gray-400">${item.price_half}</p></div>
                      <Plus className="w-5 h-5 text-primary-600" />
                    </button>
                    <button onClick={() => handleAdd('full')} className="w-full p-3 sm:p-4 border-2 rounded-xl hover:border-primary-500 flex items-center justify-between border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                      <div><p className="font-semibold text-gray-900 dark:text-white">全份</p><p className="text-sm text-gray-500 dark:text-gray-400">${item.price_full}</p></div>
                      <Plus className="w-5 h-5 text-primary-600" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => handleAdd(null)} className="w-full p-3 sm:p-4 border-2 rounded-xl hover:border-primary-500 flex items-center justify-between border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <div><p className="font-semibold text-gray-900 dark:text-white">加入</p><p className="text-sm text-gray-500 dark:text-gray-400">${item.price}</p></div>
                    <Plus className="w-5 h-5 text-primary-600" />
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowHalfFull(false)}
                className="mt-4 w-full py-2 text-gray-500 dark:text-gray-400"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CartSidebar({ cart, total, pricingSettings, beverageOptions, onClose, onRemove, onUpdate, onUpdateComboDrink, onUpdateComboDrinkTemp, onCheckout }) {
  const appliedNotes = [...new Set(cart.map((item) => item.pricingNote).filter(Boolean))]

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-full max-w-sm shadow-2xl z-50 flex flex-col bg-white dark:bg-gray-800"
    >
      <div className="p-4 border-b flex items-center justify-between border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">購物車</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="w-5 h-5 text-gray-500 dark:text-white" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
        {cart.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">購物車是空的</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                  {item.halfFull && <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{item.halfFull}</p>}
                  {item.isCombo ? (
                    <div className="mt-1 space-y-1">
                      <div className="space-y-2">
                        <select
                          value={item.linkedDrinkItemId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value ? parseInt(e.target.value) : null
                            const selectedDrink = beverageOptions.find((opt) => opt.id === selectedId)
                            onUpdateComboDrink(item.id, item.halfFull, selectedId, selectedDrink?.name || null)
                          }}
                          className="w-full px-2 py-1 rounded text-xs bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          <option value="">未配飲品</option>
                          {beverageOptions.map((drink) => (
                            <option key={drink.id} value={drink.id}>{drink.name}</option>
                          ))}
                        </select>

                        {item.linkedDrinkItemId ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => onUpdateComboDrinkTemp(item.id, item.halfFull, 'hot')}
                              className={`px-2 py-0.5 rounded text-xs ${item.drinkTemp !== 'iced' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-300'}`}
                            >
                              熱飲（免費）
                            </button>
                            <button
                              onClick={() => onUpdateComboDrinkTemp(item.id, item.halfFull, 'iced')}
                              className={`px-2 py-0.5 rounded text-xs ${item.drinkTemp === 'iced' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-300'}`}
                            >
                              凍飲（+$3）
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.linkedDrinkItemId
                          ? `已配：${item.drinkTemp === 'iced' ? '凍' : '熱'}${item.linkedDrinkName}（+${item.drinkTemp === 'iced' ? 3 : 0}）`
                          : '未配飲品'}
                      </p>
                      {item.linkedDrinkItemId && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                          <p>
                            飲品原價 ${beverageOptions.find((d) => d.id === item.linkedDrinkItemId)?.price ?? 0} 已豁免
                          </p>
                          <p>
                            套餐價 ${item.price.toFixed(2)} + 附加費 ${item.drinkTemp === 'iced' ? '3.00' : '0.00'} = ${(
                              item.price + (item.linkedDrinkItemId && item.drinkTemp === 'iced' ? 3 : 0)
                            ).toFixed(2)}
                          </p>
                        </div>
                      )}

                      <p className="font-medium text-primary-600 dark:text-orange-400">${(item.price + (item.linkedDrinkItemId && item.drinkTemp === 'iced' ? 3 : 0)).toFixed(2)}</p>
                    </div>
                  ) : (
                    <p className="font-medium text-primary-600 dark:text-orange-400">${item.price}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdate(item.id, item.halfFull, item.quantity - 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                  <button
                    onClick={() => onUpdate(item.id, item.halfFull, item.quantity + 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {cart.length > 0 && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {pricingSettings && (
            <div className="mb-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-xs text-orange-700 dark:text-orange-300">
              <p>午市 {pricingSettings.lunch_start}-{pricingSettings.lunch_end}：-{pricingSettings.lunch_discount_pct}%</p>
              <p>晚市 {pricingSettings.dinner_start}-{pricingSettings.dinner_end}：+{pricingSettings.dinner_surcharge_pct}%</p>
              {appliedNotes.length > 0 && <p className="mt-1 font-semibold">本單已套用：{appliedNotes.join('、')}</p>}
            </div>
          )}
          <div className="flex items-center justify-between mb-4 text-gray-900 dark:text-white">
            <span className="font-medium">小計</span>
            <span className="text-xl font-bold">${total.toFixed(0)}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full py-4 bg-primary-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            結帳
          </button>
        </div>
      )}
    </motion.div>
  )
}

function CheckoutPage({ cart, total, tableNumber, pricingSettings, onBack, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const appliedNotes = [...new Set(cart.map((item) => item.pricingNote).filter(Boolean))]
  const comboLines = cart.filter((item) => item.isCombo)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onSubmit(formData)
    setLoading(false)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-2 overflow-y-auto"
      onClick={onBack}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 text-gray-900 dark:text-white">
          <h2 className="text-lg font-bold">結帳</h2>
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">姓名</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="請輸入姓名"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">電話</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="例如 91234567 或 +852 91234567"
              inputMode="tel"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">香港手機格式：8位數字（可加 +852）</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">備註（選填）</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="例如：少辣、少鹽..."
              rows="2"
            />
          </div>
          
          <div className="p-4 rounded-xl space-y-2 bg-gray-50 dark:bg-gray-700">
            <div className="flex justify-between text-gray-900 dark:text-white">
              <span>品項數</span>
              <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            {comboLines.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2 space-y-1">
                {comboLines.map((item, idx) => {
                  const surcharge = item.linkedDrinkItemId && item.drinkTemp === 'iced' ? 3 : 0
                  const finalPrice = item.price + surcharge
                  return (
                    <p key={`${item.id}-${idx}`}>
                      {item.name}：套餐價 ${item.price.toFixed(2)} + 附加費 ${surcharge.toFixed(2)} = ${finalPrice.toFixed(2)}
                    </p>
                  )
                })}
              </div>
            )}
            {pricingSettings && (
              <div className="text-xs text-orange-700 dark:text-orange-300 border-t border-gray-200 dark:border-gray-600 pt-2">
                <p>午市 {pricingSettings.lunch_start}-{pricingSettings.lunch_end}：-{pricingSettings.lunch_discount_pct}%</p>
                <p>晚市 {pricingSettings.dinner_start}-{pricingSettings.dinner_end}：+{pricingSettings.dinner_surcharge_pct}%</p>
                {appliedNotes.length > 0 && <p className="mt-1 font-semibold">本單已套用：{appliedNotes.join('、')}</p>}
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
              <span>總計</span>
              <span>${total.toFixed(0)}</span>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                付款並下單
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

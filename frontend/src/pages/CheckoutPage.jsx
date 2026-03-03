import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CreditCard, Loader2, Check, Shield, Wallet, Building2, Lock } from 'lucide-react'
import axios from 'axios'
import { useCartStore, useOrderStore, useToastStore } from '../store'

export default function CheckoutPage() {
  const { tableNumber } = useParams()
  const navigate = useNavigate()
  const { items, getTotal, getTax, getGrandTotal, clearCart, tableNumber: cartTableNumber } = useCartStore()
  const { setCurrentOrder } = useOrderStore()
  const { addToast } = useToastStore()
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    specialNotes: ''
  })
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  
  const taxPercentage = 5
  const subtotal = getTotal()
  const tax = getTax(taxPercentage)
  const grandTotal = getGrandTotal(taxPercentage)
  
  const effectiveTableNumber = tableNumber || cartTableNumber
  
  // Razorpay Test Configuration
  const RAZORPAY_CONFIG = {
    key_id: 'rzp_test_SEULnJj6ZBfPb4',
    card_number: '4111111111111111',
    expiry_month: '12',
    expiry_year: '2027',
    cvv: '123',
    name: 'Test User'
  }
  
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }
  
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : value
  }
  
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }
  
  // Simulate Razorpay Payment Flow
  const processRazorpayPayment = async () => {
    setProcessing(true)
    
    try {
      // Step 1: Create order on backend
      const orderResponse = await axios.post('/api/orders', {
        table_number: effectiveTableNumber,
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        special_notes: formData.specialNotes,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.price
        }))
      })
      
      const order = orderResponse.data.order
      
      // Step 2: Simulate payment processing (in real app, this is Razorpay's job)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Step 3: Generate mock payment success
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Step 4: Verify payment
      await axios.post('/api/payment/verify', {
        order_id: order.id,
        payment_id: paymentId
      })
      
      clearCart()
      setCurrentOrder(order)
      setShowPaymentModal(false)
      addToast('Payment successful! Order placed.', 'success')
      navigate(`/order/${order.id}`)
      
    } catch (error) {
      console.error('Payment error:', error)
      addToast(error.response?.data?.detail || 'Payment failed. Please try again.', 'error')
    } finally {
      setProcessing(false)
    }
  }
  
  // Cash on Delivery
  const processCashPayment = async () => {
    setLoading(true)
    
    try {
      const orderResponse = await axios.post('/api/orders', {
        table_number: effectiveTableNumber,
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        special_notes: formData.specialNotes,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.price
        }))
      })
      
      const order = orderResponse.data.order
      
      clearCart()
      setCurrentOrder(order)
      addToast('Order placed! Pay at counter when collecting.', 'success')
      navigate(`/order/${order.id}`)
      
    } catch (error) {
      console.error('Order error:', error)
      addToast('Failed to place order', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.customerName.trim()) {
      addToast('Please enter your name', 'error')
      return
    }
    
    if (!formData.customerPhone.trim()) {
      addToast('Please enter your phone number', 'error')
      return
    }
    
    if (!effectiveTableNumber) {
      addToast('Table number is required', 'error')
      return
    }
    
    setShowPaymentModal(true)
  }
  
  const handlePayment = async () => {
    if (paymentMethod === 'razorpay') {
      await processRazorpayPayment()
    } else {
      await processCashPayment()
    }
  }
  
  const prefix = tableNumber ? `/table/${tableNumber}` : ''
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to={`${prefix}/cart`}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5 dark:text-white" />
              </motion.button>
            </Link>
            <h1 className="text-xl font-bold dark:text-white">Checkout</h1>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Summary */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Order Summary</h2>
            <div className="card p-4 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="dark:text-gray-300">
                    {item.quantity}x {item.name} ({item.size})
                  </span>
                  <span className="font-medium dark:text-white">
                    ${item.price * item.quantity}
                  </span>
                </div>
              ))}
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Tax (5%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Checkout Form */}
          <div>
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Your Details</h2>
            <form onSubmit={handleSubmit} className="card p-4 space-y-4">
              {/* Table Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Table Number
                </label>
                <input
                  type="text"
                  value={effectiveTableNumber ? `Table ${effectiveTableNumber}` : 'Not specified'}
                  disabled
                  className="input-field bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                />
              </div>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  className="input-field"
                  required
                />
              </div>
              
              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  placeholder="e.g. 91234567 or +852 91234567"
                  className="input-field"
                  inputMode="tel"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">HK mobile: 8 digits (optional +852)</p>
              </div>
              
              {/* Special Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Special Instructions
                </label>
                <textarea
                  name="specialNotes"
                  value={formData.specialNotes}
                  onChange={handleInputChange}
                  placeholder="e.g., Not spicy, less salt, etc."
                  rows="3"
                  className="input-field resize-none"
                />
              </div>
              
              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    onClick={() => setPaymentMethod('razorpay')}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      paymentMethod === 'razorpay'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <CreditCard className={`w-6 h-6 mx-auto mb-2 ${
                      paymentMethod === 'razorpay' ? 'text-primary-500' : 'text-gray-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      paymentMethod === 'razorpay' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Pay Online
                    </p>
                  </motion.button>
                  
                  <motion.button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      paymentMethod === 'cod'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Building2 className={`w-6 h-6 mx-auto mb-2 ${
                      paymentMethod === 'cod' ? 'text-green-500' : 'text-gray-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      paymentMethod === 'cod' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Pay at Counter
                    </p>
                  </motion.button>
                </div>
              </div>
              
              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  paymentMethod === 'razorpay'
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : paymentMethod === 'razorpay' ? (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ${grandTotal.toFixed(2)} Online
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Place Order (Pay at Counter)
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </div>
      </div>
      
      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !processing && setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-green-500" />
                  <h3 className="text-lg font-bold dark:text-white">
                    {paymentMethod === 'razorpay' ? 'Razorpay Secure Payment' : 'Confirm Order'}
                  </h3>
                </div>
                {!processing && (
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {paymentMethod === 'razorpay' ? (
                <>
                  {/* Amount */}
                  <div className="text-center mb-6">
                    <p className="text-gray-500 text-sm">Payable Amount</p>
                    <p className="text-3xl font-bold text-primary-600">${grandTotal.toFixed(2)}</p>
                  </div>
                  
                  {/* Razorpay Info */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-xl mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4" />
                      <span className="font-medium">Test Mode</span>
                    </div>
                    <p className="text-sm opacity-90">
                      Card: {RAZORPAY_CONFIG.card_number}<br/>
                      MM/YY: {RAZORPAY_CONFIG.expiry_month}/{RAZORPAY_CONFIG.expiry_year.slice(-2)}<br/>
                      CVV: {RAZORPAY_CONFIG.cvv}
                    </p>
                  </div>
                  
                  {/* Processing Animation */}
                  {processing && (
                    <div className="text-center py-4">
                      <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">Processing payment...</p>
                    </div>
                  )}
                  
                  {/* Pay Button */}
                  {!processing && (
                    <motion.button
                      onClick={processRazorpayPayment}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-5 h-5" />
                      Pay ${grandTotal.toFixed(2)} with Razorpay
                    </motion.button>
                  )}
                </>
              ) : (
                <>
                  {/* Cash on Delivery Confirmation */}
                  <div className="text-center py-4">
                    <Building2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your order will be placed and you can pay at the counter when collecting.
                    </p>
                  </div>
                  
                  {processing ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">Placing order...</p>
                    </div>
                  ) : (
                    <motion.button
                      onClick={processCashPayment}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full btn-success py-3 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Confirm Order
                    </motion.button>
                  )}
                </>
              )}
              
              {/* Security Note */}
              <p className="text-center text-xs text-gray-500 mt-4">
                🔒 Your payment is secured with 256-bit SSL encryption
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

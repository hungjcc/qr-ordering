import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home, Plus, Edit, Trash2, Eye, DollarSign, ShoppingBag, 
  Users, Clock, Settings, BarChart3, Utensils, ChevronRight
} from 'lucide-react'
import axios from 'axios'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [menu, setMenu] = useState([])
  const [sales, setSales] = useState({ orders: [], total_revenue: 0, total_orders: 0 })
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [newItem, setNewItem] = useState({
    name: '', description: '', category: 'veg', price_half: '', price_full: '', prep_time_minutes: 15
  })
  const [editingItem, setEditingItem] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  
  useEffect(() => {
    fetchDashboard()
    fetchMenu()
    fetchSales()
    fetchSettings()
  }, [])
  
  const fetchDashboard = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard')
      setDashboard(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    }
  }
  
  const fetchMenu = async () => {
    try {
      const response = await axios.get('/api/menu')
      setMenu(response.data.menu)
    } catch (error) {
      console.error('Failed to fetch menu:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchSales = async () => {
    try {
      const response = await axios.get('/api/admin/sales')
      setSales(response.data)
    } catch (error) {
      console.error('Failed to fetch sales:', error)
    }
  }
  
  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/admin/settings')
      setSettings(response.data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }
  
  const handleAddItem = async () => {
    try {
      await axios.post('/api/menu', {
        ...newItem,
        price_half: newItem.price_half ? parseFloat(newItem.price_half) : null,
        price_full: parseFloat(newItem.price_full),
        prep_time_minutes: parseInt(newItem.prep_time_minutes)
      })
      fetchMenu()
      setNewItem({ name: '', description: '', category: 'veg', price_half: '', price_full: '', prep_time_minutes: 15 })
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add item:', error)
    }
  }
  
  const handleUpdateItem = async (item) => {
    try {
      await axios.put(`/api/menu/${item.id}`, item)
      fetchMenu()
      setEditingItem(null)
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }
  
  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      await axios.delete(`/api/menu/${itemId}`)
      fetchMenu()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }
  
  const handleToggleAvailability = async (item) => {
    try {
      await axios.put(`/api/menu/${item.id}/toggle`)
      fetchMenu()
    } catch (error) {
      console.error('Failed to toggle availability:', error)
    }
  }
  
  const handleUpdateSettings = async () => {
    try {
      await axios.put('/api/admin/settings', settings)
      alert('Settings updated successfully!')
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'menu', label: 'Menu Management', icon: Utensils },
    { id: 'sales', label: 'Sales Report', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700"
                >
                  <Home className="w-5 h-5" />
                </motion.button>
              </Link>
              <h1 className="text-xl font-bold">⚙️ Admin Panel</h1>
            </div>
            
            <Link to="/kitchen">
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-primary-500 rounded-xl font-medium"
              >
                Kitchen Panel
              </motion.button>
            </Link>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
              ))}
            </div>
          </div>
          
          {/* Content */}
          <div className="lg:col-span-3">
            {/* Dashboard */}
            {activeTab === 'dashboard' && dashboard && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Dashboard Overview</h2>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                  <div className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <ShoppingBag className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-gray-500 text-sm">Today's Orders</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">{dashboard.today_orders}</p>
                  </div>
                  
                  <div className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-gray-500 text-sm">Today's Revenue</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">${dashboard.today_revenue.toFixed(2)}</p>
                  </div>
                  
                  <div className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <span className="text-gray-500 text-sm">Pending Orders</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">{dashboard.pending_orders}</p>
                  </div>
                  
                  <div className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="text-gray-500 text-sm">Total Revenue</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white">${dashboard.total_revenue.toFixed(2)}</p>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="card p-6">
                  <h3 className="font-semibold mb-4 dark:text-white">Order Status Summary</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-500">{dashboard.pending_orders}</div>
                      <div className="text-sm text-gray-500">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-500">{dashboard.preparing_orders}</div>
                      <div className="text-sm text-gray-500">Preparing</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-500">{dashboard.ready_orders}</div>
                      <div className="text-sm text-gray-500">Ready</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-500">{dashboard.completed_orders}</div>
                      <div className="text-sm text-gray-500">Completed</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Menu Management */}
            {activeTab === 'menu' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold dark:text-white">Menu Management</h2>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-1" /> Add Item
                  </button>
                </div>
                
                {/* Add Item Form */}
                {showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="card p-6 mb-6"
                  >
                    <h3 className="font-semibold mb-4">Add New Menu Item</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Item Name"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="input-field"
                      />
                      <select
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        className="input-field"
                      >
                        <option value="veg">Veg</option>
                        <option value="non-veg">Non-Veg</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Half Price (optional)"
                        value={newItem.price_half}
                        onChange={(e) => setNewItem({ ...newItem, price_half: e.target.value })}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="Full Price"
                        value={newItem.price_full}
                        onChange={(e) => setNewItem({ ...newItem, price_full: e.target.value })}
                        className="input-field"
                      />
                      <input
                        type="number"
                        placeholder="Prep Time (minutes)"
                        value={newItem.prep_time_minutes}
                        onChange={(e) => setNewItem({ ...newItem, prep_time_minutes: e.target.value })}
                        className="input-field"
                      />
                      <button onClick={handleAddItem} className="btn-primary">
                        Save Item
                      </button>
                    </div>
                  </motion.div>
                )}
                
                {/* Menu Items List */}
                <div className="space-y-4">
                  {menu.map((item) => (
                    <div key={item.id} className="card p-4">
                      {editingItem?.id === item.id ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <input
                            type="text"
                            value={editingItem.name}
                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                            className="input-field"
                          />
                          <input
                            type="number"
                            value={editingItem.price_full}
                            onChange={(e) => setEditingItem({ ...editingItem, price_full: parseFloat(e.target.value) })}
                            className="input-field"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateItem(editingItem)} className="btn-success flex-1 py-2">
                              Save
                            </button>
                            <button onClick={() => setEditingItem(null)} className="btn-secondary flex-1 py-2">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`badge ${item.category === 'veg' ? 'badge-veg' : 'badge-non-veg'}`}>
                              {item.category}
                            </span>
                            <div>
                              <h3 className="font-semibold dark:text-white">{item.name}</h3>
                              <p className="text-sm text-gray-500">
                                ${item.price_full} {item.price_half && `/ $${item.price_half} half`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                item.is_available
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {item.is_available ? 'Available' : 'Unavailable'}
                            </button>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 rounded-xl bg-red-100 text-red-500 hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* Sales Report */}
            {activeTab === 'sales' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Sales Report</h2>
                
                <div className="card p-6 mb-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
                      <p className="text-3xl font-bold dark:text-white">{sales.total_orders}</p>
                      <p className="text-gray-500">Total Orders</p>
                    </div>
                    <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-xl">
                      <p className="text-3xl font-bold text-green-600">${sales.total_revenue.toFixed(2)}</p>
                      <p className="text-gray-500">Total Revenue</p>
                    </div>
                    <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <p className="text-3xl font-bold text-blue-600">
                        ${sales.total_orders > 0 ? (sales.total_revenue / sales.total_orders).toFixed(2) : '0'}
                      </p>
                      <p className="text-gray-500">Avg Order Value</p>
                    </div>
                  </div>
                </div>
                
                <div className="card p-6">
                  <h3 className="font-semibold mb-4 dark:text-white">Order History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-500 border-b">
                          <th className="pb-3">Order #</th>
                          <th className="pb-3">Table</th>
                          <th className="pb-3">Customer</th>
                          <th className="pb-3">Items</th>
                          <th className="pb-3">Total</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.orders.map((order) => (
                          <tr key={order.id} className="border-b dark:border-gray-700">
                            <td className="py-3 text-sm dark:text-white">{order.order_number}</td>
                            <td className="py-3 text-sm dark:text-white">Table {order.table_number}</td>
                            <td className="py-3 text-sm dark:text-white">{order.customer_name}</td>
                            <td className="py-3 text-sm dark:text-white">{order.items.length} items</td>
                            <td className="py-3 text-sm font-semibold dark:text-white">${order.total}</td>
                            <td className="py-3">
                              <span className={`badge ${
                                order.order_status === 'completed' ? 'badge-veg' :
                                order.order_status === 'rejected' ? 'badge-non-veg' :
                                'badge-popular'
                              }`}>
                                {order.order_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Settings */}
            {activeTab === 'settings' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Restaurant Settings</h2>
                
                <div className="card p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">Restaurant Name</label>
                    <input
                      type="text"
                      value={settings.name || ''}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Phone 1</label>
                      <input
                        type="text"
                        value={settings.phone1 || ''}
                        onChange={(e) => setSettings({ ...settings, phone1: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Phone 2</label>
                      <input
                        type="text"
                        value={settings.phone2 || ''}
                        onChange={(e) => setSettings({ ...settings, phone2: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Opening Time</label>
                      <input
                        type="text"
                        value={settings.timing_open || ''}
                        onChange={(e) => setSettings({ ...settings, timing_open: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Closing Time</label>
                      <input
                        type="text"
                        value={settings.timing_close || ''}
                        onChange={(e) => setSettings({ ...settings, timing_close: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">Address</label>
                    <textarea
                      value={settings.address || ''}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      rows="3"
                      className="input-field resize-none"
                    />
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Razorpay Key ID</label>
                      <input
                        type="text"
                        value={settings.razorpay_key_id || ''}
                        onChange={(e) => setSettings({ ...settings, razorpay_key_id: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-300">Razorpay Key Secret</label>
                      <input
                        type="password"
                        value={settings.razorpay_key_secret || ''}
                        onChange={(e) => setSettings({ ...settings, razorpay_key_secret: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  
                  <button onClick={handleUpdateSettings} className="btn-primary">
                    Save Settings
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

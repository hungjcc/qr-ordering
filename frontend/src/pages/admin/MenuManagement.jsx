import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Edit, Trash2, Eye, EyeOff, Filter,
  ChevronDown, X
} from 'lucide-react'
import {
  getMenu, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability, resetMenu
} from '../../lib/api'
import { useToastStore } from '../../store/store'

const categories = [
  { id: 'all', name: '全部' },
  { id: 'soups', name: '湯品與粥品' },
  { id: 'starters', name: '小食' },
  { id: 'main_course', name: '主食' },
  { id: 'biryani', name: '港式飯類' },
  { id: 'rice_noodles', name: '飯類與粉麵' },
  { id: 'rolls', name: '三文治與卷類' },
  { id: 'breads', name: '包點與多士' },
  { id: 'combos', name: '套餐' },
  { id: 'beverages', name: '飲品' },
]

export default function MenuManagement() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const { addToast } = useToastStore()

  const fetchMenu = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMenu({ category: selectedCategory !== 'all' ? selectedCategory : undefined })
      setMenu(data || [])
    } catch (error) {
      console.error('Failed to fetch menu:', error)
      addToast({ type: 'error', message: '載入菜單失敗' })
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, addToast])

  useEffect(() => { fetchMenu() }, [fetchMenu])

  const handleResetMenu = async () => {
    if (!window.confirm('這會將菜單重設為預設內容，是否繼續？')) return
    try {
      const result = await resetMenu()
      addToast({ type: 'success', message: result.message })
      fetchMenu()
    } catch (error) {
      addToast({ type: 'error', message: '重設菜單失敗' })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此品項嗎？')) return
    try {
      await deleteMenuItem(id)
      addToast({ type: 'success', message: '品項刪除成功' })
      fetchMenu()
    } catch (error) {
      addToast({ type: 'error', message: '刪除品項失敗' })
    }
  }

  const handleToggleAvailability = async (id) => {
    try {
      await toggleMenuItemAvailability(id)
      addToast({ type: 'success', message: '供應狀態已更新' })
      fetchMenu()
    } catch (error) {
      addToast({ type: 'error', message: '更新供應狀態失敗' })
    }
  }

  const filteredMenu = menu.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">菜單管理</h1>
          <p className="text-gray-500">管理餐廳菜單品項</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetMenu}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            重設菜單
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            <Plus className="w-5 h-5" />
            新增品項
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋品項..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 skeleton rounded-xl" />
          ))}
        </div>
      ) : filteredMenu.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500">找不到品項</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMenu.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item.id)}
              onToggle={() => handleToggleAvailability(item.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingItem) && (
          <MenuModal
            item={editingItem}
            onClose={() => {
              setShowAddModal(false)
              setEditingItem(null)
            }}
            onSave={() => {
              setShowAddModal(false)
              setEditingItem(null)
              fetchMenu()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuCard({ item, onEdit, onDelete, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border ${!item.is_available ? 'border-red-200' : 'border-transparent'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.is_vegetarian ? '🥬' : '🍗'}</span>
          <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
        </div>
        <button onClick={onToggle} className="p-1">
          {item.is_available ? (
            <Eye className="w-4 h-4 text-green-500" />
          ) : (
            <EyeOff className="w-4 h-4 text-red-500" />
          )}
        </button>
      </div>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{item.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {item.has_half_full ? (
            <div className="flex gap-2 text-gray-600 dark:text-gray-300">
              <span>半份：${item.price_half}</span>
              <span>|</span>
              <span>全份：${item.price_full}</span>
            </div>
          ) : (
            <span className="font-bold text-primary-600">${item.price}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function MenuModal({ item, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price || '',
    price_half: item?.price_half || '',
    price_full: item?.price_full || '',
    category_id: item?.category_id || 1,
    subcategory: item?.subcategory || '',
    is_vegetarian: item?.is_vegetarian || false,
    has_half_full: item?.has_half_full || false,
    preparation_time: item?.preparation_time || 15,
  })
  const [loading, setLoading] = useState(false)
  const { addToast } = useToastStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price) || null,
        price_half: parseFloat(formData.price_half) || null,
        price_full: parseFloat(formData.price_full) || null,
        category_id: parseInt(formData.category_id),
        preparation_time: parseInt(formData.preparation_time),
      }

      if (item) {
        await updateMenuItem(item.id, data)
        addToast({ type: 'success', message: '品項更新成功' })
      } else {
        await createMenuItem(data)
        addToast({ type: 'success', message: '品項建立成功' })
      }
      onSave()
    } catch (error) {
      addToast({ type: 'error', message: '儲存品項失敗' })
    } finally {
      setLoading(false)
    }
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
        className="relative bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {item ? '編輯品項' : '新增品項'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名稱</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">價格</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                disabled={formData.has_half_full}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">製作時間（分鐘）</label>
              <input
                type="number"
                value={formData.preparation_time}
                onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">半份價格</label>
              <input
                type="number"
                value={formData.price_half}
                onChange={(e) => setFormData({ ...formData, price_half: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                disabled={!formData.has_half_full}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">全份價格</label>
              <input
                type="number"
                value={formData.price_full}
                onChange={(e) => setFormData({ ...formData, price_full: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                disabled={!formData.has_half_full}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.has_half_full}
                onChange={(e) => setFormData({ ...formData, has_half_full: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">有半份／全份</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_vegetarian}
                onChange={(e) => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">素食</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

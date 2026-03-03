/**
 * 熊熊冰室 - API Client
 * Production-ready API client with error handling and loading states
 */

// Get the API base URL dynamically based on the current host
function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  
  // If running on mobile or external device, use the current host
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname
    // If hostname is not localhost, use it for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`
    }
  }
  return 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()

// Helper for fetch with error handling
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }
  
  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP error ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error)
    throw error
  }
}

// ===================== Health Check =====================

export async function checkHealth() {
  return fetchAPI('/api/health')
}

// ===================== Categories =====================

export async function getCategories() {
  return fetchAPI('/api/categories')
}

export async function createCategory(data) {
  return fetchAPI('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCategory(id, data) {
  return fetchAPI(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCategory(id) {
  return fetchAPI(`/api/categories/${id}`, {
    method: 'DELETE',
  })
}

// ===================== Menu =====================

export async function getMenu(params = {}) {
  const queryString = new URLSearchParams(params).toString()
  return fetchAPI(`/api/menu${queryString ? `?${queryString}` : ''}`)
}

export async function getMenuItem(id) {
  return fetchAPI(`/api/menu/${id}`)
}

export async function createMenuItem(data) {
  return fetchAPI('/api/menu', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateMenuItem(id, data) {
  return fetchAPI(`/api/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteMenuItem(id) {
  return fetchAPI(`/api/menu/${id}`, {
    method: 'DELETE',
  })
}

export async function toggleMenuItemAvailability(id) {
  return fetchAPI(`/api/menu/${id}/toggle-availability`, {
    method: 'PUT',
  })
}

export async function seedMenu() {
  return fetchAPI('/api/menu/seed', {
    method: 'POST',
  })
}

export async function resetMenu() {
  return fetchAPI('/api/menu/reset', {
    method: 'POST',
  })
}

// ===================== Tables =====================

export async function getTables() {
  return fetchAPI('/api/tables')
}

export async function createTable(data) {
  return fetchAPI('/api/tables', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTable(id, data) {
  return fetchAPI(`/api/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function updateTableStatus(id, status) {
  return fetchAPI(`/api/tables/${id}/status?status=${status}`, {
    method: 'PUT',
  })
}

export async function deleteTable(id) {
  return fetchAPI(`/api/tables/${id}`, {
    method: 'DELETE',
  })
}

// ===================== Discounts =====================

export async function getDiscounts() {
  return fetchAPI('/api/discounts')
}

export async function createDiscount(data) {
  return fetchAPI('/api/discounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function validateDiscount(code, orderAmount) {
  return fetchAPI(`/api/discounts/validate?code=${code}&order_amount=${orderAmount}`)
}

export async function deleteDiscount(id) {
  return fetchAPI(`/api/discounts/${id}`, {
    method: 'DELETE',
  })
}

// ===================== Orders =====================

export async function getOrders(params = {}) {
  const queryString = new URLSearchParams(params).toString()
  return fetchAPI(`/api/orders${queryString ? `?${queryString}` : ''}`)
}

export async function getOrder(id) {
  return fetchAPI(`/api/orders/${id}`)
}

export async function getOrderByNumber(orderNumber) {
  return fetchAPI(`/api/orders/number/${orderNumber}`)
}

export async function createOrder(data) {
  return fetchAPI('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateOrderStatus(id, status) {
  return fetchAPI(`/api/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

// ===================== Kitchen =====================

export async function getKitchenOrders(status = null) {
  const queryString = status ? `?status=${status}` : ''
  return fetchAPI(`/api/kitchen/orders${queryString}`)
}

export async function getKitchenStats() {
  return fetchAPI('/api/kitchen/stats')
}

// ===================== Payment =====================

export async function createPaymentOrder(orderId, amount) {
  return fetchAPI('/api/payment/create-order', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, amount }),
  })
}

export async function verifyPayment(data) {
  return fetchAPI('/api/payment/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ===================== Admin =====================

export async function getAdminStats() {
  return fetchAPI('/api/admin/stats')
}

export async function getSalesReport(params = {}) {
  const queryString = new URLSearchParams(params).toString()
  return fetchAPI(`/api/admin/sales${queryString ? `?${queryString}` : ''}`)
}

export async function getAnalytics(period = 'daily') {
  return fetchAPI(`/api/admin/analytics?period=${period}`)
}

export async function getPricingSettings() {
  return fetchAPI('/api/admin/pricing-settings')
}

export async function updatePricingSettings(data) {
  return fetchAPI('/api/admin/pricing-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function exportData(format = 'csv') {
  const url = `${API_BASE_URL}/api/admin/export?format=${format}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error('Export failed')
  }
  
  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition')
  const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `report.${format}`
  
  return { blob, filename }
}

// ===================== Order Status =====================

export async function trackOrder(orderNumber) {
  return fetchAPI(`/api/order/track/${orderNumber}`)
}

export async function getBill(orderNumber) {
  return fetchAPI(`/api/order/bill/${orderNumber}`)
}

// ===================== QR Codes =====================

export async function generateQRCode(tableNumber) {
  const url = `${API_BASE_URL}/api/admin/generate-qr/${tableNumber}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error('QR generation failed')
  }
  
  return response.blob()
}

export async function generateAllQRCodes(maxTables = 20) {
  return fetchAPI(`/api/admin/generate-all-qr?max_tables=${maxTables}`)
}

export default {
  checkHealth,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  seedMenu,
  resetMenu,
  getTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
  getDiscounts,
  createDiscount,
  validateDiscount,
  deleteDiscount,
  getOrders,
  getOrder,
  getOrderByNumber,
  createOrder,
  updateOrderStatus,
  getKitchenOrders,
  getKitchenStats,
  createPaymentOrder,
  verifyPayment,
  getAdminStats,
  getSalesReport,
  getAnalytics,
  getPricingSettings,
  updatePricingSettings,
  exportData,
  trackOrder,
  getBill,
  generateQRCode,
  generateAllQRCodes,
}

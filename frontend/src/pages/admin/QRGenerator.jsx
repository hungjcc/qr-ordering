import { useState } from 'react'
import { motion } from 'framer-motion'
import { QrCode, Download, Printer, Copy, Check } from 'lucide-react'
import { useToastStore } from '../../store/store'

export default function QRGenerator() {
  const [selectedTable, setSelectedTable] = useState(1)
  const [copied, setCopied] = useState(false)
  const { addToast } = useToastStore()

  const baseUrl = window.location.origin
  const menuUrl = `${baseUrl}/order/${selectedTable}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      addToast({ type: 'success', message: '網址已複製到剪貼簿！' })
    } catch (error) {
      addToast({ type: 'error', message: '複製網址失敗' })
    }
  }

  const printQR = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>桌位 ${selectedTable} QR Code</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            h1 { margin-bottom: 20px; }
            img { max-width: 300px; }
            p { color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>桌位 ${selectedTable}</h1>
          <img src="${generateQRCode(menuUrl)}" alt="QR Code" />
          <p>掃描即可查看菜單並下單</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const downloadQR = () => {
    const link = document.createElement('a')
    link.href = generateQRCode(menuUrl)
    link.download = `table-${selectedTable}-qr.png`
    link.click()
    addToast({ type: 'success', message: 'QR Code 已下載！' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Code 產生器</h1>
        <p className="text-gray-500">產生桌位菜單 QR Code</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            選擇桌位
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {[...Array(10)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setSelectedTable(i + 1)}
                className={`p-3 rounded-lg font-semibold transition-all ${
                  selectedTable === i + 1
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm flex flex-col items-center"
        >
          <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200">
            <img
              src={generateQRCode(menuUrl)}
              alt={`桌位 ${selectedTable} QR Code`}
              className="w-48 h-48"
            />
          </div>
          <p className="mt-4 text-center text-gray-500 text-sm">
            掃描後可於桌位 {selectedTable} 下單
          </p>
        </motion.div>
      </div>

      {/* URL & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          菜單網址
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={menuUrl}
            readOnly
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          />
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            {copied ? '已複製！' : '複製'}
          </button>
        </div>
      </div>

      {/* Download Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          下載選項
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((table) => (
            <button
              key={table}
              onClick={() => {
                setSelectedTable(table)
                setTimeout(downloadQR, 100)
              }}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <QrCode className="w-5 h-5 text-primary-500" />
              <span className="text-sm text-gray-900 dark:text-white">桌位 {table}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Print Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          使用方式
        </h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>從上方選擇桌號</li>
          <li>下載或列印 QR Code</li>
          <li>將 QR Code 放置在對應桌位</li>
          <li>顧客掃描後可查看菜單並下單</li>
        </ol>
      </div>
    </div>
  )
}

// Simple QR code generator using API
function generateQRCode(url) {
  const size = 300
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`
}

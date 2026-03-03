import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { getPricingSettings, updatePricingSettings } from '../../lib/api'
import { useToastStore } from '../../store/store'

const defaultForm = {
  lunch_start: '11:00',
  lunch_end: '15:00',
  lunch_discount_pct: 10,
  dinner_start: '18:00',
  dinner_end: '22:00',
  dinner_surcharge_pct: 10,
}

export default function Settings() {
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToastStore()

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await getPricingSettings()
      setForm({
        lunch_start: data.lunch_start || '11:00',
        lunch_end: data.lunch_end || '15:00',
        lunch_discount_pct: data.lunch_discount_pct ?? 10,
        dinner_start: data.dinner_start || '18:00',
        dinner_end: data.dinner_end || '22:00',
        dinner_surcharge_pct: data.dinner_surcharge_pct ?? 10,
      })
    } catch (error) {
      addToast({ type: 'error', message: '載入定價設定失敗' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        ...form,
        lunch_discount_pct: Number(form.lunch_discount_pct),
        dinner_surcharge_pct: Number(form.dinner_surcharge_pct),
      }
      await updatePricingSettings(payload)
      addToast({ type: 'success', message: '時段定價設定已更新' })
      loadSettings()
    } catch (error) {
      addToast({ type: 'error', message: error.message || '儲存設定失敗' })
    } finally {
      setSaving(false)
    }
  }

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return <div className="text-gray-500">載入設定中...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">定價設定</h1>
        <p className="text-gray-500">設定套餐午市/晚市時段與加減幅，儲存後即時生效。</p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">午市設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">開始時間</span>
              <input
                type="time"
                value={form.lunch_start}
                onChange={(e) => onChange('lunch_start', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">結束時間</span>
              <input
                type="time"
                value={form.lunch_end}
                onChange={(e) => onChange('lunch_end', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">優惠百分比 (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.lunch_discount_pct}
                onChange={(e) => onChange('lunch_discount_pct', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">晚市設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">開始時間</span>
              <input
                type="time"
                value={form.dinner_start}
                onChange={(e) => onChange('dinner_start', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">結束時間</span>
              <input
                type="time"
                value={form.dinner_end}
                onChange={(e) => onChange('dinner_end', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-300">加幅百分比 (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.dinner_surcharge_pct}
                onChange={(e) => onChange('dinner_surcharge_pct', e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </form>
    </div>
  )
}

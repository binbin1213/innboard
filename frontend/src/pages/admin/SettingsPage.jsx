import { useEffect, useRef, useState } from 'react'
import { api, clearToken, uploadFile } from '../../api'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
  const [form, setForm] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const logoInputRef = useRef(null)
  const qrInputRef = useRef(null)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/api/settings', true).then((res) => {
      setForm({
        hotel_name: res.hotel_name,
        carousel_interval: String(res.carousel_interval),
        weather_api_key: res.weather_api_key,
        weather_city: res.weather_city,
      })
      setLogoUrl(res.logo_url)
      setQrUrl(res.qr_url)
    })
  }, [])

  const save = async () => {
    const interval = Number(form.carousel_interval)
    if (!form.hotel_name.trim()) return setError('酒店名称不能为空')
    if (Number.isNaN(interval) || interval < 3 || interval > 60) {
      return setError('轮播间隔需在 3～60 秒之间')
    }
    setError('')
    setSaving(true)
    try {
      await api.put('/api/settings', { ...form, carousel_interval: interval }, true)
      setMessage('保存成功，展示页将在 30 秒内自动更新')
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onLogo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadFile('/api/settings/logo', file)
      setLogoUrl(res.logo_url)
      setMessage('LOGO 已更新')
    } catch (err) {
      setError(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const onQr = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadFile('/api/settings/qr', file)
      setQrUrl(res.qr_url)
      setMessage('二维码已更新，展示页将自动显示')
    } catch (err) {
      setError(err.message)
    } finally {
      e.target.value = ''
    }
  }

  const changePassword = async () => {
    setPwdMsg('')
    if (newPwd.length < 6) return setPwdMsg('新密码至少 6 位')
    if (newPwd !== confirmPwd) return setPwdMsg('两次输入的新密码不一致')
    try {
      await api.post('/api/auth/change-password', { old_password: oldPwd, new_password: newPwd }, true)
      clearToken()
      nav('/admin/login')
    } catch (e) {
      setPwdMsg(e.message)
    }
  }

  if (!form) return null

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-4">系统设置</h2>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-bold mb-4">基础设置</h3>
        {message && <div className="bg-green-50 text-green-700 rounded-lg px-4 py-2 mb-4 text-sm">{message}</div>}
        {error && <div className="bg-red-50 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm">{error}</div>}
        <label className="block text-sm text-gray-600 mb-1">酒店名称</label>
        <input
          value={form.hotel_name}
          onChange={(e) => setForm({ ...form, hotel_name: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm text-gray-600 mb-1">轮播间隔（秒，3～60）</label>
        <input
          type="number"
          min="3"
          max="60"
          value={form.carousel_interval}
          onChange={(e) => setForm({ ...form, carousel_interval: e.target.value })}
          className="w-40 border rounded-lg px-3 py-2 mb-6"
        />
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium"
        >
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-bold mb-4">酒店 LOGO</h3>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-16 w-16 object-contain border rounded-lg bg-gray-50 p-1" />
          ) : (
            <div className="h-16 w-16 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
              无
            </div>
          )}
          <button
            onClick={() => logoInputRef.current?.click()}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            上传 LOGO
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-bold mb-1">自助下单二维码</h3>
        <p className="text-sm text-gray-500 mb-4">上传后展示页右下角显示"扫码订房"，不上传则不显示。</p>
        <div className="flex items-center gap-4">
          {qrUrl ? (
            <img src={qrUrl} alt="二维码" className="h-16 w-16 object-contain border rounded-lg bg-gray-50 p-1" />
          ) : (
            <div className="h-16 w-16 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
              无
            </div>
          )}
          <button
            onClick={() => qrInputRef.current?.click()}
            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            上传二维码
          </button>
          <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={onQr} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-bold mb-1">天气设置</h3>
        <p className="text-sm text-gray-500 mb-4">
          使用和风天气 API。前往 dev.qweather.com 免费申请 Key，未配置时展示页不显示天气。
        </p>
        <label className="block text-sm text-gray-600 mb-1">城市（如：北京）</label>
        <input
          value={form.weather_city}
          onChange={(e) => setForm({ ...form, weather_city: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm text-gray-600 mb-1">和风天气 API Key</label>
        <input
          value={form.weather_api_key}
          onChange={(e) => setForm({ ...form, weather_api_key: e.target.value })}
          className="w-full border rounded-lg px-3 py-2"
        />
        <div className="mt-4">
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium"
          >
            保存设置
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold mb-4">修改登录密码</h3>
        {pwdMsg && <div className="bg-red-50 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm">{pwdMsg}</div>}
        <label className="block text-sm text-gray-600 mb-1">原密码</label>
        <input
          type="password"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm text-gray-600 mb-1">新密码（至少 6 位）</label>
        <input
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
        <input
          type="password"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <button
          onClick={changePassword}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 font-medium"
        >
          修改密码
        </button>
      </div>
    </div>
  )
}

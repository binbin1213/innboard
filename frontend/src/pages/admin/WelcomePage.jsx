import { useEffect, useRef, useState } from 'react'
import { api, uploadFile } from '../../api'

export default function WelcomePage() {
  const [form, setForm] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef(null)

  const load = () => {
    api
      .get('/api/welcome', true)
      .then((data) => {
        setForm({
          enabled: data.enabled,
          title: data.title,
          subtitle: data.subtitle,
          message: data.message,
          end_time: data.end_time,
        })
        setImageUrl(data.image_url)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(load, [])

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api.put('/api/welcome', form, true)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadFile('/api/welcome/image', file)
      setSaved(true)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = async () => {
    if (!confirm('确定删除当前欢迎背景图？')) return
    setError('')
    try {
      await api.del('/api/welcome/image', true)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (!form) {
    return <div className="text-gray-500">加载中…</div>
  }
  const inputCls =
    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">欢迎致辞</h2>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="text-sm text-gray-500 mb-4">
          接待团队入住或会议时，在大屏图片区显示欢迎致辞。支持填写文字和上传背景图（两者可同时使用），
          可设置结束时间，到期自动恢复图片轮播。
        </p>

        {/* 开关 */}
        <label className="flex items-center gap-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="w-5 h-5 accent-green-600"
          />
          <span className="font-medium">启用欢迎致辞（大屏显示）</span>
        </label>

        {/* 三段文字 */}
        <div className="grid gap-4 mb-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1">主标题（大字，如"热烈欢迎"）</label>
            <input
              className={inputCls}
              value={form.title}
              maxLength={30}
              placeholder="热烈欢迎"
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">副标题（金色，如"XX旅行社贵宾团莅临"）</label>
            <input
              className={inputCls}
              value={form.subtitle}
              maxLength={40}
              placeholder="XX旅行社贵宾团莅临"
              onChange={(e) => set('subtitle', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">落款（白色小字，如"祝您入住愉快，旅途平安"）</label>
            <input
              className={inputCls}
              value={form.message}
              maxLength={60}
              placeholder="祝您入住愉快，旅途平安"
              onChange={(e) => set('message', e.target.value)}
            />
          </div>
        </div>

        {/* 结束时间 */}
        <div className="mb-5">
          <label className="block text-sm text-gray-600 mb-1">
            结束时间（选填，到期自动恢复图片轮播；留空则一直显示直到手动关闭）
          </label>
          <input
            type="datetime-local"
            className={inputCls + ' w-64'}
            value={form.end_time}
            onChange={(e) => set('end_time', e.target.value)}
          />
        </div>

        {/* 背景图 */}
        <div className="mb-5">
          <label className="block text-sm text-gray-600 mb-1">背景图（选填，欢迎文字叠加显示在图片上）</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              {uploading ? '上传中…' : '上传背景图'}
            </button>
            {imageUrl && (
              <button
                onClick={removeImage}
                className="text-red-500 text-sm hover:text-red-700"
              >
                删除背景图
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </div>
          <span className="text-xs text-gray-400 mt-1 inline-block">
            支持 jpg / png / webp / gif，不超过 20MB，建议宽屏图片（如 1920×1080）
          </span>
          {imageUrl && (
            <div className="mt-3">
              <img src={imageUrl} alt="欢迎背景图" className="h-40 rounded-lg object-cover border" />
            </div>
          )}
        </div>

        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          {saved && <span className="text-green-600 text-sm">已保存 ✓</span>}
        </div>
      </div>

      {/* 预览 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">大屏预览</h3>
        <div className="relative h-56 rounded-xl overflow-hidden bg-[#0b1220] border">
          {form.enabled ? (
            <>
              {imageUrl ? (
                <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0d1a30] to-[#1a2b4a]" />
              )}
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute top-3 inset-x-0 text-center text-[#D4AF37] tracking-[0.4em] text-xs">
                WELCOME
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                <div className="text-[#E8C872] font-black text-4xl" style={{ letterSpacing: 4 }}>
                  {form.title || '热烈欢迎'}
                </div>
                {form.subtitle && <div className="mt-2 text-[#DE2910] text-2xl font-black">{form.subtitle}</div>}
                {form.message && <div className="mt-2 text-white/90 text-sm">{form.message}</div>}
              </div>
              <div className="absolute bottom-2 right-3 text-[#E8C872]/85 text-xs tracking-[0.3em]">
                柏维酒店
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              欢迎致辞未启用
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


import { useEffect, useRef, useState } from 'react'
import { api, uploadFile } from '../../api'
import ConfirmModal from '../../components/ConfirmModal'

export default function WelcomePage() {
  const [form, setForm] = useState(null)
  const [hotelName, setHotelName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const previewRef = useRef(null)
  const [previewW, setPreviewW] = useState(0)

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
          title_font: data.title_font || 0,
          subtitle_font: data.subtitle_font || 0,
          bg_mode: data.bg_mode || 'image',
          video_fullscreen: data.video_fullscreen !== false,
        })
        setImageUrl(data.image_url)
        setVideoUrl(data.video_url || '')
        setHotelName(data.hotel_name || '')
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
    setError('')
    try {
      await api.del('/api/welcome/image', true)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const update = () => setPreviewW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [form])

  if (!form) {
    return <div className="text-gray-500">加载中…</div>
  }
  const onUploadVideo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingVideo(true)
    setError('')
    try {
      const res = await uploadFile('/api/welcome/video', file)
      setVideoUrl(res.video_url)
      set('bg_mode', 'video')
    } catch (err) {
      setError(err.message || '视频上传失败')
    } finally {
      setUploadingVideo(false)
      if (videoRef.current) videoRef.current.value = ''
    }
  }

  const removeVideo = async () => {
    try {
      await api.del('/api/welcome/video')
      setVideoUrl('')
      set('bg_mode', 'image')
    } catch (err) {
      setError(err.message || '删除视频失败')
    }
  }

  const inputCls =
    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500'
  // 与展示端一致的字号分档（未自定义时用它）
  const vlen = (v) => String(v || '').replace(/\n/g, '').length
  const autoTitle = vlen(form.title) > 10 ? 92 : vlen(form.title) > 6 ? 108 : 126
  const autoSubtitle = vlen(form.subtitle) > 12 ? 68 : vlen(form.subtitle) > 8 ? 80 : 96
  const autoMessage = vlen(form.message) > 24 ? 36 : vlen(form.message) > 14 ? 42 : 50
  const titleFont = Number(form.title_font) > 0 ? Number(form.title_font) : autoTitle
  const subtitleFont = Number(form.subtitle_font) > 0 ? Number(form.subtitle_font) : autoSubtitle
  // 大屏横幅文字可用宽 920px（横幅 1000 − 内边距 40×2）
  const widest = (text, font, spacing) =>
    String(text || '')
      .split('\n')
      .reduce((m, line) => Math.max(m, [...line].length * (font + spacing)), 0)
  // 预览缩放：真实横幅 1000×565 → 预览容器实测宽度的等比缩放
  const sc = previewW > 0 ? Math.min(1, previewW / 1000) : 0.6
  const isVideo = (form.bg_mode || 'image') === 'video' && !!videoUrl

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

        {/* 三段文字：支持回车手动换行，大屏按你的断点显示 */}
        <div className="grid gap-4 mb-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1">主标题（中国红大字，如"热烈欢迎"）</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              value={form.title}
              maxLength={30}
              placeholder="热烈欢迎"
              onChange={(e) => set('title', e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-green-600"
                  checked={Number(form.title_font) > 0}
                  onChange={(e) => set('title_font', e.target.checked ? autoTitle : 0)}
                />
                自定义字号
              </label>
              {Number(form.title_font) > 0 ? (
                <>
                  <input
                    type="range"
                    min="40"
                    max="220"
                    step="2"
                    className="w-52 accent-green-600"
                    value={form.title_font}
                    onChange={(e) => set('title_font', Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-700 w-12">{form.title_font}px</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">自动（按字数：当前 {autoTitle}px）</span>
              )}
            </div>
            {Number(form.title_font) > 0 && widest(form.title, Number(form.title_font), 8) > 920 && (
              <span className="text-xs text-red-500 block">
                ⚠️ 最长一行约 {widest(form.title, Number(form.title_font), 8)}px，超出可用宽 920px，大屏上会折行
              </span>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">副标题（金色大字，如"XX旅行社贵宾团莅临"）</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
              value={form.subtitle}
              maxLength={40}
              placeholder="XX旅行社贵宾团莅临"
              onChange={(e) => set('subtitle', e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-green-600"
                  checked={Number(form.subtitle_font) > 0}
                  onChange={(e) => set('subtitle_font', e.target.checked ? autoSubtitle : 0)}
                />
                自定义字号
              </label>
              {Number(form.subtitle_font) > 0 ? (
                <>
                  <input
                    type="range"
                    min="40"
                    max="180"
                    step="2"
                    className="w-52 accent-green-600"
                    value={form.subtitle_font}
                    onChange={(e) => set('subtitle_font', Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-700 w-12">{form.subtitle_font}px</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">自动（按字数：当前 {autoSubtitle}px）</span>
              )}
            </div>
            {Number(form.subtitle_font) > 0 && widest(form.subtitle, Number(form.subtitle_font), 6) > 920 && (
              <span className="text-xs text-red-500 block">
                ⚠️ 最长一行约 {widest(form.subtitle, Number(form.subtitle_font), 6)}px，超出可用宽 920px，大屏上会折行
              </span>
            )}
            <span className="text-xs text-gray-400">
              勾选「自定义字号」后拖滑块即可自己定字号；不勾则按字数自动分档（主 126/108/92，副 96/80/68，回车不计入字数）。
              想控制断点位置（如"鎏金万像五部连拍／杀青晚宴"）直接按回车换行。
            </span>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">落款（白色小字，如"祝您入住愉快，旅途平安"）</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={2}
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

        {/* 大屏背景：图片 / 视频 二选一 */}
        <div className="mb-5">
          <label className="block text-sm text-gray-600 mb-1">大屏背景</label>
          <div className="flex flex-wrap items-center gap-5 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                className="accent-green-600"
                checked={(form.bg_mode || 'image') !== 'video'}
                onChange={() => set('bg_mode', 'image')}
              />
              图片 / 渐变 + 文字
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                className="accent-green-600"
                checked={(form.bg_mode || 'image') === 'video'}
                onChange={() => set('bg_mode', 'video')}
              />
              视频（整屏只播视频，不显示任何其他内容）
            </label>
          </div>

          {(form.bg_mode || 'image') === 'video' ? (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => videoRef.current?.click()}
                  disabled={uploadingVideo}
                  className="btn-gold"
                >
                  {uploadingVideo ? '上传中…' : videoUrl ? '更换视频' : '上传视频'}
                </button>
                {videoUrl && (
                  <button onClick={removeVideo} className="text-danger text-sm hover:text-red-700">
                    删除视频
                  </button>
                )}
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={onUploadVideo}
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-green-600"
                  checked={form.video_fullscreen !== false}
                  onChange={(e) => set('video_fullscreen', e.target.checked)}
                />
                整屏独占播放（隐藏时钟、房态卡片等全部内容）
              </label>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                建议 H.264 编码的 mp4，720p / 1080p，≤ 30MB；大屏静音循环播放。
                <br />
                视频模式下主标题、副标题、落款、遮罩全部不显示——只播视频。
              </p>
              {videoUrl && (
                <video
                  src={videoUrl}
                  className="mt-3 h-40 rounded-lg border bg-black"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="btn-gold"
                >
                  {uploading ? '上传中…' : '上传背景图'}
                </button>
                {imageUrl && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-danger text-sm hover:text-red-700"
                  >
                    删除背景图
                  </button>
                )}
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
              </div>
              {imageUrl && (
                <div className="mt-2">
                  <img src={imageUrl} alt="欢迎背景图" className="h-40 rounded-lg object-cover border" />
                </div>
              )}
            </div>
          )}
        </div>


        {error && <div className="text-danger text-sm mb-3">{error}</div>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          {saved && <span className="text-green-600 text-sm">已保存 ✓</span>}
        </div>
      </div>
      {/* 预览：按真实横幅比例缩放（真实 1000×565），字号/字距同步缩放，所见即所得 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">大屏预览</h3>
        <div ref={previewRef} className="w-full">
          {form.enabled ? (
            <div
              className="relative rounded-2xl overflow-hidden bg-black/20 mx-auto"
              style={{ width: Math.round(1000 * sc), height: Math.round(565 * sc) }}
            >
              {isVideo ? (
                <video
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : imageUrl ? (
                <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#080f1c] via-[#0b1220] to-[#141f36]" />
              )}
              {!isVideo && (
                <>
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-x-0 flex items-center justify-center" style={{ top: 20 * sc, gap: 20 * sc }}>
                <span className="bg-[#D4AF37]/70" style={{ height: 2 * sc, width: 80 * sc }} />
                <span
                  className="text-[#D4AF37]"
                  style={{ fontSize: 32 * sc, letterSpacing: 0.6 * 32 * sc, paddingLeft: 0.6 * 32 * sc }}
                >
                  WELCOME
                </span>
                <span className="bg-[#D4AF37]/70" style={{ height: 2 * sc, width: 80 * sc }} />
              </div>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
                style={{ paddingLeft: 40 * sc, paddingRight: 40 * sc }}
              >
                <div
                  style={{
                    fontFamily: '"Source Han Serif SC", "思源宋体", "Noto Serif SC", serif',
                    fontSize: titleFont * sc,
                    fontWeight: 900,
                    letterSpacing: 8 * sc,
                    lineHeight: 1.15,
                    color: '#DE2910',
                    whiteSpace: 'pre-line',
                    textShadow: '0 4px 24px rgba(0,0,0,0.55)',
                  }}
                >
                  {form.title || '热烈欢迎'}
                </div>
                {form.subtitle && (
                  <div
                    style={{
                      marginTop: 16 * sc,
                      fontSize: subtitleFont * sc,
                      fontWeight: 900,
                      letterSpacing: 6 * sc,
                      lineHeight: 1.15,
                      color: '#E8C872',
                      whiteSpace: 'pre-line',
                      textShadow: '0 3px 18px rgba(0,0,0,0.6)',
                    }}
                  >
                    {form.subtitle}
                  </div>
                )}
                {form.message && (
                  <div
                    style={{
                      marginTop: 12 * sc,
                      fontSize: autoMessage * sc,
                      letterSpacing: 3 * sc,
                      color: 'rgba(255,255,255,0.92)',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {form.message}
                  </div>
                )}
              </div>
              <div
                className="absolute text-right"
                style={{
                  right: 24 * sc,
                  bottom: 12 * sc,
                  fontSize: 28 * sc,
                  letterSpacing: 4 * sc,
                  color: 'rgba(232,200,114,0.85)',
                }}
              >
                {hotelName || '酒店名称'}
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-56 rounded-xl overflow-hidden bg-[#0b1220] border flex items-center justify-center text-gray-400 text-sm">
              欢迎致辞未启用
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          预览按真实比例缩放（大屏横幅实际 1000×565，文字可用宽 920px），字号所见即所得。
        </p>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="删除背景图"
        message="确定删除当前欢迎背景图？"
        confirmText="删除"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await removeImage()
          setShowDeleteConfirm(false)
        }}
      />
    </div>
  )
}


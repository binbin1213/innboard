import { useEffect, useRef, useState } from 'react'
import { api, uploadFile } from '../../api'
import ConfirmModal from '../../components/ConfirmModal'

export default function ImagesPage() {
  const [images, setImages] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const inputRef = useRef(null)

  const load = () => {
    api.get('/api/images', true).then(setImages).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    setError('')
    try {
      for (const file of files) {
        await uploadFile('/api/images', file)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const move = async (index, direction) => {
    const ids = images.map((img) => img.id)
    const target = index + direction
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await api.post('/api/images/reorder', { ids }, true)
    load()
  }

  const remove = async (id) => {
    await api.del(`/api/images/${id}`, true)
    load()
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">图片管理</h2>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="mb-5">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-gold"
          >
            {uploading ? '上传中…' : '上传图片'}
          </button>
          <span className="text-sm text-gray-500 ml-3">
            支持 jpg / png / webp / gif，单张不超过 20MB，建议分辨率不低于 1920×1080
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onUpload}
          />
        </div>
        {error && <div className="text-danger text-sm mb-4">{error}</div>}
        <div className="grid grid-cols-3 gap-4">
          {images?.map((img, i) => (
            <div key={img.id} className="border rounded-lg overflow-hidden bg-gray-50">
              <div className="h-40 overflow-hidden bg-black">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-xs text-gray-400">第 {i + 1} 张</span>
                <div className="flex gap-2">
                  <button
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="px-2 py-1 border rounded text-sm disabled:opacity-30 hover:bg-gray-100"
                  >
                    ←
                  </button>
                  <button
                    disabled={i === images.length - 1}
                    onClick={() => move(i, 1)}
                    className="px-2 py-1 border rounded text-sm disabled:opacity-30 hover:bg-gray-100"
                  >
                    →
                  </button>
                  <button onClick={() => setPendingDelete(img)} className="px-2 py-1 text-danger text-sm hover:text-red-700">
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {images === null ? (
          <div className="text-gray-400 text-center py-12">加载中…</div>
        ) : images.length === 0 ? (
          <div className="text-gray-400 text-center py-12">暂无图片，请上传酒店宣传图片</div>
        ) : null}
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="删除图片"
        message="确定删除这张宣传图片？删除后展示页将不再显示。"
        confirmText="删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          await remove(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

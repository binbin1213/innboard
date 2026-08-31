import { useEffect, useState } from 'react'
import { api } from '../../api'
import ConfirmModal from '../../components/ConfirmModal'

function AnnouncementRow({ item, index, total, onSaved, onMoved, onRequestDelete }) {
  const [text, setText] = useState(item.text)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!text.trim()) return setError('公告内容不能为空')
    setError('')
    setSaving(true)
    try {
      await api.put(`/api/announcements/${item.id}`, { text }, true)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1 shrink-0">
        <button
          disabled={index === 0}
          onClick={() => onMoved(index, -1)}
          className="px-2 py-1 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          ↑
        </button>
        <button
          disabled={index === total - 1}
          onClick={() => onMoved(index, 1)}
          className="px-2 py-1 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          ↓
        </button>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 border rounded-lg px-3 py-2"
      />
      <button
        onClick={save}
        disabled={saving}
        className="bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm shrink-0 transition-colors"
      >
        {saving ? '保存中' : '保存'}
      </button>
      <button
        onClick={() => onRequestDelete(item)}
        className="text-danger hover:text-red-700 text-sm shrink-0"
      >
        删除
      </button>
      {error && <div className="text-danger text-xs shrink-0">{error}</div>}
    </div>
  )
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState(null)
  const [newText, setNewText] = useState('')
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = () => {
    api.get('/api/announcements', true).then(setItems).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  const move = async (index, direction) => {
    const ids = items.map((a) => a.id)
    const target = index + direction
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await api.post('/api/announcements/reorder', { ids }, true)
    load()
  }

  const remove = async (id) => {
    await api.del(`/api/announcements/${id}`, true)
    load()
  }

  const add = async () => {
    if (!newText.trim()) return setError('公告内容不能为空')
    setError('')
    await api.post('/api/announcements', { text: newText }, true)
    setNewText('')
    load()
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">公告管理</h2>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex gap-3 mb-5">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="新公告内容，如：连住两晚95折"
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button onClick={add} className="btn-gold">
            添加公告
          </button>
        </div>
        {error && <div className="text-danger text-sm mb-4">{error}</div>}
        <div className="flex flex-col gap-3">
          {items?.map((item, i) => (
            <AnnouncementRow
              key={item.id}
              item={item}
              index={i}
              total={items.length}
              onSaved={load}
              onMoved={move}
              onRequestDelete={setPendingDelete}
            />
          ))}
        </div>
        {items === null ? (
          <div className="text-gray-400 text-center py-8">加载中…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无公告</div>
        ) : null}
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="删除公告"
        message={`确定删除公告「${pendingDelete?.text}」？`}
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

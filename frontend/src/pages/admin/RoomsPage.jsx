import { useEffect, useState } from 'react'
import { api } from '../../api'

function RoomRow({ room, index, total, onSaved, onMoved, onDeleted }) {
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description || '')
  const [rackPrice, setRackPrice] = useState(String(room.rack_price))
  const [memberPrice, setMemberPrice] = useState(String(room.member_price))
  const [remaining, setRemaining] = useState(room.remaining_rooms == null ? '' : String(room.remaining_rooms))
  const [soldOut, setSoldOut] = useState(room.sold_out)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const rack = Number(rackPrice)
    const member = Number(memberPrice)
    const rem = remaining === '' ? null : Number(remaining)
    if (!name.trim()) return setError('房型名称不能为空')
    if (Number.isNaN(rack) || rack < 0) return setError('门市价无效')
    if (Number.isNaN(member) || member < 0) return setError('会员价无效')
    if (rem !== null && (Number.isNaN(rem) || rem < 0)) return setError('剩余间数无效')
    setError('')
    setSaving(true)
    try {
      await api.put(
        `/api/rooms/${room.id}`,
        { name, description, rack_price: rack, member_price: member, remaining_rooms: rem, sold_out: soldOut },
        true
      )
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-2 w-24">
        <div className="flex gap-1">
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
      </td>
      <td className="py-2 pr-3 w-36">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-2 py-1.5"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="如：25㎡ / 1.8m大床 / 含双早"
          className="w-full border rounded px-2 py-1.5"
        />
      </td>
      <td className="py-2 pr-3 w-28">
        <input
          value={rackPrice}
          onChange={(e) => setRackPrice(e.target.value)}
          disabled={soldOut}
          className={`w-full border rounded px-2 py-1.5 ${soldOut ? 'bg-gray-100 text-gray-400' : ''}`}
        />
      </td>
      <td className="py-2 pr-3 w-28">
        <input
          value={memberPrice}
          onChange={(e) => setMemberPrice(e.target.value)}
          disabled={soldOut}
          className={`w-full border rounded px-2 py-1.5 ${soldOut ? 'bg-gray-100 text-gray-400' : ''}`}
        />
      </td>
      <td className="py-2 pr-3 w-24">
        <input
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          placeholder="不显示"
          className="w-full border rounded px-2 py-1.5"
        />
      </td>
      <td className="py-2 pr-3 w-20 text-center">
        <input
          type="checkbox"
          checked={soldOut}
          onChange={(e) => setSoldOut(e.target.checked)}
          className="w-5 h-5"
        />
      </td>
      <td className="py-2 pr-3 w-28">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-3 py-1.5 text-sm"
        >
          {saving ? '保存中' : '保存'}
        </button>
        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
      </td>
      <td className="py-2 w-16">
        <button
          onClick={() => {
            if (confirm(`确定删除「${room.name}」？`)) onDeleted(room.id)
          }}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          删除
        </button>
      </td>
    </tr>
  )
}

function priceChange(oldPrice, newPrice) {
  return oldPrice === newPrice ? <span className="text-gray-300">—</span> : `${oldPrice} → ${newPrice}`
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState(null)
  const [logs, setLogs] = useState([])
  const [newName, setNewName] = useState('')
  const [newRack, setNewRack] = useState('')
  const [newMember, setNewMember] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    api.get('/api/rooms', true).then(setRooms).catch((e) => setError(e.message))
    api.get('/api/rooms/logs', true).then(setLogs).catch(() => {})
  }

  useEffect(load, [])

  const move = async (index, direction) => {
    const ids = rooms.map((r) => r.id)
    const target = index + direction
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await api.post('/api/rooms/reorder', { ids }, true)
    load()
  }

  const remove = async (id) => {
    await api.del(`/api/rooms/${id}`, true)
    load()
  }

  const add = async () => {
    const rack = Number(newRack)
    const member = Number(newMember)
    if (!newName.trim()) return setError('房型名称不能为空')
    if (Number.isNaN(rack) || rack < 0) return setError('门市价无效')
    if (Number.isNaN(member) || member < 0) return setError('会员价无效')
    setError('')
    await api.post(
      '/api/rooms',
      { name: newName, rack_price: rack, member_price: member, description: newDesc },
      true
    )
    setNewName('')
    setNewRack('')
    setNewMember('')
    setNewDesc('')
    load()
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">房价管理</h2>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex gap-3 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新房型名称"
            className="w-40 border rounded-lg px-3 py-2"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="描述（可空）"
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <input
            value={newRack}
            onChange={(e) => setNewRack(e.target.value)}
            placeholder="门市价"
            className="w-28 border rounded-lg px-3 py-2"
          />
          <input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="会员价"
            className="w-28 border rounded-lg px-3 py-2"
          />
          <button onClick={add} className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 font-medium">
            添加房型
          </button>
        </div>
        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-2 w-24">排序</th>
              <th className="py-2 pr-3 w-36">房型名称</th>
              <th className="py-2 pr-3">描述</th>
              <th className="py-2 pr-3 w-28">门市价（元）</th>
              <th className="py-2 pr-3 w-28">会员价（元）</th>
              <th className="py-2 pr-3 w-24">剩余间数</th>
              <th className="py-2 pr-3 w-20 text-center">满房</th>
              <th className="py-2 pr-3 w-28"></th>
              <th className="py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rooms?.map((room, i) => (
              <RoomRow
                key={room.id}
                room={room}
                index={i}
                total={rooms.length}
                onSaved={load}
                onMoved={move}
                onDeleted={remove}
              />
            ))}
          </tbody>
        </table>
        </div>
        {rooms && rooms.length === 0 && (
          <div className="text-gray-400 text-center py-8">暂无房型，请添加</div>
        )}
      </div>

      <h3 className="text-lg font-bold mb-3">最近改价记录</h3>
      <div className="bg-white rounded-xl shadow p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4">时间</th>
              <th className="py-2 pr-4">房型</th>
              <th className="py-2 pr-4">门市价变动</th>
              <th className="py-2">会员价变动</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{log.created_at}</td>
                <td className="py-2 pr-4">{log.room_name}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {priceChange(log.old_rack_price, log.new_rack_price)}
                </td>
                <td className="py-2 text-red-600">
                  {priceChange(log.old_member_price, log.new_member_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="text-gray-400 text-center py-4">暂无记录</div>}
      </div>
    </div>
  )
}

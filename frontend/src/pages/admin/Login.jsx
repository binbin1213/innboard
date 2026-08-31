import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../../api'

export default function Login() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/auth/login', { username, password })
      setToken(res.token)
      nav('/admin/rooms', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-navy-900">
      <form onSubmit={submit} className="w-96 bg-white rounded-2xl shadow-card p-8">
        <div className="text-center mb-8">
          <span className="inline-block h-3 w-3 rounded-full bg-brand-400 mb-3" />
          <h1 className="text-2xl font-bold text-navy-800">酒店房价牌管理后台</h1>
          <p className="text-sm text-gray-400 mt-1">Hotel Price Board Admin</p>
        </div>
        <label className="block text-sm text-gray-600 mb-1">用户名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input mb-4"
        />
        <label className="block text-sm text-gray-600 mb-1">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-4"
        />
        {error && <div className="text-danger text-sm mb-4">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, clearToken } from '../../api'

const tabs = [
  { to: '/admin/rooms', label: '房价管理' },
  { to: '/admin/images', label: '图片管理' },
  { to: '/admin/announcements', label: '公告管理' },
  { to: '/admin/welcome', label: '欢迎致辞' },
  { to: '/admin/settings', label: '系统设置' },
]

export default function AdminLayout() {
  const [checked, setChecked] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/api/auth/me', true).then(() => setChecked(true)).catch(() => nav('/admin/login'))
  }, [])

  if (!checked) return null

  const logout = () => {
    clearToken()
    nav('/admin/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-52 bg-navy-800 text-white flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold border-b border-white/10">
          <span className="h-2 w-2 rounded-full bg-brand-400 shrink-0" />
          房价牌管理
        </div>
        <nav className="flex-1 py-2">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `block px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-600 text-brand-300 font-medium border-l-2 border-brand-400'
                    : 'text-gray-300 hover:bg-navy-700 hover:text-white'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="p-5 text-left text-sm text-gray-400 hover:bg-navy-700 hover:text-white border-t border-white/10 transition-colors"
        >
          退出登录
        </button>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}

const TOKEN_KEY = 'hotel_admin_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) headers['Authorization'] = `Bearer ${getToken()}`
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && auth) {
    clearToken()
    if (!window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login'
    }
    throw new Error('未登录或登录已过期')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `请求失败 (${res.status})`)
  }
  return res.json()
}

export async function uploadFile(path, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `上传失败 (${res.status})`)
  }
  return res.json()
}

export const api = {
  get: (path, auth) => request(path, { auth }),
  post: (path, body, auth) => request(path, { method: 'POST', body, auth }),
  put: (path, body, auth) => request(path, { method: 'PUT', body, auth }),
  del: (path, auth) => request(path, { method: 'DELETE', auth }),
}

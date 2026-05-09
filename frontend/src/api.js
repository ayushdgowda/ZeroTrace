const BASE_URL = 'http://localhost:8000/api'

const getToken = () => localStorage.getItem('access_token')
const setTokens = (access, refresh) => {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}
const clearTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

const authFetch = async (url, options = {}) => {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers })
  if (res.status === 401) {
    clearTokens()
    window.location.href = '/login'
  }
  return res
}

export const authAPI = {
  register: async ({ name, email, password }) => {
    const nameParts = name.trim().split(' ')
    const res = await fetch(`${BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: email.split('@')[0] + '_' + Date.now(),
        email,
        password,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setTokens(data.access, data.refresh)
      return { success: true, user: data.user }
    }
    return { success: false, error: Object.values(data).flat().join(' ') }
  },

  login: async ({ email, password }) => {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    })
    const data = await res.json()
    if (res.ok) {
      setTokens(data.access, data.refresh)
      localStorage.setItem('user', JSON.stringify(data.user))
      return { success: true, user: data.user }
    }
    return { success: false, error: data.error || 'Login failed' }
  },

  logout: () => {
    clearTokens()
    localStorage.removeItem('user')
    window.location.href = '/login'
  },

  getUser: () => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  },

  isLoggedIn: () => !!getToken(),
}

export const chatAPI = {
  sendMessage: async ({ message, conversation_id, onChunk, onDone, onError }) => {
    try {
      const res = await authFetch('/chat/', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id, stream: true }),
      })
      if (!res.ok) { onError?.('Failed to connect to server'); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data: ', ''))
            if (json.chunk && !json.done) onChunk?.(json.chunk)
            if (json.done) onDone?.(json)
          } catch { }
        }
      }
    } catch (err) {
      onError?.(err.message)
    }
  },
}

export const conversationsAPI = {
  list: async () => {
    const res = await authFetch('/conversations/')
    return res.ok ? res.json() : []
  },
  get: async (id) => {
    const res = await authFetch(`/conversations/${id}/`)
    return res.ok ? res.json() : null
  },
  create: async () => {
    const res = await authFetch('/conversations/', { method: 'POST', body: JSON.stringify({}) })
    return res.ok ? res.json() : null
  },
  delete: async (id) => {
    const res = await authFetch(`/conversations/${id}/`, { method: 'DELETE' })
    return res.ok
  },
  getHistory: async (conversation_id) => {
    const res = await authFetch(`/chat/history/?conversation_id=${conversation_id}`)
    return res.ok ? res.json() : []
  },
}

export const analyticsAPI = {
  getUsage: async () => {
    const res = await authFetch('/usage/')
    return res.ok ? res.json() : null
  },
}

export const statusAPI = {
  check: async () => {
    try {
      const res = await fetch(`${BASE_URL}/status/`)
      return res.ok ? res.json() : { status: 'offline', models: [] }
    } catch {
      return { status: 'offline', models: [] }
    }
  },
}
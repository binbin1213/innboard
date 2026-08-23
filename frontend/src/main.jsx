import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// 注册离线缓存（尽早注册，首次访问即缓存页面与资源，服务器断电时仍能显示）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    navigator.serviceWorker.ready.then(() => {
      // 首次访问：把页面用到的同源资源（JS/CSS/图片）全部缓存，
      // 这样即使服务器断电，重新打开页面也能完整显示
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin))
      caches
        .open('innboard-v2')
        .then((c) => c.addAll(urls).catch(() => {}))
        .catch(() => {})
    })
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

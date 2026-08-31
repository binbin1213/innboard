import { useEffect } from 'react'

export default function ConfirmModal({ open, title, message, confirmText = '删除', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-96 rounded-2xl bg-white shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-lg font-bold text-navy-800">{title}</h3>
        {message && <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost">
            取消
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="btn-danger"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

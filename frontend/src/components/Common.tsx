export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    active: 'bg-green-100 text-green-700',
    occupied: 'bg-green-100 text-green-700',
    resolved: 'bg-green-100 text-green-700',
    unpaid: 'bg-amber-100 text-amber-700',
    open: 'bg-amber-100 text-amber-700',
    vacant: 'bg-gray-100 text-gray-600',
    partial: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-blue-100 text-blue-700',
    partial_overdue: 'bg-red-100 text-red-700',
    overdue: 'bg-red-100 text-red-700',
    vacated: 'bg-gray-100 text-gray-600',
  }
  const label = status.replace('_', ' ')
  return (
    <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-gray-500 font-medium">{title}</p>
      {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 mb-4">
      {message}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

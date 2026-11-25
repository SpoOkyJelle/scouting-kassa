export default function SettingsCard({ Icon, label, color = 'var(--primary)', children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: '0.85rem',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--s50)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={color} strokeWidth={2.3} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--s800)' }}>{label}</span>
      </div>
      <div style={{ padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}

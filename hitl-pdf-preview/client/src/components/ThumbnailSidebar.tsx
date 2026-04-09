import type { SpineItem } from '../types'

interface Props {
  items: SpineItem[]
  currentChapter: number   // 1-based
  onSelect: (index: number) => void
}

export function ThumbnailSidebar({ items, currentChapter, onSelect }: Props) {
  if (items.length === 0) return null

  return (
    <div style={sidebarStyle}>
      <div style={headerStyle}>Contents</div>
      <div style={listStyle}>
        {items.map((item, i) => {
          const isActive = i + 1 === currentChapter
          return (
            <button
              key={item.href}
              onClick={() => onSelect(i)}
              title={item.label}
              style={{
                ...itemBase,
                background: isActive ? 'rgba(0,122,255,0.08)' : 'transparent',
                color: isActive ? '#007AFF' : '#3c3c43',
              }}
            >
              {/* Active indicator */}
              <div style={{
                width: '3px',
                height: '100%',
                position: 'absolute',
                left: 0,
                top: 0,
                borderRadius: '0 3px 3px 0',
                background: isActive ? '#007AFF' : 'transparent',
                transition: 'background 0.15s',
              }} />

              <span style={{
                ...indexStyle,
                color: isActive ? '#007AFF' : '#aeaeb2',
              }}>
                {i + 1}
              </span>
              <span style={labelStyle}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const sidebarStyle: React.CSSProperties = {
  width: '210px',
  flexShrink: 0,
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRight: '1px solid rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  padding: '14px 16px 10px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#aeaeb2',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  flexShrink: 0,
}

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
  padding: '6px 0',
}

const itemBase: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '9px 14px 9px 18px',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 400,
  transition: 'background 0.12s, color 0.12s',
  borderRadius: '0',
}

const indexStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  minWidth: '16px',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
  transition: 'color 0.12s',
}

const labelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1.45,
  letterSpacing: '-0.01em',
}

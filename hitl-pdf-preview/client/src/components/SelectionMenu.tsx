import { useEffect, useRef } from 'react'

interface MenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onDismiss: () => void
}

/**
 * A small floating context menu anchored at (x, y) in viewport coordinates.
 * Dismisses when the user clicks outside or presses Escape.
 */
export function SelectionMenu({ x, y, items, onDismiss }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Adjust position so menu stays within viewport
  const style = useComputedPosition(x, y, menuRef)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    // Slight delay so the mouseup that created the selection doesn't immediately dismiss
    const tid = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
    }, 80)
    return () => {
      clearTimeout(tid)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onDismiss])

  return (
    <div ref={menuRef} style={{ ...menuStyle, ...style }}>
      {items.map((item, i) => (
        <button
          key={i}
          style={itemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onMouseDown={e => {
            e.preventDefault()   // keep selection alive
            item.onClick()
          }}
        >
          <span style={iconStyle}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** Compute top/left so the menu doesn't overflow the viewport. */
function useComputedPosition(
  x: number,
  y: number,
  ref: React.RefObject<HTMLDivElement | null>,
): React.CSSProperties {
  // Initial render: position above the anchor, adjust after paint if needed
  const MENU_W = 200
  const MENU_H = 40   // rough estimate per item; corrected after mount

  const left = Math.min(x, window.innerWidth - MENU_W - 8)
  // Place above the selection by default; flip below if too close to top
  const top = y - (ref.current?.offsetHeight ?? MENU_H) - 8

  return {
    position: 'fixed',
    left: Math.max(8, left),
    top: Math.max(8, top),
    zIndex: 9999,
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const menuStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
  padding: '4px',
  minWidth: '180px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  userSelect: 'none',
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#1d1d1f',
  background: 'transparent',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
  fontFamily: 'inherit',
}

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  color: '#007AFF',
}

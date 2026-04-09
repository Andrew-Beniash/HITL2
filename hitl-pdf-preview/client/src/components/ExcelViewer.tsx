import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'

interface Props {
  file: File
  onOpenNew: () => void
}

interface SheetData {
  name: string
  rows: string[][]   // all values as strings
}

const MAX_COLS = 500  // safety cap for pathological sheets

export function ExcelViewer({ file, onOpenNew }: Props) {
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSheets([])
    setActiveIdx(0)
    setError(null)

    file.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const parsed: SheetData[] = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name]
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,   // format dates/numbers as strings
        }) as string[][]

        // Drop trailing all-empty rows
        let last = rows.length - 1
        while (last >= 0 && rows[last].every(c => c === '')) last--
        const trimmed = rows.slice(0, last + 1)

        // Cap column count
        return {
          name,
          rows: trimmed.map(r => r.slice(0, MAX_COLS)),
        }
      })
      setSheets(parsed)
    }).catch(err => {
      setError(`Failed to load workbook: ${err?.message ?? err}`)
    })
  }, [file])

  const sheet = sheets[activeIdx]
  const maxCols = sheet ? Math.max(0, ...sheet.rows.map(r => r.length)) : 0
  const colLabels = Array.from({ length: maxCols }, (_, i) => colLabel(i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top toolbar */}
      <div style={toolbarStyle}>
        <button onClick={onOpenNew} style={btnStyle} title="Open another file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
        <span style={filenameStyle}>{file.name}</span>
        {sheet && (
          <span style={metaStyle}>
            {sheet.rows.length > 0 ? sheet.rows.length - 1 : 0} rows · {maxCols} cols
          </span>
        )}
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {/* Table area */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        {sheet && sheet.rows.length > 0 ? (
          <table style={tableStyle}>
            <thead>
              {/* Column letter header row */}
              <tr>
                <th style={{ ...rowNumStyle, background: '#e9ecef', borderColor: '#ced4da' }}></th>
                {colLabels.map(lbl => (
                  <th key={lbl} style={colHeaderStyle}>{lbl}</th>
                ))}
              </tr>
              {/* Data header (first row of sheet) */}
              <tr>
                <td style={rowNumStyle}>1</td>
                {Array.from({ length: maxCols }, (_, ci) => (
                  <th key={ci} style={dataHeaderStyle}>{sheet.rows[0]?.[ci] ?? ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(1).map((row, ri) => (
                <tr key={ri} style={ri % 2 === 0 ? {} : { background: '#f8f9fa' }}>
                  <td style={rowNumStyle}>{ri + 2}</td>
                  {Array.from({ length: maxCols }, (_, ci) => (
                    <td key={ci} style={cellStyle}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !error && sheet && <div style={emptyStyle}>This sheet is empty.</div>
        )}
      </div>

      {/* Sheet tabs */}
      {sheets.length > 0 && (
        <div style={tabBarStyle}>
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveIdx(i)}
              style={{
                ...tabStyle,
                ...(i === activeIdx ? activeTabStyle : {}),
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Convert 0-based column index to Excel letter label (A, B, ..., Z, AA, ...) */
function colLabel(index: number): string {
  let label = ''
  let n = index + 1
  while (n > 0) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0 12px',
  height: '44px',
  background: '#ffffff',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  flexShrink: 0,
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '14px',
  cursor: 'pointer',
  color: '#1d1d1f',
}

const filenameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1d1d1f',
  maxWidth: '300px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const metaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8e8e93',
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  fontSize: '13px',
  fontFamily: "'Menlo', 'Consolas', monospace",
  minWidth: '100%',
  tableLayout: 'auto',
}

const rowNumStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: '#f1f3f4',
  border: '1px solid #e0e0e0',
  color: '#5f6368',
  fontSize: '11px',
  textAlign: 'center',
  minWidth: '40px',
  position: 'sticky',
  left: 0,
  zIndex: 1,
  whiteSpace: 'nowrap',
}

const colHeaderStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: '#f1f3f4',
  border: '1px solid #e0e0e0',
  color: '#5f6368',
  fontSize: '11px',
  textAlign: 'center',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  minWidth: '80px',
}

const dataHeaderStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: '#e8f0fe',
  border: '1px solid #c5cae9',
  fontWeight: 600,
  fontSize: '13px',
  color: '#1a1a2e',
  whiteSpace: 'nowrap',
  minWidth: '80px',
  position: 'sticky',
  top: '28px',    // below column-letter row
  zIndex: 1,
}

const cellStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #e0e0e0',
  color: '#202124',
  whiteSpace: 'pre',
  maxWidth: '320px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2px',
  padding: '0 8px',
  background: '#f1f3f4',
  borderTop: '1px solid #e0e0e0',
  overflowX: 'auto',
  flexShrink: 0,
  minHeight: '34px',
}

const tabStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: '12px',
  fontWeight: 500,
  border: '1px solid transparent',
  borderBottom: 'none',
  borderRadius: '4px 4px 0 0',
  background: 'transparent',
  color: '#5f6368',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background 0.12s',
}

const activeTabStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a73e8',
  border: '1px solid #e0e0e0',
  borderBottom: '1px solid #ffffff',
}

const emptyStyle: React.CSSProperties = {
  padding: '48px',
  color: '#8e8e93',
  fontSize: '14px',
  textAlign: 'center',
}

const errorStyle: React.CSSProperties = {
  margin: '16px',
  padding: '12px 16px',
  background: 'rgba(255,59,48,0.08)',
  border: '1px solid rgba(255,59,48,0.25)',
  borderRadius: '8px',
  color: '#c0392b',
  fontSize: '13px',
}

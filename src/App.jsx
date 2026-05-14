import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'

// ─── Template coordinate constants (base image: 460×597) ────────────────────
const BASE_W = 460
const BASE_H = 597

// Silhouette darkness threshold
const DARK_THRESHOLD = 55

// Photo placement region (the body silhouette area)
const PHOTO_REGION = { x: 48, y: 38, w: 367, h: 442 }

// Text banner regions
const NAME_BANNER  = { x: 88,  y: 480, w: 322, h: 36  }
const DATE_BANNER  = { x: 155, y: 520, w: 160, h: 35  }

// Banner colors (sampled from template)
const NAME_BG = '#B90C31'
const DATE_BG = '#8A0826'

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [photoImg,    setPhotoImg]    = useState(null)
  const [playerName,  setPlayerName]  = useState('')
  const [playerDate,  setPlayerDate]  = useState('')
  const [offsetX,     setOffsetX]     = useState(0)
  const [offsetY,     setOffsetY]     = useState(0)
  const [zoom,        setZoom]        = useState(1.0)
  const [processed,   setProcessed]   = useState(null)
  const [templateReady, setTemplateReady] = useState(false)
  const [dragging,    setDragging]    = useState(false)
  const [lastPos,     setLastPos]     = useState({ x: 0, y: 0 })
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [removing,    setRemoving]    = useState(false) // background removal in progress

  const canvasRef   = useRef(null)
  const fileInputRef = useRef(null)

  // ── Process template on mount ─────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.src = '/arte_copa.PNG'
    img.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width  = img.naturalWidth
      offscreen.height = img.naturalHeight
      const ctx = offscreen.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)
      const data = imageData.data

      // Make silhouette pixels transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        if (r < DARK_THRESHOLD && g < DARK_THRESHOLD && b < DARK_THRESHOLD) {
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)
      setProcessed(offscreen)
      setTemplateReady(true)
    }
  }, [])

  // ── Scale helper (base coords → actual canvas coords) ────────────────────
  const scale = useCallback((val, isY = false) => {
    if (!processed) return val
    return isY
      ? val * (processed.height / BASE_H)
      : val * (processed.width  / BASE_W)
  }, [processed])

  // ── Canvas render ─────────────────────────────────────────────────────────
  const render = useCallback(() => {
    if (!processed || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const cw = processed.width
    const ch = processed.height

    canvas.width  = cw
    canvas.height = ch

    // Background gradient (matches template edges)
    const grad = ctx.createLinearGradient(0, 0, cw, ch)
    grad.addColorStop(0,   '#00a5bb')
    grad.addColorStop(0.5, '#0097aa')
    grad.addColorStop(1,   '#007d8f')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)

    // ── Draw user photo ────────────────────────────────────────────────────
    if (photoImg) {
      const pr = {
        x: scale(PHOTO_REGION.x),
        y: scale(PHOTO_REGION.y, true),
        w: scale(PHOTO_REGION.w),
        h: scale(PHOTO_REGION.h, true),
      }

      const aspect = photoImg.naturalWidth / photoImg.naturalHeight
      let dw, dh
      if (aspect > pr.w / pr.h) {
        dh = pr.h; dw = dh * aspect
      } else {
        dw = pr.w; dh = dw / aspect
      }

      dw *= zoom
      dh *= zoom

      const dx = pr.x + (pr.w - dw) / 2 + scale(offsetX)
      const dy = pr.y + (pr.h - dh) / 2 + scale(offsetY, true)

      ctx.drawImage(photoImg, dx, dy, dw, dh)
    }

    // ── Draw processed template on top ─────────────────────────────────────
    ctx.drawImage(processed, 0, 0)

    // ── Name banner ────────────────────────────────────────────────────────
    const nb = {
      x: scale(NAME_BANNER.x),
      y: scale(NAME_BANNER.y, true),
      w: scale(NAME_BANNER.w),
      h: scale(NAME_BANNER.h, true),
    }

    if (playerName.trim()) {
      ctx.fillStyle = NAME_BG
      ctx.fillRect(nb.x, nb.y, nb.w, nb.h)

      const fs = Math.max(10, Math.round(nb.h * 0.72))
      ctx.font         = `bold ${fs}px Impact, "Arial Black", sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'

      // Shrink text if too wide
      let text = playerName.toUpperCase()
      ctx.font = `bold ${fs}px Impact, "Arial Black", sans-serif`
      while (ctx.measureText(text).width > nb.w * 0.92 && fs > 8) {
        ctx.font = `bold ${fs * 0.9}px Impact, "Arial Black", sans-serif`
      }

      ctx.fillText(text, nb.x + nb.w / 2, nb.y + nb.h / 2)
    }

    // ── Date banner ────────────────────────────────────────────────────────
    const db = {
      x: scale(DATE_BANNER.x),
      y: scale(DATE_BANNER.y, true),
      w: scale(DATE_BANNER.w),
      h: scale(DATE_BANNER.h, true),
    }

    if (playerDate.trim()) {
      ctx.fillStyle = DATE_BG
      ctx.fillRect(db.x, db.y, db.w, db.h)

      const fs2 = Math.max(8, Math.round(db.h * 0.58))
      ctx.font         = `bold ${fs2}px Impact, "Arial Black", sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(playerDate.toUpperCase(), db.x + db.w / 2, db.y + db.h / 2)
    }
  }, [processed, photoImg, offsetX, offsetY, zoom, playerName, playerDate, scale])

  useEffect(() => { render() }, [render])

  // ── Upload handler ────────────────────────────────────────────────────────
  // Background removal + load image
  const loadImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    setRemoving(true)
    setPhotoImg(null)

    const applyImage = (src) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        setPhotoImg(img)
        setOffsetX(0)
        setOffsetY(0)
        setZoom(1.0)
        setRemoving(false)
      }
    }

    try {
      const blob = await removeBackground(file)
      applyImage(URL.createObjectURL(blob))
    } catch (err) {
      console.error('Background removal failed, using original:', err)
      const reader = new FileReader()
      reader.onload = (ev) => applyImage(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleFileChange = (e) => loadImageFile(e.target.files?.[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    loadImageFile(e.dataTransfer.files?.[0])
  }

  // ── Drag to reposition photo on canvas ───────────────────────────────────
  const getEventPos = (e) => {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: e.clientX, y: e.clientY }
  }

  const handlePointerDown = (e) => {
    if (!photoImg) return
    setDragging(true)
    setLastPos(getEventPos(e))
  }
  const handlePointerMove = (e) => {
    if (!dragging) return
    const pos = getEventPos(e)
    setOffsetX(prev => prev + (pos.x - lastPos.x))
    setOffsetY(prev => prev + (pos.y - lastPos.y))
    setLastPos(pos)
  }
  const handlePointerUp = () => setDragging(false)

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `figurinha-copa-${playerName.replace(/\s+/g, '_') || 'jogador'}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerEmoji}>⚽</div>
          <div>
            <h1 style={styles.title}>FIGURINHA DA COPA</h1>
            <p style={styles.subtitle}>FIFA 2026 · Crie a sua figurinha personalizada</p>
          </div>
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────────── */}
      <main style={styles.main}>

        {/* Card preview */}
        <div style={styles.previewSection}>
          <div style={styles.previewLabel}>
            {photoImg ? '⟵ Arraste para reposicionar' : '⬇ Suba sua foto para começar'}
          </div>
          <div
            style={{
              ...styles.canvasWrapper,
              cursor: photoImg ? (dragging ? 'grabbing' : 'grab') : 'default',
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {!templateReady && (
              <div style={styles.loadingOverlay}>
                <div style={styles.spinner} />
                <span>Carregando template…</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={styles.canvas}
            />
          </div>
          {/* Zoom slider under card */}
          {photoImg && (
            <div style={styles.zoomRow}>
              <span style={styles.zoomLabel}>🔍</span>
              <input
                type="range" min="0.3" max="2.5" step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={styles.controls}>

          {/* Upload zone */}
          <div
            style={{
              ...styles.uploadZone,
              ...(isDragOver ? styles.uploadZoneActive : {}),
              ...(photoImg   ? styles.uploadZoneDone   : {}),
              ...(removing   ? styles.uploadZoneLoading : {}),
            }}
            onClick={() => !removing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!removing) setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {removing ? (
              <>
                <div style={styles.uploadIcon}>✂️</div>
                <div style={styles.uploadTitle}>Removendo fundo…</div>
                <div style={styles.uploadHint}>IA rodando no navegador, aguarde</div>
                <div style={styles.progressBar}><div style={styles.progressFill} /></div>
              </>
            ) : photoImg ? (
              <>
                <div style={styles.uploadIcon}>✅</div>
                <div style={styles.uploadTitle}>Foto carregada!</div>
                <div style={styles.uploadHint}>Clique para trocar</div>
              </>
            ) : (
              <>
                <div style={styles.uploadIcon}>📸</div>
                <div style={styles.uploadTitle}>Envie sua foto</div>
                <div style={styles.uploadHint}>Clique ou arraste aqui · JPG, PNG</div>
              </>
            )}
          </div>

          {/* Divider */}
          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>PERSONALIZE</span>
            <div style={styles.dividerLine} />
          </div>

          {/* Name input */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>🏷️ NOME DO JOGADOR</label>
            <input
              type="text"
              placeholder="Ex: RODRIGO SILVA"
              value={playerName}
              maxLength={20}
              onChange={(e) => setPlayerName(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* Date input */}
          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>📅 DATA / POSIÇÃO / CLUBE</label>
            <input
              type="text"
              placeholder="Ex: 15/07/1990"
              value={playerDate}
              maxLength={20}
              onChange={(e) => setPlayerDate(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* Photo adjustment hint */}
          {photoImg && (
            <div style={styles.hintBox}>
              <strong>💡 Dica:</strong> Arraste a foto no cartão para ajustar a posição. Use o controle de zoom abaixo do cartão.
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={!templateReady}
            style={{
              ...styles.downloadBtn,
              ...(!templateReady ? styles.downloadBtnDisabled : {}),
            }}
          >
            ⬇ BAIXAR FIGURINHA
          </button>

          <p style={styles.footerNote}>
            Imagem gerada localmente — nenhum dado enviado para servidores.
          </p>
        </div>
      </main>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Barlow Condensed', sans-serif",
    background: '#539b2a',
  },

  // Header
  header: {
    background: 'linear-gradient(90deg, rgba(83, 155, 42, 1) 0%, rgba(0, 161, 67, 1) 100%, rgba(237, 221, 83, 1) 100%)',
    borderBottom: '3px solid #f0c040',
    padding: '16px 24px',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerEmoji: {
    fontSize: 40,
    lineHeight: 1,
  },
  title: {
    fontFamily: "'Russo One', sans-serif",
    fontSize: '2rem',
    letterSpacing: '0.08em',
    color: '#f0c040',
    lineHeight: 1,
  },
  subtitle: {
    fontSize: '1rem',
    color: '#cceef4',
    letterSpacing: '0.05em',
    marginTop: 2,
  },

  // Main layout
  main: {
    flex: 1,
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
    padding: '32px 16px',
    display: 'flex',
    gap: 40,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  // Preview section
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    flex: '0 0 auto',
  },
  previewLabel: {
    fontSize: '0.85rem',
    color: '#8ab8c0',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  canvasWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0,180,210,0.25), 0 20px 60px rgba(0,0,0,0.5)',
    border: '2px solid rgba(0,180,210,0.3)',
    userSelect: 'none',
  },
  canvas: {
    display: 'block',
    width: 320,
    height: 'auto',
    maxWidth: '90vw',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(3,49,58,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: '#8ab8c0',
    fontSize: '0.9rem',
    zIndex: 10,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(0,180,210,0.2)',
    borderTop: '3px solid #009eb3',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  // Zoom row
  zoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: 320,
    maxWidth: '90vw',
  },
  zoomLabel: {
    fontSize: '0.85rem',
    color: '#8ab8c0',
    minWidth: 36,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    accentColor: '#009eb3',
    cursor: 'pointer',
  },

  // Controls panel
  controls: {
    flex: '1 1 320px',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    minWidth: 280,
  },

  // Upload zone
  uploadZone: {
    border: '2px dashed rgba(0,180,210,0.4)',
    borderRadius: 12,
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'rgba(0,150,180,0.05)',
  },
  uploadZoneActive: {
    border: '2px dashed #009eb3',
    background: 'rgba(0,150,180,0.15)',
    transform: 'scale(1.01)',
  },
  uploadZoneDone: {
    border: '2px solid rgba(100,200,100,0.5)',
    background: 'rgba(50,180,80,0.05)',
  },
  uploadIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#cceef4',
  },
  uploadHint: {
    fontSize: '0.85rem',
    color: '#8ab8c0',
    marginTop: 4,
  },

  // Divider
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(0,180,210,0.2)',
  },
  dividerText: {
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    color: '#8ab8c0',
  },

  // Inputs
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    color: '#8ab8c0',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(0,120,140,0.25)',
    border: '1.5px solid rgba(0,180,210,0.3)',
    borderRadius: 8,
    padding: '12px 14px',
    color: '#f0f0f0',
    fontSize: '1.1rem',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.05em',
    outline: 'none',
    transition: 'border-color 0.2s',
  },

  // Hint box
  hintBox: {
    background: 'rgba(0,120,140,0.15)',
    border: '1px solid rgba(0,180,210,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.85rem',
    color: '#8ab8c0',
    lineHeight: 1.5,
  },

  // Download button
  downloadBtn: {
    background: 'linear-gradient(135deg, #f0c040 0%, #e8a020 100%)',
    border: 'none',
    borderRadius: 10,
    padding: '16px',
    color: '#03313a',
    fontSize: '1.2rem',
    fontFamily: "'Russo One', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 20px rgba(240,192,64,0.3)',
  },
  downloadBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    transform: 'none',
  },

  // Loading state
  uploadZoneLoading: {
    border: '2px dashed rgba(240,192,64,0.5)',
    background: 'rgba(240,192,64,0.05)',
    cursor: 'not-allowed',
  },
  progressBar: {
    marginTop: 12,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    width: '80%',
  },
  progressFill: {
    height: '100%',
    width: '40%',
    background: '#f0c040',
    borderRadius: 2,
    animation: 'slide 1.2s ease-in-out infinite',
  },

  // Footer note
  footerNote: {
    fontSize: '0.75rem',
    color: '#4a8090',
    textAlign: 'center',
    letterSpacing: '0.03em',
  },
}

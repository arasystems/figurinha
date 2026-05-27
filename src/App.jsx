import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'

// ─── Template coordinate constants (base image: 1080×1397) ──────────────────
const BASE_W = 1080
const BASE_H = 1397

// Photo placement region (the lime-green area inside the orange frame)
const PHOTO_REGION = { x: 65, y: 92, w: 938, h: 1088 }

// Name banner (green rounded rectangle at bottom)
const NAME_BANNER = { x: 151, y: 1193, w: 777, h: 97 }

// Banner color (same green as the banner background)
const NAME_BG = '#04C248'

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [photoImg,      setPhotoImg]      = useState(null)
  const [playerName,    setPlayerName]    = useState('')
  const [playerDate,    setPlayerDate]    = useState('')
  const [offsetX,       setOffsetX]       = useState(0)
  const [offsetY,       setOffsetY]       = useState(0)
  const [zoom,          setZoom]          = useState(1.0)
  const [processed,     setProcessed]     = useState(null)
  const [templateReady, setTemplateReady] = useState(false)
  const [dragging,      setDragging]      = useState(false)
  const [lastPos,       setLastPos]       = useState({ x: 0, y: 0 })
  const [isDragOver,    setIsDragOver]    = useState(false)
  const [removing,      setRemoving]      = useState(false)

  const canvasRef    = useRef(null)
  const fileInputRef = useRef(null)

  // ── Process template on mount ─────────────────────────────────────────────
  // This art uses a LIME GREEN area for the photo zone.
  // We make lime-green pixels transparent so the photo shows through underneath.
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

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        // Detect lime green (photo zone): high green, lower red, very low blue
        const isLimeGreen = r > 130 && r < 220 && g > 210 && b < 100
        if (isLimeGreen) {
          data[i + 3] = 0 // make transparent → photo will show through
        }
      }

      ctx.putImageData(imageData, 0, 0)
      setProcessed(offscreen)
      setTemplateReady(true)
    }
  }, [])

  // ── Scale helpers ─────────────────────────────────────────────────────────
  const scaleX = useCallback((val) => {
    if (!processed) return val
    return val * (processed.width / BASE_W)
  }, [processed])

  const scaleY = useCallback((val) => {
    if (!processed) return val
    return val * (processed.height / BASE_H)
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

    // Background — cor da área da foto (verde-limão da arte)
    ctx.fillStyle = '#B1F222'
    ctx.fillRect(0, 0, cw, ch)

    // ── Draw user photo ────────────────────────────────────────────────────
    if (photoImg) {
      const pr = {
        x: scaleX(PHOTO_REGION.x),
        y: scaleY(PHOTO_REGION.y),
        w: scaleX(PHOTO_REGION.w),
        h: scaleY(PHOTO_REGION.h),
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

      const dx = pr.x + (pr.w - dw) / 2 + scaleX(offsetX)
      const dy = pr.y + (pr.h - dh) / 2 + scaleY(offsetY)

      ctx.drawImage(photoImg, dx, dy, dw, dh)
    }

    // ── Draw processed template on top ─────────────────────────────────────
    ctx.drawImage(processed, 0, 0)

    // ── Name banner text ───────────────────────────────────────────────────
    if (playerName.trim()) {
      const nb = {
        x: scaleX(NAME_BANNER.x),
        y: scaleY(NAME_BANNER.y),
        w: scaleX(NAME_BANNER.w),
        h: scaleY(NAME_BANNER.h),
      }

      // Cover placeholder with banner color
      ctx.fillStyle = NAME_BG
      ctx.beginPath()
      const r = nb.h * 0.4
      ctx.roundRect(nb.x, nb.y, nb.w, nb.h, r)
      ctx.fill()

      // Draw name text
      const fs = Math.max(10, Math.round(nb.h * 0.55))
      ctx.font         = `bold ${fs}px Impact, "Arial Black", sans-serif`
      ctx.fillStyle    = '#FFFFFF'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'

      // Shrink if too wide
      let text = playerName.toUpperCase()
      while (ctx.measureText(text).width > nb.w * 0.9) {
        const currentSize = parseInt(ctx.font)
        ctx.font = `bold ${currentSize - 1}px Impact, "Arial Black", sans-serif`
        if (currentSize <= 8) break
      }
      ctx.fillText(text, nb.x + nb.w / 2, nb.y + nb.h / 2)
    }

    // ── Date text (shown below name inside banner) ─────────────────────────
    if (playerDate.trim() && playerName.trim()) {
      const nb = {
        x: scaleX(NAME_BANNER.x),
        y: scaleY(NAME_BANNER.y),
        w: scaleX(NAME_BANNER.w),
        h: scaleY(NAME_BANNER.h),
      }
      const fs2 = Math.max(8, Math.round(nb.h * 0.28))
      ctx.font         = `${fs2}px Impact, "Arial Black", sans-serif`
      ctx.fillStyle    = 'rgba(255,255,255,0.75)'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(playerDate.toUpperCase(), nb.x + nb.w / 2, nb.y + nb.h * 0.78)
    }

  }, [processed, photoImg, offsetX, offsetY, zoom, playerName, playerDate, scaleX, scaleY])

  useEffect(() => { render() }, [render])

  // ── Background removal + upload ───────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerEmoji}>⚽</div>
          <div>
            <h1 style={styles.title}>FIGURINHA DA COPA</h1>
            <p style={styles.subtitle}>Copa do Mundo 2026 · Crie a sua cartinha personalizada</p>
          </div>
        </div>
      </header>

      {/* Main */}
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
            <canvas ref={canvasRef} style={styles.canvas} />
          </div>

          {/* Zoom slider */}
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
              ...(isDragOver ? styles.uploadZoneActive  : {}),
              ...(photoImg   ? styles.uploadZoneDone    : {}),
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

          {/* Name */}
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

          {/* Date */}
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

          {photoImg && (
            <div style={styles.hintBox}>
              <strong>💡 Dica:</strong> Arraste a foto no cartão para ajustar a posição. Use o controle de zoom abaixo do cartão.
            </div>
          )}

          {/* Download */}
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  header: {
    background: 'linear-gradient(90deg, #006878 0%, #009eb3 100%)',
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
  headerEmoji: { fontSize: 40, lineHeight: 1 },
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
  controls: {
    flex: '1 1 320px',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    minWidth: 280,
  },
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
  uploadZoneLoading: {
    border: '2px dashed rgba(240,192,64,0.5)',
    background: 'rgba(240,192,64,0.05)',
    cursor: 'not-allowed',
  },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
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
  progressBar: {
    marginTop: 12,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    width: '80%',
    margin: '12px auto 0',
  },
  progressFill: {
    height: '100%',
    width: '40%',
    background: '#f0c040',
    borderRadius: 2,
    animation: 'slide 1.2s ease-in-out infinite',
  },
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
  hintBox: {
    background: 'rgba(0,120,140,0.15)',
    border: '1px solid rgba(0,180,210,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.85rem',
    color: '#8ab8c0',
    lineHeight: 1.5,
  },
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
  },
  footerNote: {
    fontSize: '0.75rem',
    color: '#4a8090',
    textAlign: 'center',
    letterSpacing: '0.03em',
  },
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'

// ─── Template coordinate constants (base image: 1080×1397) ──────────────────
const BASE_W = 1080
const BASE_H = 1397

// Photo region (lime-green area, above the name banner)
const PHOTO_REGION = { x: 66, y: 90, w: 934, h: 924 }

// Name banner (lighter lime-green rounded rect)
const NAME_BANNER = { x: 90, y: 1030, w: 900, h: 154 }

// Cargo banner (darker green rounded rect)
const CARGO_BANNER = { x: 195, y: 1198, w: 645, h: 104 }

// Banner colors
const NAME_BG  = '#A8E81C'   // lighter lime-green
const CARGO_BG = '#07C847'   // medium green

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [photoImg,      setPhotoImg]      = useState(null)
  const [playerName,    setPlayerName]    = useState('')
  const [playerCargo,   setPlayerCargo]   = useState('')
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

  // ── Process template: make lime-green transparent ─────────────────────────
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
        // Lime-green detection (photo area + banners)
        const isLimeGreen = r > 130 && r < 220 && g > 210 && b < 110
        // Medium green (cargo banner background)
        const isMedGreen  = r < 30  && g > 150 && b < 100
        if (isLimeGreen || isMedGreen) {
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)
      setProcessed(offscreen)
      setTemplateReady(true)
    }
  }, [])

  // ── Scale helpers ─────────────────────────────────────────────────────────
  const sx = useCallback((v) => processed ? v * processed.width  / BASE_W : v, [processed])
  const sy = useCallback((v) => processed ? v * processed.height / BASE_H : v, [processed])

  // ── Canvas render ─────────────────────────────────────────────────────────
  const render = useCallback(() => {
    if (!processed || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const cw = processed.width
    const ch = processed.height

    canvas.width  = cw
    canvas.height = ch

    // Background = lime-green (matches art when no photo)
    ctx.fillStyle = '#BBF231'
    ctx.fillRect(0, 0, cw, ch)

    // ── Draw user photo ────────────────────────────────────────────────────
    if (photoImg) {
      const pr = { x: sx(PHOTO_REGION.x), y: sy(PHOTO_REGION.y), w: sx(PHOTO_REGION.w), h: sy(PHOTO_REGION.h) }
      const aspect = photoImg.naturalWidth / photoImg.naturalHeight
      let dw = pr.w, dh = pr.h
      if (aspect > pr.w / pr.h) { dh = pr.h; dw = dh * aspect }
      else                       { dw = pr.w; dh = dw / aspect }

      dw *= zoom; dh *= zoom
      const dx = pr.x + (pr.w - dw) / 2 + sx(offsetX)
      const dy = pr.y + (pr.h - dh) / 2 + sy(offsetY)
      ctx.drawImage(photoImg, dx, dy, dw, dh)
    }

    // ── Draw template overlay ──────────────────────────────────────────────
    ctx.drawImage(processed, 0, 0)

    // ── Name banner ────────────────────────────────────────────────────────
    const nb = { x: sx(NAME_BANNER.x), y: sy(NAME_BANNER.y), w: sx(NAME_BANNER.w), h: sy(NAME_BANNER.h) }
    ctx.fillStyle = NAME_BG
    ctx.beginPath()
    ctx.roundRect(nb.x, nb.y, nb.w, nb.h, nb.h * 0.35)
    ctx.fill()

    if (playerName.trim()) {
      let fs = Math.round(nb.h * 0.52)
      ctx.font         = `900 ${fs}px "Arial Black", "Arial", sans-serif`
      ctx.fillStyle    = '#0D2200'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      // Auto-shrink if too wide
      while (ctx.measureText(playerName).width > nb.w * 0.88 && fs > 10) {
        fs--
        ctx.font = `900 ${fs}px "Arial Black", "Arial", sans-serif`
      }
      ctx.fillText(playerName, nb.x + nb.w / 2, nb.y + nb.h / 2)
    }

    // ── Cargo banner ───────────────────────────────────────────────────────
    const cb = { x: sx(CARGO_BANNER.x), y: sy(CARGO_BANNER.y), w: sx(CARGO_BANNER.w), h: sy(CARGO_BANNER.h) }
    ctx.fillStyle = CARGO_BG
    ctx.beginPath()
    ctx.roundRect(cb.x, cb.y, cb.w, cb.h, cb.h * 0.35)
    ctx.fill()

    if (playerCargo.trim()) {
      let fs2 = Math.round(cb.h * 0.48)
      ctx.font         = `bold ${fs2}px "Arial", sans-serif`
      ctx.fillStyle    = '#0D2200'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      while (ctx.measureText(playerCargo).width > cb.w * 0.88 && fs2 > 8) {
        fs2--
        ctx.font = `bold ${fs2}px "Arial", sans-serif`
      }
      ctx.fillText(playerCargo, cb.x + cb.w / 2, cb.y + cb.h / 2)
    }

  }, [processed, photoImg, offsetX, offsetY, zoom, playerName, playerCargo, sx, sy])

  useEffect(() => { render() }, [render])

  // ── Background removal + upload ───────────────────────────────────────────
  const loadImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setRemoving(true)
    setPhotoImg(null)

    const applyImage = (src) => {
      const img = new Image()
      img.src = src
      img.onload = () => { setPhotoImg(img); setOffsetX(0); setOffsetY(0); setZoom(1.0); setRemoving(false) }
    }

    try {
      const blob = await removeBackground(file)
      applyImage(URL.createObjectURL(blob))
    } catch (err) {
      const reader = new FileReader()
      reader.onload = (ev) => applyImage(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleFileChange = (e) => loadImageFile(e.target.files?.[0])
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); loadImageFile(e.dataTransfer.files?.[0]) }

  const getPos = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }
  const handlePointerDown = (e) => { if (!photoImg) return; setDragging(true); setLastPos(getPos(e)) }
  const handlePointerMove = (e) => {
    if (!dragging) return
    const pos = getPos(e)
    setOffsetX(p => p + (pos.x - lastPos.x))
    setOffsetY(p => p + (pos.y - lastPos.y))
    setLastPos(pos)
  }
  const handlePointerUp = () => setDragging(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.download = `figurinha-${playerName.replace(/\s+/g, '_') || 'jogador'}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <span style={S.headerEmoji}>⚽</span>
          <div>
            <h1 style={S.title}>FIGURINHA DA COPA</h1>
            <p style={S.subtitle}>Copa do Mundo 2026 · Crie a sua cartinha personalizada</p>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* Preview */}
        <div style={S.previewSection}>
          <div style={S.previewLabel}>
            {photoImg ? '⟵ Arraste para reposicionar' : '⬇ Suba sua foto para começar'}
          </div>
          <div
            style={{ ...S.canvasWrapper, cursor: photoImg ? (dragging ? 'grabbing' : 'grab') : 'default' }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}     onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
          >
            {!templateReady && (
              <div style={S.loadingOverlay}><div style={S.spinner} /><span>Carregando…</span></div>
            )}
            <canvas ref={canvasRef} style={S.canvas} />
          </div>
          {photoImg && (
            <div style={S.zoomRow}>
              <span style={S.zoomLabel}>🔍</span>
              <input type="range" min="0.3" max="2.5" step="0.01" value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))} style={S.slider} />
              <span style={S.zoomLabel}>{Math.round(zoom * 100)}%</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={S.controls}>
          {/* Upload */}
          <div
            style={{ ...S.uploadZone, ...(isDragOver?S.uploadActive:{}), ...(photoImg?S.uploadDone:{}), ...(removing?S.uploadLoading:{}) }}
            onClick={() => !removing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!removing) setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange} />
            {removing ? (
              <><div style={S.uploadIcon}>✂️</div><div style={S.uploadTitle}>Removendo fundo…</div><div style={S.uploadHint}>IA rodando no navegador</div><div style={S.progressBar}><div style={S.progressFill}/></div></>
            ) : photoImg ? (
              <><div style={S.uploadIcon}>✅</div><div style={S.uploadTitle}>Foto carregada!</div><div style={S.uploadHint}>Clique para trocar</div></>
            ) : (
              <><div style={S.uploadIcon}>📸</div><div style={S.uploadTitle}>Envie sua foto</div><div style={S.uploadHint}>Clique ou arraste aqui · JPG, PNG</div></>
            )}
          </div>

          <div style={S.divider}><div style={S.dividerLine}/><span style={S.dividerText}>PERSONALIZE</span><div style={S.dividerLine}/></div>

          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>🏷️ NOME</label>
            <input type="text" placeholder="Ex: Rodrigo Silva" value={playerName} maxLength={25}
              onChange={(e) => setPlayerName(e.target.value)} style={S.input} />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>💼 CARGO / POSIÇÃO</label>
            <input type="text" placeholder="Ex: Atacante" value={playerCargo} maxLength={25}
              onChange={(e) => setPlayerCargo(e.target.value)} style={S.input} />
          </div>

          {photoImg && (
            <div style={S.hintBox}><strong>💡 Dica:</strong> Arraste a foto no cartão para ajustar. Use o zoom abaixo do cartão.</div>
          )}

          <button onClick={handleDownload} disabled={!templateReady}
            style={{ ...S.downloadBtn, ...(!templateReady ? S.downloadDisabled : {}) }}>
            ⬇ BAIXAR FIGURINHA
          </button>

          <p style={S.footerNote}>Imagem gerada localmente — nenhum dado enviado para servidores.</p>
        </div>
      </main>
    </div>
  )
}

const S = {
  root: { minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Barlow Condensed', sans-serif" },
  header: { background:'linear-gradient(90deg, #006878 0%, #009eb3 100%)', borderBottom:'3px solid #f0c040', padding:'16px 24px' },
  headerInner: { maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', gap:16 },
  headerEmoji: { fontSize:40, lineHeight:1 },
  title: { fontFamily:"'Russo One', sans-serif", fontSize:'2rem', letterSpacing:'0.08em', color:'#f0c040', lineHeight:1 },
  subtitle: { fontSize:'1rem', color:'#cceef4', letterSpacing:'0.05em', marginTop:2 },
  main: { flex:1, maxWidth:1100, margin:'0 auto', width:'100%', padding:'32px 16px', display:'flex', gap:40, alignItems:'flex-start', flexWrap:'wrap', justifyContent:'center' },
  previewSection: { display:'flex', flexDirection:'column', alignItems:'center', gap:12, flex:'0 0 auto' },
  previewLabel: { fontSize:'0.85rem', color:'#8ab8c0', letterSpacing:'0.05em', textTransform:'uppercase' },
  canvasWrapper: { position:'relative', borderRadius:12, overflow:'hidden', boxShadow:'0 0 40px rgba(0,180,210,0.25), 0 20px 60px rgba(0,0,0,0.5)', border:'2px solid rgba(0,180,210,0.3)', userSelect:'none' },
  canvas: { display:'block', width:320, height:'auto', maxWidth:'90vw' },
  loadingOverlay: { position:'absolute', inset:0, background:'rgba(3,49,58,0.9)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#8ab8c0', fontSize:'0.9rem', zIndex:10 },
  spinner: { width:32, height:32, border:'3px solid rgba(0,180,210,0.2)', borderTop:'3px solid #009eb3', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  zoomRow: { display:'flex', alignItems:'center', gap:10, width:320, maxWidth:'90vw' },
  zoomLabel: { fontSize:'0.85rem', color:'#8ab8c0', minWidth:36, textAlign:'center' },
  slider: { flex:1, accentColor:'#009eb3', cursor:'pointer' },
  controls: { flex:'1 1 320px', maxWidth:420, display:'flex', flexDirection:'column', gap:20, minWidth:280 },
  uploadZone: { border:'2px dashed rgba(0,180,210,0.4)', borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.2s ease', background:'rgba(0,150,180,0.05)' },
  uploadActive: { border:'2px dashed #009eb3', background:'rgba(0,150,180,0.15)', transform:'scale(1.01)' },
  uploadDone: { border:'2px solid rgba(100,200,100,0.5)', background:'rgba(50,180,80,0.05)' },
  uploadLoading: { border:'2px dashed rgba(240,192,64,0.5)', background:'rgba(240,192,64,0.05)', cursor:'not-allowed' },
  uploadIcon: { fontSize:36, marginBottom:8 },
  uploadTitle: { fontSize:'1.1rem', fontWeight:700, letterSpacing:'0.05em', color:'#cceef4' },
  uploadHint: { fontSize:'0.85rem', color:'#8ab8c0', marginTop:4 },
  progressBar: { marginTop:12, height:4, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden', width:'80%', margin:'12px auto 0' },
  progressFill: { height:'100%', width:'40%', background:'#f0c040', borderRadius:2, animation:'slide 1.2s ease-in-out infinite' },
  divider: { display:'flex', alignItems:'center', gap:12 },
  dividerLine: { flex:1, height:1, background:'rgba(0,180,210,0.2)' },
  dividerText: { fontSize:'0.75rem', letterSpacing:'0.15em', color:'#8ab8c0' },
  fieldGroup: { display:'flex', flexDirection:'column', gap:6 },
  fieldLabel: { fontSize:'0.8rem', letterSpacing:'0.1em', color:'#8ab8c0', textTransform:'uppercase' },
  input: { background:'rgba(0,120,140,0.25)', border:'1.5px solid rgba(0,180,210,0.3)', borderRadius:8, padding:'12px 14px', color:'#f0f0f0', fontSize:'1.1rem', fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:'0.05em', outline:'none', transition:'border-color 0.2s' },
  hintBox: { background:'rgba(0,120,140,0.15)', border:'1px solid rgba(0,180,210,0.2)', borderRadius:8, padding:'10px 14px', fontSize:'0.85rem', color:'#8ab8c0', lineHeight:1.5 },
  downloadBtn: { background:'linear-gradient(135deg, #f0c040 0%, #e8a020 100%)', border:'none', borderRadius:10, padding:'16px', color:'#03313a', fontSize:'1.2rem', fontFamily:"'Russo One', sans-serif", letterSpacing:'0.08em', cursor:'pointer', boxShadow:'0 4px 20px rgba(240,192,64,0.3)' },
  downloadDisabled: { opacity:0.5, cursor:'not-allowed' },
  footerNote: { fontSize:'0.75rem', color:'#4a8090', textAlign:'center', letterSpacing:'0.03em' },
}

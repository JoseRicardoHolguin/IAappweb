import { useEffect, useRef, useState } from 'react'
import './App.css'
import Submissions from './Submissions'
import Instructions from './Instructions'
const KEY = 'poster-lab-v1'
const themes = ['Cuidado del agua', 'Consumo responsable', 'Biodiversidad', 'Energías limpias', 'Bienestar digital', 'Comunidad y colaboración']
const stickers = ['🌱', '🌍', '💧', '☀️', '🌸', '💡', '❤️', '⭐', '🦋', '♻️', '📚', '🤝']
const fresh = () => ({ theme: themes[Math.floor(Math.random() * themes.length)], started: false, activityId: crypto.randomUUID(), participante: '', inicio: null, receipt: null, background: '#fffdf7', items: [] })
function initial() {
  try { const value = JSON.parse(localStorage.getItem(KEY)); if (value && Array.isArray(value.items) && typeof value.theme === 'string') return value } catch { /* Start fresh if storage is unavailable. */ }
  return fresh()
}
export default function App() {
  const [showInstructions, setShowInstructions] = useState(true)
  const [doc, setDoc] = useState(initial)
  const [view, setView] = useState('editor')
  const [sending, setSending] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#234c43')
  const [width, setWidth] = useState(8)
  const [status, setStatus] = useState('')
  const [history, setHistory] = useState([])
  const svg = useRef(null)
  const gesture = useRef(null)
  const item = doc.items.find(value => value.id === selected)
  useEffect(() => {
    const timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(doc)) } catch { setStatus('No se pudo guardar el borrador. Descarga tu póster para conservarlo.') } }, 200)
    return () => clearTimeout(timer)
  }, [doc])
  function commit(next) { setHistory(prev => [...prev.slice(-39), doc]); setDoc(next) }
  function updateItem(changes) { commit({ ...doc, items: doc.items.map(value => value.id === selected ? { ...value, ...changes } : value) }) }
  function point(event) { const rect = svg.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(720, (event.clientX - rect.left) * 720 / rect.width)), y: Math.max(0, Math.min(960, (event.clientY - rect.top) * 960 / rect.height)) } }
  function add(kind, value, pos = { x: 240, y: 300 }) {
    const entry = { id: crypto.randomUUID(), kind, value, ...pos, size: kind === 'text' ? 42 : 100, color }
    commit({ ...doc, items: [...doc.items, entry] }); setSelected(entry.id); setTool('select')
  }
  function down(event, entry) {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    const pos = point(event); svg.current.setPointerCapture(event.pointerId)
    if (tool === 'brush') {
      const stroke = { id: crypto.randomUUID(), kind: 'path', points: [pos], color, size: width }
      gesture.current = { kind: 'brush', before: doc, id: stroke.id }
      setDoc({ ...doc, items: [...doc.items, stroke] }); setSelected(null)
    } else if (entry && entry.kind !== 'path') { setSelected(entry.id); gesture.current = { kind: 'move', before: doc, id: entry.id, pos, x: entry.x, y: entry.y } }
    else setSelected(entry?.id || null)
  }
  function move(event) {
    const active = gesture.current; if (!active) return
    const pos = point(event)
    setDoc(prev => ({ ...prev, items: prev.items.map(value => value.id !== active.id ? value : active.kind === 'brush' ? { ...value, points: [...value.points, pos] } : { ...value, x: Math.max(0, Math.min(720, active.x + pos.x - active.pos.x)), y: Math.max(0, Math.min(960, active.y + pos.y - active.pos.y)) }) }))
  }
  function finish() { if (gesture.current) { const before = gesture.current.before; setHistory(prev => [...prev.slice(-39), before]); gesture.current = null } }
  async function renderPng() {

    try {
      const clone = svg.current.cloneNode(true); clone.querySelectorAll('[data-selection]').forEach(el => el.remove()); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
      try {
        const img = new Image(); img.src = url; await img.decode()
        const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1920
        canvas.getContext('2d').drawImage(img, 0, 0, 1440, 1920)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('PNG')
        return blob
      } finally { URL.revokeObjectURL(url) }
    } catch { throw new Error('No se pudo generar el PNG.') }
  }
  async function download() {
    setStatus('Preparando PNG…')
    try {
        const blob = await renderPng()
        const png = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = png; link.download = 'mi-poster.png'; link.click(); setTimeout(() => URL.revokeObjectURL(png), 1000)
        setStatus('Póster descargado. Tu borrador sigue disponible aquí.')
    } catch { setStatus('No se pudo exportar. Intenta descargarlo de nuevo.') }
  }
  async function submit() {
    if (sending || doc.receipt) return
    if (!doc.inicio) { setStatus('Registra el inicio de este borrador antes de entregarlo.'); return }
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(doc.participante || '')) { setStatus('Escribe un código de participante (letras, números, guion o guion bajo; hasta 40 caracteres).'); return }
    if (!doc.items.length) { setStatus('Añade elementos al póster antes de entregarlo.'); return }
    if (!window.confirm('¿Entregar esta versión del póster? Se guardará en el servidor.')) return
    setSending(true); setStatus('Enviando tu póster…')
    try {
      const blob = await renderPng()
      const png = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
      const response = await fetch('/api/entregas', { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: doc.activityId, participante: doc.participante, tema: doc.theme, inicio: doc.inicio, png }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la entrega.')
      setDoc(prev => ({ ...prev, receipt: result })); setHistory([])
      setStatus('Entrega recibida correctamente. Puedes descargar tu PNG o iniciar otra actividad.')
    } catch (error) { setStatus(error.message === 'Failed to fetch' || error.name === 'TimeoutError' ? 'No se recibió confirmación del servidor. Tu borrador sigue aquí; puedes reintentar sin duplicar la entrega.' : error.message) }
    finally { setSending(false) }
  }
  function start() {
    const participante = (doc.participante || '').trim()
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(participante)) { setStatus('Escribe un código de participante válido antes de comenzar.'); return }
    commit({ ...doc, participante, started: true, inicio: new Date().toISOString(), activityId: doc.activityId || crypto.randomUUID() }); setStatus('')
  }
  return <div className="app">
    {showInstructions && <Instructions onUnderstood={() => setShowInstructions(false)} />}
    <header><a className="brand" href="./"><span className="brand-icon">✳</span> Póster<span className="brand-light">Lab</span></a><span className="header-note">Un espacio para tus ideas</span><nav><button onClick={() => setShowInstructions(true)}>Instrucciones</button><button onClick={() => setView('editor')}>Actividad</button><button onClick={() => setView('entregas')}>Consultar entregas</button></nav></header>
    {view === 'entregas' ? <Submissions /> : !doc.started ? <main className="welcome"><span className="eyebrow">DE LA IDEA AL LIENZO</span><h1>Una idea.<br />Muchas formas de contarla.</h1><p>Crea un póster sobre un tema asignado al azar. Combina texto, formas, stickers y tus propios trazos para comunicar tu mensaje.</p><div className="steps"><div><b>01</b><h3>Descubre tu tema</h3><p>Recibirás un tema al comenzar.</p></div><div><b>02</b><h3>Dale forma</h3><p>Arrastra elementos o dibuja en el lienzo.</p></div><div><b>03</b><h3>Comparte tu idea</h3><p>Entrega tu póster y descarga una copia si quieres.</p></div></div><label className="participant">Código de participante<input maxLength={40} placeholder="Ej. P001" value={doc.participante || ''} onChange={e => setDoc({ ...doc, participante: e.target.value })} /></label><button className="primary" onClick={start}>Comenzar mi póster →</button><small>Tu avance se guarda en este navegador. Los temas son provisionales.</small></main> : <>
      <section className="activity"><div><span className="eyebrow">TU RETO CREATIVO</span><h1>{doc.theme}</h1><p>Convierte este tema en un mensaje visual. El lienzo es tuyo.</p></div><div className="delivery-actions"><button disabled={sending} onClick={download}>↓ Descargar PNG</button><button className="primary" disabled={sending || !!doc.receipt} onClick={submit}>{doc.receipt ? '✓ Entregado' : sending ? 'Enviando…' : 'Entregar póster'}</button></div></section>
      <div className="delivery-info"><b>Participante: {doc.participante || 'Sin código'}</b>{!doc.inicio && <label>Este borrador anterior no tiene registro de inicio. Código<input maxLength={40} value={doc.participante || ''} onChange={e => setDoc({ ...doc, participante: e.target.value })} /></label>}{!doc.inicio && <button onClick={start}>Registrar inicio ahora</button>}{doc.receipt && <p>Entrega confirmada: {new Date(doc.receipt.entrega).toLocaleString('es-MX')} · Folio {doc.receipt.id}</p>}<p>La duración incluye pausas. Al entregar se conserva esta versión; para un nuevo envío inicia otra actividad.</p></div><main className="editor" inert={sending || !!doc.receipt}><aside className="library"><h2>Tu caja de ideas</h2><p>Arrastra al lienzo o toca para añadir.</p><h3>Herramientas</h3><div className="tools"><button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Seleccionar</button><button className={tool === 'brush' ? 'active' : ''} onClick={() => { setTool('brush'); setSelected(null) }}>✎ Pincel</button></div><label>Color <input aria-label="Color del pincel y nuevos elementos" type="color" value={color} onChange={e => setColor(e.target.value)} /></label>{tool === 'brush' && <label>Grosor · {width} px<input type="range" min="2" max="40" value={width} onChange={e => setWidth(Number(e.target.value))} /></label>}<h3>Texto y formas</h3><div className="assets">{[['text', 'Tu mensaje'], ['rect', '■'], ['circle', '●']].map(([kind, value]) => <button key={kind} aria-label={`Añadir ${kind === 'text' ? 'texto' : kind === 'rect' ? 'cuadrado' : 'círculo'}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ kind, value }))} onClick={() => add(kind, value)}>{kind === 'text' ? 'Tt Texto' : value}</button>)}</div><h3>Stickers</h3><div className="stickers">{stickers.map(value => <button key={value} aria-label={`Añadir ${value}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'sticker', value }))} onClick={() => add('sticker', value)}>{value}</button>)}</div><div className="tip">✦ Una idea clara puede decir mucho. Prueba con un título breve y un elemento principal.</div></aside>
      <section className="workspace"><div className="canvas-bar"><span>MI PÓSTER <small>720 × 960</small></span><button disabled={!history.length} onClick={() => { setDoc(history.at(-1)); setHistory(history.slice(0, -1)); setSelected(null) }}>↶ Deshacer</button></div><div className="canvas-wrap"><svg ref={svg} viewBox="0 0 720 960" width="720" height="960" aria-label="Lienzo del póster" className={tool === 'brush' ? 'drawing' : ''} onPointerDown={e => down(e)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); try { const asset = JSON.parse(e.dataTransfer.getData('text/plain')); if (['text', 'rect', 'circle', 'sticker'].includes(asset.kind) && typeof asset.value === 'string') add(asset.kind, asset.value, point(e)) } catch { /* Ignore unrelated files. */ } }}>
      <rect width="720" height="960" fill={doc.background} />{doc.items.map(entry => entry.kind === 'path' ? <path key={entry.id} d={`M ${entry.points.map(p => `${p.x},${p.y}`).join(' L ')} l 0.01 0.01`} stroke={entry.color} strokeWidth={entry.size} fill="none" strokeLinecap="round" strokeLinejoin="round" onPointerDown={e => down(e, entry)} /> : <g key={entry.id} transform={`translate(${entry.x} ${entry.y})`} onPointerDown={e => down(e, entry)} style={{ cursor: tool === 'brush' ? 'crosshair' : 'move' }}>{entry.kind === 'rect' ? <rect width={entry.size} height={entry.size} rx="8" fill={entry.color} /> : entry.kind === 'circle' ? <circle cx={entry.size / 2} cy={entry.size / 2} r={entry.size / 2} fill={entry.color} /> : <text fontFamily="Arial, Segoe UI Emoji, sans-serif" fontSize={entry.size} fill={entry.color} dominantBaseline="hanging" xmlSpace="preserve">{entry.value.split('\n').map((line, index) => <tspan key={index} x="0" dy={index ? '1.2em' : 0}>{line || ' '}</tspan>)}</text>}{selected === entry.id && <rect data-selection x="-6" y="-6" width={entry.kind === 'text' ? Math.max(...entry.value.split('\n').map(line => line.length), 1) * entry.size * 0.65 + 12 : entry.size + 12} height={entry.kind === 'text' ? entry.size * 1.2 * entry.value.split('\n').length + 12 : entry.size + 12} fill="none" stroke="#6c65df" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none" />}</g>)}</svg></div><p className="canvas-foot">{tool === 'brush' ? 'Dibuja directamente sobre el lienzo.' : 'Selecciona un elemento para moverlo y editarlo.'}</p></section>
      <aside className="properties"><h2>Detalles</h2><label>Color del lienzo<input type="color" value={doc.background} onChange={e => commit({ ...doc, background: e.target.value })} /></label>{item ? <><hr /><h3>Elemento seleccionado</h3>{item.kind === 'text' && <label>Tu mensaje<textarea value={item.value} onChange={e => updateItem({ value: e.target.value })} /></label>}<label>{item.kind === 'path' ? 'Grosor' : 'Tamaño'} · {item.size} px<input type="range" min="4" max={item.kind === 'path' ? 40 : 280} value={item.size} onChange={e => updateItem({ size: Number(e.target.value) })} /></label>{item.kind !== 'sticker' && <label>Color<input type="color" value={item.color} onChange={e => updateItem({ color: e.target.value })} /></label>}<button onClick={() => commit({ ...doc, items: [...doc.items.filter(value => value.id !== item.id), item] })}>Traer al frente</button><button className="danger" onClick={() => { commit({ ...doc, items: doc.items.filter(value => value.id !== selected) }); setSelected(null) }}>Eliminar elemento</button></> : <p className="empty">Toca un elemento del póster para ajustar sus detalles.</p>}<div className="draft"><b>Tu borrador, a salvo</b><p>Guardado automático en este navegador. Usa Entregar póster para guardar la versión final en el servidor.</p></div></aside></main><div className="new-activity"><button disabled={sending} onClick={() => { if (window.confirm('¿Iniciar otra actividad? Se reemplazará el borrador actual.')) { commit(fresh()); setSelected(null); setStatus('') } }}>Nueva actividad</button></div>
    </>}<p className="status" role="status">{status}</p><footer>PÓSTER LAB <span>Imagina · Diseña · Comunica</span></footer>
  </div>
}



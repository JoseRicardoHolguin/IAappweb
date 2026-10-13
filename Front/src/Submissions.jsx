import { useEffect, useState } from 'react'
export default function Submissions() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/admin/session', { signal: controller.signal }).then(response => { if (response.ok) setAuthenticated(true) }).catch(() => {})
    return () => controller.abort()
  }, [])
  async function login(event) {
    event.preventDefault(); setLoading(true); setStatus('')
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setPassword(''); setAuthenticated(true); setStatus('Sesión iniciada. Pulsa Actualizar para ver las entregas.')
    } catch (error) { setStatus(error.message === 'Failed to fetch' ? 'No se pudo conectar al servidor.' : error.message) }
    finally { setLoading(false) }
  }
  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/entregas', { signal: AbortSignal.timeout(15000) })
      if (response.status === 401) { setRows([]); setAuthenticated(false); throw new Error('Tu sesión terminó. Ingresa de nuevo.') }
      if (!response.ok) throw new Error('No se pudieron recuperar las entregas.')
      setRows(await response.json()); setStatus('Consulta actualizada.')
    } catch (error) { setStatus(error.message === 'Failed to fetch' ? 'No se pudo conectar. Comprueba que el backend esté encendido.' : error.message) }
    finally { setLoading(false) }
  }
  async function logout() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST', signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error()
      setAuthenticated(false); setRows([]); setStatus('Sesión cerrada.')
    } catch { setStatus('No se pudo cerrar la sesión. Intenta nuevamente.') }
    finally { setLoading(false) }
  }
  const date = value => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  if (!authenticated) return <main className="admin-login"><span className="eyebrow">SOLO ADMINISTRADOR</span><h1>Consulta tus entregas</h1><p>Ingresa tu contraseña para revisar los pósters de la actividad.</p><form onSubmit={login}><label>Contraseña<input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button></form><p role="status">{status}</p></main>
  return <main className="submissions"><div className="activity"><div><span className="eyebrow">ADMINISTRADOR</span><h1>Entregas de la actividad</h1><p>{rows.length} entregas · Horarios de Ciudad de México</p></div><div className="delivery-actions"><button onClick={load} disabled={loading}>{loading ? 'Consultando…' : 'Actualizar'}</button><button onClick={logout} disabled={loading}>Cerrar sesión</button></div></div><p role="status">{status}</p><div className="table-wrap"><table><thead><tr><th>Participante</th><th>Tema</th><th>Inicio</th><th>Entrega</th><th>Duración</th><th>Póster</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.participante}</td><td>{row.tema}</td><td>{date(row.inicio)}</td><td>{date(row.entrega)}</td><td>{Math.floor(row.duracion_segundos / 60)} min {row.duracion_segundos % 60} s</td><td><a href={row.pngUrl}>Descargar PNG</a></td></tr>)}</tbody></table>{!rows.length && <p>No hay entregas cargadas. Pulsa Actualizar para consultar.</p>}</div><p>El tiempo registrado incluye pausas y cierres del navegador. La sesión dura hasta 8 horas.</p></main>
}

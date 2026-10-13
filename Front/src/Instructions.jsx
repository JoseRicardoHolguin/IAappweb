import { useEffect, useRef } from 'react'

export default function Instructions({ onUnderstood }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={dialog} className="instructions-dialog" aria-labelledby="instructions-title" aria-describedby="instructions-intro" onCancel={event => event.preventDefault()}>
    <span className="eyebrow">ANTES DE COMENZAR</span>
    <h2 id="instructions-title">¡Dale forma a tu idea!</h2>
    <p id="instructions-intro">Tu reto es crear un póster que comunique un mensaje sobre el tema que te toque.</p>
    <ol className="instructions-steps">
      <li><strong>Identifícate y descubre tu tema</strong><p>Escribe tu código de participante y pulsa “Comenzar mi póster”. Recibirás un tema al azar.</p></li>
      <li><strong>Crea a tu manera</strong><p>Arrastra textos, formas y stickers al lienzo, o añádelos con un clic. Usa el pincel para dibujar.</p></li>
      <li><strong>Ajusta los detalles</strong><p>Selecciona un elemento para moverlo. En “Detalles” puedes cambiar su texto, tamaño o color. Usa “Deshacer” si necesitas volver atrás.</p></li>
      <li><strong>Entrega tu creación</strong><p>Cuando termines, pulsa “Entregar póster” y confirma. Espera el mensaje de entrega recibida y tu folio.</p></li>
    </ol>
    <p className="instructions-note"><strong>¿Quieres una copia?</strong> “Descargar PNG” guarda la imagen en tu dispositivo. Para enviar tu trabajo, también debes pulsar “Entregar póster”.</p>
    <p className="instructions-save">Tu borrador se guarda automáticamente en este navegador. Si vuelves a entrar, podrás continuar aquí.</p>
    <form method="dialog" onSubmit={onUnderstood}><button className="primary" autoFocus>Entendido →</button></form>
  </dialog>
}

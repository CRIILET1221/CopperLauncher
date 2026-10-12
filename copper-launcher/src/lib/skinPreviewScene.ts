import { AmbientLight, BoxGeometry, CanvasTexture, DirectionalLight, DoubleSide, Group, Mesh, MeshLambertMaterial, NearestFilter, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { loadSkinToCanvas } from 'skinview-utils'

export interface SkinScene { dispose(): void; rotate(delta: number): void; reset(): void }

// Minecraft cuboid texture layout: each part has six faces in the 64x64 atlas.
function skinBox(width: number, height: number, depth: number, u: number, v: number, expand = 0) {
  const geometry = new BoxGeometry(width + expand, height + expand, depth + expand)
  const faces = [
    [u + depth + width, v + depth, depth, height],
    [u, v + depth, depth, height],
    [u + depth, v, width, depth],
    [u + depth + width, v, width, depth],
    [u + depth, v + depth, width, height],
    [u + 2 * depth + width, v + depth, width, height],
  ]
  const uv = geometry.getAttribute('uv')
  faces.forEach(([x, y, w, h], face) => {
    const points = face === 3 ? [[x, y + h], [x + w, y + h], [x, y], [x + w, y]] : [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
    points.forEach(([px, py], corner) => uv.setXY(face * 4 + corner, px / 64, 1 - py / 64))
  })
  return geometry
}

export async function createSkinScene(canvas: HTMLCanvasElement, src: string, slim: boolean, contextLost: () => void, signal: AbortSignal): Promise<SkinScene> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Не удалось загрузить текстуру.')); image.src = src })
  if (signal.aborted) throw new Error('Предпросмотр закрыт.')
  const textureCanvas = document.createElement('canvas')
  loadSkinToCanvas(textureCanvas, image) // Converts legacy 64x32 skins and normalizes their second layer.
  const texture = new CanvasTexture(textureCanvas)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace
  let renderer: WebGLRenderer
  try { renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true }) } catch(e) { texture.dispose(); throw e }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new Scene()
  const camera = new PerspectiveCamera(36, 1, 0.1, 200)
  const model = new Group()
  scene.add(model, new AmbientLight(0xffffff, 2))
  const light = new DirectionalLight(0xffffff, 2.2)
  light.position.set(-20, 40, 40); scene.add(light)
  const base = new MeshLambertMaterial({ map: texture })
  const overlay = new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.01, side: DoubleSide })
  const geometries: BoxGeometry[] = []
  const part = (w: number, h: number, d: number, x: number, y: number, u: number, v: number, ou: number, ov: number, padding = 0.5) => {
    for (const outer of [false, true]) {
      const geometry = skinBox(w, h, d, outer ? ou : u, outer ? ov : v, outer ? padding : 0)
      geometries.push(geometry)
      const mesh = new Mesh(geometry, outer ? overlay : base)
      mesh.position.set(x, y, 0); model.add(mesh)
    }
  }
  const arm = slim ? 3 : 4
  part(8, 8, 8, 0, 12, 0, 0, 32, 0, 1)
  part(8, 12, 4, 0, 2, 16, 16, 16, 32)
  part(arm, 12, 4, -(4 + arm / 2), 2, 40, 16, 40, 32)
  part(arm, 12, 4, 4 + arm / 2, 2, 32, 48, 48, 48)
  part(4, 12, 4, -2, -10, 0, 16, 0, 32)
  part(4, 12, 4, 2, -10, 16, 48, 0, 48)
  let distance = 64, disposed = false
  const render = () => { if (!disposed) { camera.position.set(0, 1, distance); camera.lookAt(0, 0, 0); renderer.render(scene, camera) } }
  const reset = () => { model.rotation.set(0.06, -0.35, 0); distance = 64; render() }
  const resize = () => {
    const width = canvas.clientWidth || 280, height = canvas.clientHeight || 300
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render()
  }
  let drag: { id: number; x: number; y: number } | null = null
  const down = (event: PointerEvent) => { drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId) }
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    model.rotation.y += (event.clientX - drag.x) * 0.012
    model.rotation.x = Math.max(-0.6, Math.min(0.6, model.rotation.x + (event.clientY - drag.y) * 0.008))
    drag.x = event.clientX; drag.y = event.clientY; render()
  }
  const up = () => { drag = null }
  const wheel = (event: WheelEvent) => { event.preventDefault(); distance = Math.max(46, Math.min(95, distance + event.deltaY * 0.025)); render() }
  const lost = (event: Event) => { event.preventDefault(); contextLost() }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('webglcontextlost', lost)
  const observer = new ResizeObserver(resize); observer.observe(canvas)
  reset(); resize()
  return {
    reset,
    rotate(delta) { model.rotation.y += delta; render() },
    dispose() {
      disposed = true; observer.disconnect()
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('webglcontextlost', lost)
      geometries.forEach(g => g.dispose()); base.dispose(); overlay.dispose(); texture.dispose(); renderer.dispose()
    },
  }
}


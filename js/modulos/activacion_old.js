// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: FUNCIÓN DE ACTIVACIÓN
// Variable : función de activación en capas ocultas
// Fijo     : η=0.05, Xavier (semilla=1), sin dropout, red 2→4→1
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN ──────────────────────────────────────────────────────────

let activacionesActivas = ['relu', 'sigmoid', 'tanh', 'lineal', 'leaky_relu'];

const NOMBRES_ACTIVACION = {
  relu:       'ReLU',
  sigmoid:    'Sigmoid',
  tanh:       'Tanh',
  lineal:     'Lineal',
  leaky_relu: 'Leaky ReLU'
};

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function generarEnjambreActivacion() {
  // TODO: implementar en la siguiente sesión
  console.warn('[Activación] módulo pendiente de implementar');
  modelos = [];
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayActivacion() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;
  const div = document.createElement('div');
  div.id = 'controles-activacion';
  div.style.display = 'none';
  div.innerHTML = `<div style="font-size:11px;color:#888;padding:8px">Módulo próximamente</div>`;
  overlay.appendChild(div);
}

function actualizarUIEstadoActivacion() {
  // TODO: implementar cuando se desarrolle el módulo
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosActivacion(r3) {
  // TODO: implementar
}

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: DROPOUT
// Variable : tasa p ∈ {0.0, 0.1, 0.2, 0.3, 0.4, 0.5} — 6 modelos fijos
// Fijo     : η=0.05, Xavier (semilla=1), ReLU, red 2→4→1
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN ──────────────────────────────────────────────────────────

const TASAS_DROPOUT = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5];

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function generarEnjambreDropout() {
  // TODO: implementar en la siguiente sesión
  console.warn('[Dropout] módulo pendiente de implementar');
  modelos = [];
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayDropout() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;
  const div = document.createElement('div');
  div.id = 'controles-dropout';
  div.style.display = 'none';
  div.innerHTML = `<div style="font-size:11px;color:#888;padding:8px">Módulo próximamente</div>`;
  overlay.appendChild(div);
}

function actualizarUIEstadoDropout() {
  // TODO: implementar cuando se desarrolle el módulo
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosDropout(r3) {
  // TODO: implementar
}

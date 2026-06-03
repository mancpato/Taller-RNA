// ============================================================================
// estado.js — Máquina de estados, control del enjambre, overlay Panel 3
// ============================================================================

// ── Máquina de estados ────────────────────────────────────────────────────────

function transicionar(nuevoEstado) {
  if (nuevoEstado !== estado) {
    estado = nuevoEstado;
  }
}

function enEstado(...estados) {
  return estados.includes(estado);
}

function iniciarEntrenamiento() {
  if (modelos && modelos.length > 0) {
    const vals = modelos.map(m =>
      m.historial && m.historial.length > 0 ? m.historial[0].J_train : 1.0);
    J_max_epoca0 = Math.max(...vals, 0.01);
  } else {
    J_max_epoca0 = 1.0;
  }

  let mejorJ = Infinity, mejorRef = 0;
  for (let i = 0; i < modelos.length; i++) {
    const h0 = modelos[i].historial;
    if (h0 && h0.length > 0 && h0[0].J_test < mejorJ) {
      mejorJ = h0[0].J_test; mejorRef = i;
    }
  }
  modeloReferencia = mejorRef;
  transicionar('RUNNING');
  actualizarUIEstado();
}

function detener() {
  transicionar('PAUSED');
  actualizarUIEstado();
}

function continuar() {
  transicionar('RUNNING');
  actualizarUIEstado();
}

function converger() {
  transicionar('CONVERGED');
  actualizarUIEstado();
}

function reiniciar() {
  transicionar('IDLE');
  actualizarUIEstado();
  modeloReferencia         = null;
  distribucionSeleccionada = null;
  _epochTarget             = null;
  initEnjambre();
}

function resetear() {
  transicionar('IDLE');
  actualizarUIEstado();
  modeloReferencia         = null;
  distribucionSeleccionada = null;
  _epochTarget             = null;
  initEnjambre();
}

function avanzar100() {
  if (enEstado('CONVERGED')) return;
  const epActual = modelos.length > 0
    ? Math.max(...modelos.map(m => m.historial.length)) : 0;
  if (epActual >= maximoEpocas) {
    notificar('Épocas máximas alcanzadas — sube el límite para continuar');
    return;
  }
  _epochTarget = Math.min(epActual + 100, maximoEpocas);
  modelos.forEach(m => {
    if (m.estado === 'no_convergido') m.estado = 'activo';
  });
  if (enEstado('IDLE'))        iniciarEntrenamiento();
  else if (enEstado('PAUSED')) { transicionar('RUNNING'); actualizarUIEstado(); }
}

function notificar(texto) {
  notificacion = { texto, frameInicio: frameCount, duracion: 120 };
}

// ── Control del enjambre ─────────────────────────────────────────────────────

function pasosPorFrame() {
  if (velocidad === 'lenta')  return 1;
  if (velocidad === 'rapida') return 25;
  return 5;
}

function stepModelo(m) {
  if (m.estado !== 'activo') return;

  const J_ant = m.historial.length > 0
    ? m.historial[m.historial.length - 1].J_train : Infinity;

  entrenarEpoca(m, datosTrain);

  const { diverge } = verificarDivergencia(m, J_ant);
  if (diverge) {
    m.frontera = calcularFronteraModelo(m);
    m.estado = 'divergente';
    return;
  }
  if (m.historial.length >= maximoEpocas) {
    m.frontera = calcularFronteraModelo(m);
    m.estado = 'no_convergido';
    return;
  }
  if (verificarConvergencia(m)) {
    m.frontera = calcularFronteraModelo(m);
    m.estado = 'convergido';
    m.epocaFinal = m.historial.length;
  }
}

function initEnjambre() {
  if      (moduloActivo === 'eta')         generarEnjambreEta(etaMinVal, etaMaxVal);
  else if (moduloActivo === 'init')        generarEnjambreInit();
  else if (moduloActivo === 'activacion')  generarEnjambreActivacion();
  else if (moduloActivo === 'momentum')    generarEnjambreMomentum();
  else if (moduloActivo === 'topologia')   generarEnjambreTopologia();
  else if (moduloActivo === 'experimento') iniciarModuloExperimento();
}

function dibujarControlesPanel3() {
  const r3 = panelRect(3);
  if (moduloActivo === 'experimento') { dibujarControlesExperimento(r3); return; }
  if (!modelos || modelos.length === 0) return;
  if      (moduloActivo === 'eta')        dibujarCirculosEta(r3);
  else if (moduloActivo === 'init')       dibujarCirculosInit(r3);
  else if (moduloActivo === 'activacion') dibujarCirculosActivacion(r3);
  else if (moduloActivo === 'momentum')   dibujarCirculosMomentum(r3);
  else if (moduloActivo === 'topologia')  dibujarCirculosTopologia(r3);
}

// ── Overlay Panel 3 (DOM) ─────────────────────────────────────────────────────

function crearOverlayPanel3() {
  let overlay = document.getElementById('panel3-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'panel3-overlay';
  // Solo el botón principal es común a todos los módulos
  overlay.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center">
      <button id="btn-principal">Entrenar enjambre</button>
      <button id="btn-reiniciar-paused" style="display:none">Reiniciar</button>
    </div>
    <hr class="p3-sep">
  `;
  document.body.appendChild(overlay);

  document.getElementById('btn-reiniciar-paused').addEventListener('click', resetear);

  document.getElementById('btn-principal').addEventListener('click', () => {
    if      (enEstado('IDLE'))      iniciarEntrenamiento();
    else if (enEstado('RUNNING'))   detener();
    else if (enEstado('PAUSED'))    continuar();
    else if (enEstado('CONVERGED')) reiniciar();
  });

  // Cada módulo añade su sección
  crearSeccionOverlayEta();
  crearSeccionOverlayInit();
  crearSeccionOverlayActivacion();
  crearSeccionOverlayMomentum();
  crearSeccionOverlayTopologia();
  crearSeccionOverlayExperimento();

  posicionarOverlayPanel3();
}

function actualizarModuloOverlay() {
  ['topologia', 'activacion', 'init', 'eta', 'momentum', 'experimento'].forEach(mod => {
    const div = document.getElementById(`controles-${mod}`);
    if (div) div.style.display = moduloActivo === mod ? 'block' : 'none';
  });
  const btnPrincipal = document.getElementById('btn-principal');
  if (btnPrincipal) btnPrincipal.style.display = moduloActivo === 'experimento' ? 'none' : '';
  const idEpocas = {
    topologia: 'select-epocas-topo',
    activacion: 'select-epocas-act',
    init:       'select-epocas-init',
    eta:        'select-epocas-eta',
    momentum:   'select-epocas-mom'
  };
  const sel = document.getElementById(idEpocas[moduloActivo]);
  if (sel) sel.value = maximoEpocas;
}

function actualizarUIEstado() {
  // Botón principal (común)
  const btn = document.getElementById('btn-principal');
  if (btn) {
    const etiquetas = {
      IDLE: 'Entrenar enjambre', RUNNING: 'Detener',
      PAUSED: 'Continuar',       CONVERGED: 'Reiniciar'
    };
    btn.textContent = etiquetas[estado] || 'Entrenar enjambre';
  }

  // Botón reiniciar en PAUSED
  const btnReinPaused = document.getElementById('btn-reiniciar-paused');
  if (btnReinPaused) btnReinPaused.style.display = enEstado('PAUSED') ? 'inline-block' : 'none';

  // Barra global (común)
  const enMovimiento = enEstado('RUNNING', 'PAUSED');
  ['select-problema', 'slider-ruido', 'slider-train', 'btn-semilla'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = enMovimiento;
  });

  // Cada módulo actualiza sus propios controles
  actualizarUIEstadoEta();
  actualizarUIEstadoInit();
  actualizarUIEstadoActivacion();
  actualizarUIEstadoMomentum();
  actualizarUIEstadoTopologia();
  actualizarUIEstadoExperimento();
}

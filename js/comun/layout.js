// ============================================================================
// layout.js — Geometría de paneles, barra global, pestañas, notificaciones
// ============================================================================

function panelRect(id) {
  const areaX = 0;
  const areaY = TOOLBAR_HEIGHT + TAB_HEIGHT;
  const areaW = windowWidth;
  const areaH = windowHeight - TOOLBAR_HEIGHT - TAB_HEIGHT;

  const filaAlturaSuper = areaH * VERTICAL_RATIO;
  const filaAlturaInf   = areaH * (1 - VERTICAL_RATIO);
  const colAncho        = areaW * HORIZONTAL_RATIO;

  switch (id) {
    case 1: return { x: areaX,           y: areaY,                    w: colAncho,        h: filaAlturaSuper };
    case 2: return { x: areaX + colAncho, y: areaY,                   w: areaW - colAncho, h: filaAlturaSuper };
    case 3: return { x: areaX,           y: areaY + filaAlturaSuper,  w: colAncho,        h: filaAlturaInf   };
    case 4: return { x: areaX + colAncho, y: areaY + filaAlturaSuper, w: areaW - colAncho, h: filaAlturaInf   };
  }
  return null;
}

function panelCoords(id, xNorm, yNorm) {
  const r = panelRect(id);
  return { px: r.x + xNorm * r.w, py: r.y + yNorm * r.h };
}

// ── Paneles ──────────────────────────────────────────────────────────────────

function dibujarPaneles() {
  dibujarPanel(1, 'PANEL 1: Espacio de salida',    panelRect(1));
  dibujarPanel(2, 'PANEL 2: Historial de pérdida', panelRect(2));
  dibujarPanel(3, 'PANEL 3: Controles del módulo', panelRect(3));
  dibujarPanel(4, 'PANEL 4: Estadísticas',          panelRect(4));
}

function dibujarPanel(id, titulo, r) {
  fill(PANEL_BG);
  stroke(BORDER_COLOR);
  strokeWeight(BORDER_WIDTH);
  rectMode(CORNER);
  rect(r.x, r.y, r.w, r.h);

  fill(100); textSize(11); textAlign(LEFT, TOP);
  text(titulo, r.x + 8, r.y + 6);

  if (id === 1 && datosTrain && datosTest) {
    const total = datosTrain.length + datosTest.length;
    const train = datosTrain.length;
    textSize(12); fill(120); textAlign(RIGHT, TOP);
    text(`n=${total}  train=${train}`, r.x + r.w - 80, r.y + 7);
  }

  stroke(BORDER_COLOR); strokeWeight(BORDER_WIDTH);
  line(r.x, r.y + 24, r.x + r.w, r.y + 24);
}

// ── Barra global ─────────────────────────────────────────────────────────────

function dibujarBarraGlobal() {
  const h = TOOLBAR_HEIGHT;
  fill(245, 245, 245); stroke(200); strokeWeight(1);
  rect(0, TAB_HEIGHT, windowWidth, h);

  let textoArq;
  if (moduloActivo === 'eta') {
    textoArq = `2→4→1 · ReLU · η∈[${etaMinVal.toFixed(3)}, ${etaMaxVal.toFixed(3)}] · SGD+mom`;
  } else if (moduloActivo === 'init') {
    textoArq = '2→4→1 · ReLU · η=0.05 · SGD+mom';
  } else if (moduloActivo === 'activacion') {
    textoArq = '2→4→1 · η=0.05 · Xavier · SGD+mom';
  } else if (moduloActivo === 'momentum') {
    textoArq = '2→4→1 · ReLU · η=0.05 · Xavier · β∈{0,0.3,0.6,0.9}';
  } else if (moduloActivo === 'dropout') {
    textoArq = '2→4→1 · ReLU · η=0.05 · Xavier · SGD+mom';
  } else if (moduloActivo === 'topologia') {
    textoArq = 'ReLU fija · η=0.05 · Xavier · SGD+mom';
  } else {
    textoArq = '2→4→1 · ReLU · η=0.05 · SGD+mom';
  }

  fill(100); textSize(11); textAlign(RIGHT, CENTER);
  text(textoArq, windowWidth - 12, TAB_HEIGHT + h / 2);
}

function dibujarPestanas() {
  const y = 0;
  const h = TAB_HEIGHT;
  const pestanas = [
    { label: 'Topología',            id: 'topologia' },
    { label: 'Activación',           id: 'activacion'},
    { label: 'Inicialización',       id: 'init'      },
    { label: 'Tasa de aprendizaje', id: 'eta'       },
    { label: 'Momentum',             id: 'momentum'  }
  ];

  let x = 8;
  const ancho = 140;

  for (const p of pestanas) {
    const esActiva = p.id === moduloActivo;
    fill(esActiva ? color(200, 200, 255) : color(230, 230, 230));
    stroke(150); strokeWeight(1);
    rect(x, y, ancho, h);
    fill(0); textSize(12); textAlign(CENTER, CENTER);
    text(p.label, x + ancho / 2, y + h / 2);
    x += ancho + 2;
  }

  noStroke(); textStyle(BOLD); textSize(20); textAlign(RIGHT, CENTER);
  fill(123, 82, 212);
  text('RNA', windowWidth - 12, h / 2);
  fill(60);
  text('Talle', windowWidth - 12 - textWidth('RNA'), h / 2);
  textStyle(NORMAL);
}

// ── Notificaciones ────────────────────────────────────────────────────────────

function dibujarNotificacion() {
  const estaActiva = frameCount - notificacion.frameInicio < notificacion.duracion;
  if (!estaActiva) return;

  const r3 = panelRect(3);
  const margen = 8;
  const x = r3.x + margen;
  const y = r3.y + r3.h - 105;
  const w = r3.w - 2 * margen;
  const h = 24;

  fill(255, 248, 225, 0.9 * 255);
  stroke(200, 200, 200); strokeWeight(1);
  rectMode(CORNER);
  rect(x, y, w, h, 4);

  fill(85, 85, 85); textAlign(LEFT, CENTER); textSize(11);
  text(notificacion.texto, x + 8, y + h / 2);
}

// ── Overlay barra global (DOM) ────────────────────────────────────────────────

function crearOverlayBarra() {
  const div = document.createElement('div');
  div.id = 'barra-overlay';
  div.innerHTML = `
    <label>Problema:
      <select id="select-problema">
        <option value="lineal" selected>Lineal</option>
        <option value="xor">XOR</option>
        <option value="circulos">Círculos</option>
        <option value="medialuna">Media luna</option>
        <option value="espiral">Espiral</option>
        <option value="seno" disabled style="color:#aaa">Regresión seno (próximamente)</option>
      </select>
    </label>
    <label>Ruido: <input type="range" id="slider-ruido" min="0" max="50" step="1" value="0">
      <span id="val-ruido">0%</span>
    </label>
    <label>Train: <input type="range" id="slider-train" min="50" max="90" step="5" value="80">
      <span id="val-train">80%</span>
    </label>
    <label style="display:inline-flex;align-items:center;gap:4px">Semilla:
      <input type="number" id="input-semilla-global" min="1" max="99999" step="1"
        style="width:64px;font-size:12px;text-align:center" value="${semillaDatos}">
    </label>
    <button id="btn-semilla">⚄</button>
  `;
  document.body.appendChild(div);

  document.getElementById('select-problema').addEventListener('change', function () {
    problema = this.value;
    aplicarParametrosBarra();
  });
  document.getElementById('slider-ruido').addEventListener('input', e => {
    nivelRuido = parseInt(e.target.value);
    document.getElementById('val-ruido').textContent = nivelRuido + '%';
  });
  document.getElementById('slider-ruido').addEventListener('change', () => aplicarParametrosBarra());
  document.getElementById('slider-train').addEventListener('input', e => {
    trainRatio = parseInt(e.target.value) / 100;
    document.getElementById('val-train').textContent = e.target.value + '%';
  });
  document.getElementById('slider-train').addEventListener('change', () => aplicarParametrosBarra());

  document.getElementById('btn-semilla').addEventListener('click', function () {
    semillaDatos = Math.floor(Math.random() * 99999) + 1;
    document.getElementById('input-semilla-global').value = semillaDatos;
    aplicarParametrosBarra();
  });

  const _inputSemilla = document.getElementById('input-semilla-global');
  console.log('[layout] input-semilla-global existe=',
    document.getElementById('input-semilla-global'));
  _inputSemilla.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const v = parseInt(this.value);
    if (Number.isInteger(v) && v >= 1 && v <= 99999 && v !== semillaDatos) {
      semillaDatos = v;
      aplicarParametrosBarra();
    } else {
      this.value = semillaDatos;
    }
  });
  _inputSemilla.addEventListener('blur', function () {
    const v = parseInt(this.value);
    if (Number.isInteger(v) && v >= 1 && v <= 99999 && v !== semillaDatos) {
      semillaDatos = v;
      aplicarParametrosBarra();
    } else {
      this.value = semillaDatos;
    }
  });
}

function posicionarOverlayBarra() {
  const overlay = document.getElementById('barra-overlay');
  if (!overlay) return;
  overlay.style.width = windowWidth + 'px';
  overlay.style.top   = TAB_HEIGHT + 'px';
}

function aplicarParametrosBarra() {
  if (enEstado('RUNNING') || enEstado('PAUSED')) {
    notificar('Detén el entrenamiento antes de cambiar el problema');
    return;
  }
  const _inp = document.getElementById('input-semilla-global');
  if (_inp) _inp.value = semillaDatos;
  const resultado = generarDatos(problema, nivelRuido / 100, trainRatio, semillaDatos);
  const norm = normalizarDatos(resultado.datosTrain, resultado.datosTest);
  datosTrain = norm.datosTrain;
  datosTest  = norm.datosTest;
  resetear();
}

function posicionarOverlayPanel3() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;
  const r3 = panelRect(3);
  overlay.style.left   = r3.x + 'px';
  overlay.style.top    = (r3.y + 28) + 'px';
  overlay.style.width  = r3.w + 'px';
  overlay.style.height = Math.max(20, r3.h - 28 - 55) + 'px';
}

function obtenerEtiquetaBoton() {
  switch (estado) {
    case 'IDLE':      return '[ Entrenar enjambre ]';
    case 'RUNNING':   return '[ Detener ]';
    case 'PAUSED':    return '[ Continuar ]';
    case 'CONVERGED': return '[ Reiniciar ]';
    default:          return '[ Entrenar enjambre ]';
  }
}

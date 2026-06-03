/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: topologia.js
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * @description: Módulo para comparar 8 arquitecturas fijas de red neuronal.
 * Variable: topología (T0–T7). Fijo: η=0.05, Xavier semilla=1, ReLU, sin dropout.
 */

// ── 1. CONFIGURACIÓN ──────────────────────────────────────────────────────────

const TOPOLOGIAS_DEF = [
  { id: 'T0', capas: [2, 1],          etiqueta: 'T0: 2→1'         },
  { id: 'T1', capas: [2, 2, 1],       etiqueta: 'T1: 2→2→1'       },
  { id: 'T2', capas: [2, 3, 1],       etiqueta: 'T2: 2→3→1'       },
  { id: 'T3', capas: [2, 4, 1],       etiqueta: 'T3: 2→4→1 ★'     },
  { id: 'T4', capas: [2, 2, 3, 1],    etiqueta: 'T4: 2→2→3→1'     },
  { id: 'T5', capas: [2, 3, 2, 1],    etiqueta: 'T5: 2→3→2→1'     },
  { id: 'T6', capas: [2, 4, 4, 1],    etiqueta: 'T6: 2→4→4→1'     },
  { id: 'T7', capas: [2, 6, 4, 1],    etiqueta: 'T7: 2→6→4→1'     }
];

let topologiasActivas  = ['T0', 'T3', 'T6'];
let _debounceTopologia = null;

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function generarEnjambreTopologia() {
  modelos            = [];
  modeloSeleccionado = null;
  modeloHover        = null;
  modeloReferencia   = null;
  J_max_epoca0       = 1.0;
  modoLogPanel2      = false;
  modoAccPanel2      = false;

  const nEnt = esTipoClasif ? 2 : 1;
  const activas = TOPOLOGIAS_DEF.filter(t => topologiasActivas.includes(t.id));
  for (const topo of activas) {
    const capas = topo.capas.map((n, i) => i === 0 ? nEnt : n);
    const actTopo = esTipoClasif ? 'relu' : 'tanh';
    const m    = crearModelo(capas, actTopo, 0.05, 0, 1, 'xavier');
    m.etiqueta = topo.id + ': ' + capas.join('→') + (topo.id === 'T3' ? ' ★' : '');
    m.color    = PALETAS.topologia[topo.id];
    m.topoId   = topo.id;

    m.frontera = calcularFronteraModelo(m);
    modelos.push(m);
  }

  // modeloReferencia = T3 (red base) si está activa, si no el primero
  const idxT3 = modelos.findIndex(m => m.topoId === 'T3');
  modeloReferencia = idxT3 >= 0 ? idxT3 : (modelos.length > 0 ? 0 : null);

  if (modelos.length > 0) {
    modeloMapa = modelos[modeloReferencia ?? 0];
    renderizarMapa(modeloMapa);
  }

  _actualizarContadorTopologia();
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayTopologia() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.id = 'controles-topologia';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="p3-row">
      <label>Épocas máx.:&nbsp;<select id="select-epocas-topo">
        <option value="500">500</option>
        <option value="1000" selected>1000</option>
        <option value="2000">2000</option>
        <option value="5000">5000</option>
        <option value="10000">10000</option>
        <option value="20000">20000</option>
      </select></label>
      <label style="margin-left:10px">Velocidad:&nbsp;
        <select id="select-velocidad-topo">
          <option value="lenta">Lenta</option>
          <option value="normal" selected>Normal</option>
          <option value="rapida">Rápida</option>
        </select>
      </label>
      <button id="btn-paso-topo" style="margin-left:10px">+100</button>
    </div>
    <hr class="p3-sep">
    <div id="topo-aviso-regresion" style="display:none;font-size:11px;color:#888;margin-bottom:4px">
      ⚠ Regresión: primera capa reducida a 1 entrada
    </div>
    <div style="font-size:11px;color:#888;margin-bottom:4px">
      Selecciona las arquitecturas a comparar:
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px 8px;margin:6px 0;font-size:12px" id="topo-grid">
    </div>
  `;
  overlay.appendChild(div);

  document.getElementById('select-epocas-topo').addEventListener('change', e => {
    maximoEpocas = parseInt(e.target.value);
  });
  document.getElementById('select-velocidad-topo').addEventListener('change', e => {
    velocidad = e.target.value;
  });
  document.getElementById('btn-paso-topo').addEventListener('click', avanzar100);

  // Grid 4×2: columna c = T(c), T(c+4) — orden: T0 T2 T4 T6 / T1 T3 T5 T7
  const grid = document.getElementById('topo-grid');
  const orden = [0, 2, 4, 6, 1, 3, 5, 7]; // índices en TOPOLOGIAS_DEF para rellenar por columna
  orden.forEach(idx => {
    const topo  = TOPOLOGIAS_DEF[idx];
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '4px';
    const checked = topologiasActivas.includes(topo.id) ? 'checked' : '';
    label.innerHTML = `<input type="checkbox" id="cb-topo-${topo.id}" ${checked}>&nbsp;${topo.etiqueta}`;
    grid.appendChild(label);
  });

  TOPOLOGIAS_DEF.forEach(topo => {
    document.getElementById(`cb-topo-${topo.id}`).addEventListener('change', () => {
      if (enEstado('RUNNING', 'PAUSED')) {
        document.getElementById(`cb-topo-${topo.id}`).checked =
          topologiasActivas.includes(topo.id);
        notificar('Cambio ignorado durante entrenamiento');
        return;
      }

      const activas = TOPOLOGIAS_DEF
        .filter(t => document.getElementById(`cb-topo-${t.id}`).checked)
        .map(t => t.id);

      if (activas.length === 0) {
        document.getElementById(`cb-topo-${topo.id}`).checked = true;
        return;
      }

      topologiasActivas = activas;
      _actualizarContadorTopologia();

      clearTimeout(_debounceTopologia);
      _debounceTopologia = setTimeout(() => resetear(), 300);
    });
  });
}

function _actualizarContadorTopologia() {
  const el = document.getElementById('topo-contador');
  if (el) el.textContent = `${topologiasActivas.length} modelos seleccionados`;
}

function actualizarUIEstadoTopologia() {
  const bloqueado     = enEstado('RUNNING', 'PAUSED');
  const bloqueadoPaso = enEstado('RUNNING', 'CONVERGED');

  TOPOLOGIAS_DEF.forEach(topo => {
    const el = document.getElementById(`cb-topo-${topo.id}`);
    if (el) el.disabled = bloqueado;
  });

  const epEl = document.getElementById('select-epocas-topo');
  if (epEl) epEl.disabled = bloqueado;

  const btnPaso = document.getElementById('btn-paso-topo');
  if (btnPaso) btnPaso.disabled = bloqueadoPaso;

  const aviso = document.getElementById('topo-aviso-regresion');
  if (aviso) aviso.style.display = esTipoClasif ? 'none' : 'block';
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosTopologia(r3) {
  if (!modelos || modelos.length === 0) return;

  const DIAM   = 10;
  const SEP    = 48;
  const totalW = modelos.length * SEP - (SEP - DIAM);
  const cirX0  = r3.x + (r3.w - totalW) / 2;
  const cirY   = r3.y + r3.h - 40;

  for (let i = 0; i < modelos.length; i++) {
    const m  = modelos[i];
    const cx = cirX0 + i * SEP;
    const c  = m.color;

    // Círculo principal
    fill(red(c), green(c), blue(c)); noStroke();
    ellipse(cx, cirY, DIAM);

    // Anillo de estado
    noFill();
    if (m.estado === 'convergido') {
      stroke(46, 204, 113); strokeWeight(2);
      ellipse(cx, cirY, DIAM + 6);
    } else if (m.estado === 'divergente') {
      stroke(226, 75, 74); strokeWeight(2);
      ellipse(cx, cirY, DIAM + 6);
      const d = DIAM * 0.38; strokeWeight(1.5);
      line(cx - d, cirY - d, cx + d, cirY + d);
      line(cx + d, cirY - d, cx - d, cirY + d);
    } else if (m.estado === 'no_convergido') {
      stroke(150); strokeWeight(1.5);
      ellipse(cx, cirY, DIAM + 6);
    }

    // Selección y hover
    if (modeloSeleccionado === i) {
      noFill(); stroke(30); strokeWeight(2.5);
      ellipse(cx, cirY, DIAM + 11);
    } else if (modeloHover === i) {
      noFill(); stroke(100); strokeWeight(1);
      ellipse(cx, cirY, DIAM + 9);
    }

    // Métrica encima
    if (m.historial && m.historial.length > 0) {
      const ult = m.historial[m.historial.length - 1];
      noStroke(); textSize(10); textAlign(CENTER, BOTTOM);
      if (esTipoClasif && ult.accuracy_test !== undefined && ult.accuracy_test !== null) {
        const acc = ult.accuracy_test;
        fill(acc > 0.75 ? color(46, 180, 90)
           : acc > 0.50 ? color(200, 160, 0)
           : color(160));
        text((acc * 100).toFixed(0) + '%', cx, cirY - DIAM / 2 - 3);
      } else if (ult.J_test !== undefined) {
        fill(120);
        text(ult.J_test.toFixed(4), cx, cirY - DIAM / 2 - 3);
      }
    }

    // Etiqueta corta debajo (solo "T0", "T1", etc.)
    noStroke(); fill(70); textSize(10); textAlign(CENTER, TOP);
    text(m.topoId, cx, cirY + DIAM / 2 + 5);
  }

  // Etiqueta "J=" fija a la izquierda de la fila de valores, solo en regresión
  if (!esTipoClasif && modelos.some(m => m.historial && m.historial.length > 0)) {
    noStroke(); fill(100); textSize(12); textAlign(RIGHT, BOTTOM);
    text('J =', cirX0 - DIAM / 2 - 18, cirY - DIAM / 2 - 2);
  }
}

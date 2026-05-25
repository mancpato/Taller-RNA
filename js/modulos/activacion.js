/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: activacion.js
 * @description: Módulo para la visualización y control de la función de 
 *      activación en el panel 3. 
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * 
 * En este archivo se generan modelos que emplean diferentes funciones de
 * activación, de un conjunto predefinido. El usuario selecciona cuáles 
 * comparar.
 */

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: FUNCIÓN DE ACTIVACIÓN
// Variable : función de activación en capas ocultas (hasta 5 modelos)
// Fijo     : η=0.05, Xavier (semilla=1), sin dropout, red 2→4→1
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN ──────────────────────────────────────────────────────────

const ACTIVACIONES_DISPONIBLES = ['relu', 'sigmoid', 'tanh', 'lineal', 'leaky_relu', 'elu', 'escalon'];

const NOMBRES_ACT = {
  relu:       'ReLU',
  sigmoid:    'Sigmoid',
  tanh:       'Tanh',
  lineal:     'Lineal',
  leaky_relu: 'Leaky ReLU',
  elu:        'ELU',
  escalon:    'Escalón'
};

// Fuente única de orden canónico: controla tanto los checkboxes como los círculos.
// Orden: lectura de columnas de arriba a abajo →
//   Col1: Sigmoid, Tanh  |  Col2: ReLU, Leaky ReLU, ELU  |  Col3: Lineal, Escalón
// col: columna explícita en el grid (1=Sigmoid/Tanh, 2=ReLU/Leaky/ELU, 3=Lineal/Escalón)
const CB_IDS = [
  ['cb-act-sigmoid',    'sigmoid',    'Sigmoid',    1],
  ['cb-act-tanh',       'tanh',       'Tanh',       1],
  ['cb-act-relu',       'relu',       'ReLU',       2],
  ['cb-act-leaky_relu', 'leaky_relu', 'Leaky ReLU', 2],
  ['cb-act-elu',        'elu',        'ELU',        2],
  ['cb-act-lineal',     'lineal',     'Lineal',     3],
  ['cb-act-escalon',    'escalon',    'Escalón',    3],
];

let activacionesActivas  = ['lineal', 'relu', 'sigmoid', 'tanh'];
let _debounceActivacion  = null;

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function generarEnjambreActivacion() {
  modelos            = [];
  modeloSeleccionado = null;
  modeloHover        = null;
  modeloReferencia   = null;
  J_max_epoca0       = 1.0;
  modoLogPanel2      = false;
  modoAccPanel2      = false;

  for (const act of activacionesActivas) {
    const m    = crearModelo([2, 4, 1], act, 0.05, 0, 1, 'xavier');
    m.etiqueta = NOMBRES_ACT[act];
    m.color    = PALETAS.activacion[act];

    const grid = calcularGridPrediccion(m, 50);
    m.frontera = calcularFrontera(grid, 50);
    modelos.push(m);
  }

  if (modelos.length > 0) {
    modeloReferencia = 0;
    modeloMapa       = modelos[0];
    renderizarMapa(modelos[0]);
  }

  console.log('[Enjambre Activación] modelos:', modelos.map(m => m.etiqueta));
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayActivacion() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.id = 'controles-activacion';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="p3-row">
      <label>Épocas máx.:&nbsp;<select id="select-epocas-act">
        <option value="500">500</option>
        <option value="1000" selected>1000</option>
        <option value="2000">2000</option>
        <option value="5000">5000</option>
        <option value="10000">10000</option>
        <option value="20000">20000</option>
      </select></label>
      <label style="margin-left:10px">Velocidad:&nbsp;
        <select id="select-velocidad-act">
          <option value="lenta">Lenta</option>
          <option value="normal" selected>Normal</option>
          <option value="rapida">Rápida</option>
        </select>
      </label>
      <button id="btn-paso-act" style="margin-left:10px">+100</button>
    </div>
    <hr class="p3-sep">
    <div style="font-size:11px;color:#888;margin-bottom:6px">
      Selecciona las funciones a comparar:
    </div>
    <div id="grid-checkboxes-act" style="display:flex;gap:8px;margin:6px 0;font-size:12px;align-items:flex-start"></div>
  `;
  overlay.appendChild(div);

  // Épocas y velocidad
  document.getElementById('select-epocas-act').addEventListener('change', e => {
    maximoEpocas = parseInt(e.target.value);
  });
  document.getElementById('select-velocidad-act').addEventListener('change', e => {
    velocidad = e.target.value;
  });
  document.getElementById('btn-paso-act').addEventListener('click', avanzar100);

  // Generar checkboxes desde CB_IDS (fuente única de orden)
  // Tres divs de columna dentro de un flex container
  const grid = document.getElementById('grid-checkboxes-act');
  const colDivs = [1, 2, 3].map(n => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;align-self:start;margin-top:0;padding-top:0';
    grid.appendChild(d);
    console.log(`[activacion] colDiv${n} cssText:`, d.style.cssText);
    return d;
  });

  CB_IDS.forEach(([id, act, label, col]) => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'block';
    const isEscalon = id === 'cb-act-escalon';
    const checked = activacionesActivas.includes(act) ? 'checked' : '';
    wrapper.innerHTML = `<input type="checkbox" id="${id}" ${checked}>&nbsp;${label}`
      + (isEscalon ? '<div style="font-size:10px;color:#aaa;margin-left:18px">∇=0</div>' : '');
    colDivs[col - 1].appendChild(wrapper);
  });

  CB_IDS.forEach(([id]) => {
    document.getElementById(id).addEventListener('change', () => {
      const activas = CB_IDS
        .filter(([cbId]) => document.getElementById(cbId).checked)
        .map(([, act]) => act);

      if (activas.length === 0) {
        document.getElementById(id).checked = true;
        return;
      }

      activacionesActivas = activas;

      clearTimeout(_debounceActivacion);
      _debounceActivacion = setTimeout(() => resetear(), 300);
    });
  });
}

function actualizarUIEstadoActivacion() {
  const bloqueado     = enEstado('RUNNING', 'PAUSED');
  const bloqueadoPaso = enEstado('RUNNING', 'CONVERGED');

  ['select-epocas-act',
   'cb-act-relu', 'cb-act-sigmoid', 'cb-act-tanh',
   'cb-act-lineal', 'cb-act-leaky_relu',
   'cb-act-elu', 'cb-act-escalon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = bloqueado;
  });

  const btnPaso = document.getElementById('btn-paso-act');
  if (btnPaso) btnPaso.disabled = bloqueadoPaso;
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosActivacion(r3) {
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
        text('J=' + ult.J_test.toFixed(3), cx, cirY - DIAM / 2 - 3);
      }
    }

    // Etiqueta debajo
    noStroke(); fill(70); textSize(10); textAlign(CENTER, TOP);
    text(m.etiqueta, cx, cirY + DIAM / 2 + 5);
  }
}

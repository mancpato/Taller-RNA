/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: eta.js
 * @description: Módulo para la visualización y control de la tasa 
 *        de aprendizaje (η) en el panel 3. 
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * 
 * Este archivo define las funciones necesarias para generar múltiples modelos
 * con diferentes tasas de aprendizaje, controlar su entrenamiento y visualizar
 * su desempeño en el panel 3. El usuario decide la tasa mínima y máxima, así 
 * como la cantidad de modelos que se van a comparar. 
 * 
 * Cada modelo se representa con un disco cuyo color se usa también en los 
 * paneles 1 y 2. Cuando se alcanzan las iteraciones máximas o el criterio de 
 * convergencia. Cuando se alcanzan las iteraciones máximas o se cumple el
 * criterio de convergencia, el disco se rodea con un círculo verde 
 * o rojo dependiendo de su convergencia. 
 * 
 * El porcentaje sobre el disco es la medida de su desempeño, es decir, el 
 * porcentaje de aciertos sobre el conjunto de prueba.
 */

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: TASA DE APRENDIZAJE (η)
// Variable : η ∈ [etaMinVal, etaMaxVal], N modelos equidistantes
// Fijo     : Xavier (semilla=1), ReLU, sin dropout, red 2→4→1
// ══════════════════════════════════════════════════════════════════════════════

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function calcularEtasSecuencia(etaMin, etaMax) {
  const etas = [];
  let v = etaMin;
  while (v <= etaMax * (1 + 1e-9)) {
    etas.push(Math.min(v, etaMax));
    if (v >= etaMax) break;
    v *= 2;
  }
  if (etas[etas.length - 1] < etaMax - 1e-9) etas.push(etaMax);
  return etas;
}

function generarEnjambreEta(etaMin, etaMax) {
  modelos = [];
  modeloReferencia   = null;
  modeloSeleccionado = null;
  modeloHover        = null;
  J_max_epoca0  = 1.0;
  modoLogPanel2 = false;
  modoAccPanel2 = false;

  const etas = calcularEtasSecuencia(etaMin, etaMax);
  const N = etas.length;

  for (let i = 0; i < N; i++) {
    const eta_i = etas[i];
    const m = crearModelo([esTipoClasif ? 2 : 1, 4, 1], 'relu', eta_i, 0, 1, 'xavier');
    m.id       = i;
    m.etiqueta = `η=${eta_i.toFixed(3)}`;

    const t = N === 1 ? 0 : i / (N - 1);
    m.color = lerpColor(PALETAS.eta.azulVioleta, PALETAS.eta.naranja, t);

    m.frontera = calcularFronteraModelo(m);
    modelos.push(m);
  }

  modeloReferencia = 0;
  modeloMapa = modelos[0];
  renderizarMapa(modelos[0]);

  const contEl = document.getElementById('val-n-modelos-eta');
  if (contEl) contEl.textContent = N;
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayEta() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.id = 'controles-eta';
  div.innerHTML = `
    <div class="p3-row">
      <label>Épocas máx.:&nbsp;<select id="select-epocas-eta">
        <option value="500">500</option>
        <option value="1000" selected>1000</option>
        <option value="2000">2000</option>
        <option value="5000">5000</option>
        <option value="10000">10000</option>
        <option value="20000">20000</option>
      </select></label>
      <label style="margin-left:10px">Velocidad:&nbsp;<select id="select-velocidad">
        <option value="lenta">Lenta</option>
        <option value="normal" selected>Normal</option>
        <option value="rapida">Rápida</option>
      </select></label>
      <button id="btn-paso-eta" style="margin-left:10px">+100</button>
    </div>
    <hr class="p3-sep">
    <div class="p3-row">
      <label>η mín.:&nbsp;<input type="range" id="slider-eta-min" style="width:110px"></label>
      <span id="val-eta-min" style="margin-left:6px;min-width:38px">0.005</span>
    </div>
    <div class="p3-row" style="margin-top:2px">
      <label>η máx.:&nbsp;<input type="range" id="slider-eta-max" style="width:110px"></label>
      <span id="val-eta-max" style="margin-left:6px;min-width:38px">0.500</span>
    </div>
    <div class="p3-row" style="margin-top:4px;color:#555">
      N modelos:&nbsp;<span id="val-n-modelos-eta" style="font-weight:bold">8</span>
    </div>
  `;
  overlay.appendChild(div);

  const SL_MIN = Math.log10(0.001);
  const SL_MAX = Math.log10(0.5);
  const slMin  = document.getElementById('slider-eta-min');
  const slMax  = document.getElementById('slider-eta-max');
  slMin.min = SL_MIN; slMin.max = SL_MAX; slMin.step = 'any';
  slMax.min = SL_MIN; slMax.max = SL_MAX; slMax.step = 'any';
  slMin.value = Math.log10(etaMinVal);
  slMax.value = Math.log10(etaMaxVal);

  document.getElementById('select-epocas-eta').addEventListener('change', e => {
    maximoEpocas = parseInt(e.target.value);
  });
  document.getElementById('select-velocidad').addEventListener('change', e => {
    velocidad = e.target.value;
  });
  document.getElementById('slider-eta-min').addEventListener('input', e => {
    let vMin = Math.pow(10, parseFloat(e.target.value));
    if (vMin > 0.498) vMin = 0.500;
    etaMinVal = vMin;
    if (etaMinVal > etaMaxVal) {
      etaMaxVal = etaMinVal;
      document.getElementById('slider-eta-max').value = e.target.value;
      document.getElementById('val-eta-max').textContent = etaMaxVal.toFixed(3);
    }
    document.getElementById('val-eta-min').textContent = etaMinVal.toFixed(3);
    const n = calcularEtasSecuencia(etaMinVal, etaMaxVal).length;
    const contEl = document.getElementById('val-n-modelos-eta');
    if (contEl) contEl.textContent = n;
    clearTimeout(_debounceEta);
    _debounceEta = setTimeout(() => resetear(), 300);
  });
  document.getElementById('slider-eta-max').addEventListener('input', e => {
    let vMax = Math.pow(10, parseFloat(e.target.value));
    if (vMax > 0.498) vMax = 0.500;
    etaMaxVal = vMax;
    if (etaMaxVal < etaMinVal) {
      etaMinVal = etaMaxVal;
      document.getElementById('slider-eta-min').value = e.target.value;
      document.getElementById('val-eta-min').textContent = etaMinVal.toFixed(3);
    }
    document.getElementById('val-eta-max').textContent = etaMaxVal.toFixed(3);
    const n = calcularEtasSecuencia(etaMinVal, etaMaxVal).length;
    const contEl = document.getElementById('val-n-modelos-eta');
    if (contEl) contEl.textContent = n;
    clearTimeout(_debounceEta);
    _debounceEta = setTimeout(() => resetear(), 300);
  });
  document.getElementById('btn-paso-eta').addEventListener('click', avanzar100);
}

function actualizarUIEstadoEta() {
  const bloqueado     = enEstado('RUNNING', 'PAUSED');
  const bloqueadoPaso = enEstado('RUNNING', 'CONVERGED');
  ['slider-eta-min', 'slider-eta-max', 'select-epocas-eta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = bloqueado;
  });
  const btnPaso = document.getElementById('btn-paso-eta');
  if (btnPaso) btnPaso.disabled = bloqueadoPaso;
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosEta(r3) {
  const DIAM   = 10;
  const SEP    = 48;
  const totalW = modelos.length * SEP - (SEP - DIAM);
  const cirX0  = r3.x + (r3.w - totalW) / 2;
  const cirY   = r3.y + r3.h - 40;

  for (let i = 0; i < modelos.length; i++) {
    const m  = modelos[i];
    const cx = cirX0 + i * SEP;
    const c  = m.color;

    fill(red(c), green(c), blue(c)); noStroke();
    ellipse(cx, cirY, DIAM);

    noFill();
    if (m.estado === 'convergido') {
      stroke(46, 204, 113); strokeWeight(2); ellipse(cx, cirY, DIAM + 5);
    } else if (m.estado === 'divergente') {
      stroke(226, 75, 74); strokeWeight(2); ellipse(cx, cirY, DIAM + 5);
      const d = DIAM * 0.38; strokeWeight(1.5);
      line(cx - d, cirY - d, cx + d, cirY + d);
      line(cx + d, cirY - d, cx - d, cirY + d);
    } else if (m.estado === 'no_convergido') {
      stroke(150); strokeWeight(1.5); ellipse(cx, cirY, DIAM + 5);
    }

    if (modeloSeleccionado === i) {
      noFill(); stroke(30); strokeWeight(2); ellipse(cx, cirY, DIAM + 9);
    } else if (modeloHover === i) {
      noFill(); stroke(100); strokeWeight(1); ellipse(cx, cirY, DIAM + 7);
    }

    noStroke(); textSize(12); textAlign(CENTER, BOTTOM);
    if (m.historial && m.historial.length > 0) {
      const ultimo = m.historial[m.historial.length - 1];
      let metrica;
      if (esTipoClasif && ultimo.accuracy_test !== null && ultimo.accuracy_test !== undefined) {
        metrica = (ultimo.accuracy_test * 100).toFixed(0) + '%';
        const acc = ultimo.accuracy_test;
        fill(acc > 0.75 ? color(46, 180, 90) : acc > 0.50 ? color(200, 160, 0) : color(160));
      } else if (ultimo.J_test !== undefined) {
        metrica = ultimo.J_test.toFixed(4); fill(120);
      } else { metrica = ''; fill(120); }
      if (metrica) text(metrica, cx, cirY - DIAM / 2 - 8);
    }

    noStroke(); fill(80); textSize(12); textAlign(CENTER, TOP);
    if (i === 0) {
      noStroke(); fill(80); textSize(14); textAlign(RIGHT, TOP);
      text('η = ', cirX0 - 20, cirY + DIAM / 2 + 5);
      textAlign(CENTER, TOP);
    }
    text(m.eta.toFixed(3), cx, cirY + DIAM / 2 + 6);
  }

  // Etiqueta "J=" fija a la izquierda de la fila de valores, solo en regresión
  if (!esTipoClasif && modelos.some(m => m.historial && m.historial.length > 0)) {
    noStroke(); fill(100); textSize(12); textAlign(RIGHT, BOTTOM);
    text('J =', cirX0 - DIAM / 2 - 18, cirY - DIAM / 2 - 2);
  }
}

/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: momentum.js
 * @description: Permite evaluar el efecto del momentum. 
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * 
 * En este archivo compara modelos que tienen diversos valores de momentum,
 * el coeficiente que controla cuánto se toma en cuenta la dirección 
 * previa del descenso de gradiente.
 */
  
// ════════════════════════════════════════════════════════════════════════════
// MÓDULO: MOMENTUM
// Variable : β (coeficiente de momentum) ∈ {0.0, 0.2, 0.4, 0.6, 0.8, 0.9} 
// Fijo     : η=0.05, Xavier (semilla=1), ReLU, red 2→4→1
// ════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN ────────────────────────────────────────────────────────

const BETA_MAX_MOM = 0.9;
let betaMinMom = 0.0;

function calcularBetasSecuencia(betaMin) {
  const betas = [];
  let v = betaMin;
  while (v < BETA_MAX_MOM - 1e-9) {
    betas.push(parseFloat(v.toFixed(1)));
    v = parseFloat((v + 0.2).toFixed(1));
  }
  betas.push(BETA_MAX_MOM);
  return betas;
}

// ── 2. GENERACIÓN DEL ENJAMBRE ──────────────────────────────────────────────

function generarEnjambreMomentum()
{
  const betas = calcularBetasSecuencia(betaMinMom);
  modelos = betas.map((b) => {
    let m = crearModelo([2, 4, 1], 'relu', 0.05, 0, 1, 'xavier', b);
    m.etiqueta = `β=${b.toFixed(1)}`;
    const t = b / BETA_MAX_MOM;
    m.color = lerpColor(PALETAS.momentum.azulClaro, PALETAS.momentum.naranjaOscuro, t);
    return m;
  });
  modeloReferencia = 0;
  modeloSeleccionado = null;

  const contEl = document.getElementById('val-n-modelos-mom');
  if (contEl) contEl.textContent = betas.length;
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayMomentum() 
{
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) 
    return;
  const div = document.createElement('div');
  div.id = 'controles-momentum';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="p3-row">
      <label>Épocas máx.:&nbsp;<select id="select-epocas-mom">
        <option value="500">500</option>
        <option value="1000" selected>1000</option>
        <option value="2000">2000</option>
        <option value="5000">5000</option>
        <option value="10000">10000</option>
        <option value="20000">20000</option>
      </select></label>
      <label style="margin-left:10px">Velocidad:&nbsp;
        <select id="select-velocidad-mom">
          <option value="lenta">Lenta</option>
          <option value="normal" selected>Normal</option>
          <option value="rapida">Rápida</option>
        </select>
      </label>
      <button id="btn-paso-mom" style="margin-left:10px">+100</button>
    </div>
    <hr class="p3-sep">
    <div class="p3-row" style="margin-bottom:4px">
      β mín.:&nbsp;
      ${[0.0, 0.2, 0.4, 0.6, 0.8].map(v =>
        `<label style="margin-right:8px"><input type="radio" name="beta-min-mom" value="${v.toFixed(1)}"${v === 0.0 ? ' checked' : ''}>&nbsp;${v.toFixed(1)}</label>`
      ).join('')}
    </div>
    <div class="p3-row" style="color:#555;font-size:11px;margin-bottom:2px">
      β máx: 0.9 (fijo)&nbsp;&nbsp;·&nbsp;&nbsp;N modelos: <span id="val-n-modelos-mom" style="font-weight:bold">6</span>
    </div>
  `;
  overlay.appendChild(div);

  document.getElementById('select-epocas-mom').addEventListener('change', e => {
    maximoEpocas = parseInt(e.target.value);
  });
  document.getElementById('select-velocidad-mom').addEventListener('change', e => {
    velocidad = e.target.value;
  });
  document.querySelectorAll('input[name="beta-min-mom"]').forEach(r => {
    r.addEventListener('change', () => {
      if (enEstado('RUNNING', 'PAUSED')) {
        r.checked = false;
        document.querySelector(`input[name="beta-min-mom"][value="${betaMinMom.toFixed(1)}"]`).checked = true;
        notificar('Cambio ignorado durante entrenamiento');
        return;
      }
      betaMinMom = parseFloat(r.value);
      const n = calcularBetasSecuencia(betaMinMom).length;
      const contEl = document.getElementById('val-n-modelos-mom');
      if (contEl) contEl.textContent = n;
      resetear();
    });
  });
  document.getElementById('btn-paso-mom').addEventListener('click', avanzar100);
}

function actualizarUIEstadoMomentum() {
  const bloqueado     = enEstado('RUNNING', 'PAUSED');
  const bloqueadoPaso = enEstado('RUNNING', 'CONVERGED');

  ['select-epocas-mom', 'select-velocidad-mom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = bloqueado;
  });
  document.querySelectorAll('input[name="beta-min-mom"]').forEach(r => {
    r.disabled = bloqueado;
  });

  const btnPaso = document.getElementById('btn-paso-mom');
  if (btnPaso) 
    btnPaso.disabled = bloqueadoPaso;
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosMomentum(r3) 
{
  if (!modelos || modelos.length === 0) 
    return;

  const DIAM   = 18;
  const SEP    = 52;
  const totalW = modelos.length * SEP - (SEP - DIAM);
  const cirX0  = r3.x + (r3.w - totalW) / 2;
  const cirY   = r3.y + r3.h * 0.78;

  for (let i = 0; i < modelos.length; i++) {
    const m  = modelos[i];
    const cx = cirX0 + i * SEP;
    const c  = m.color || color(150);

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
      noStroke(); textSize(11); textAlign(CENTER, BOTTOM);
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
    noStroke(); fill(70); textSize(11); textAlign(CENTER, TOP);
    text(m.etiqueta || `β=${i}`, cx, cirY + DIAM / 2 + 5);
  }
}

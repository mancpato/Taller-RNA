/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: ini.js
 * @description: Módulo para experimentar con diversas formas de inicialización 
 *        de pesos en el panel 3.
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * 
 * Se generan modelos con diferentes métodos de inicialización de pesos,
 * incluyendo Uniforme, Normal, Xavier y He. El usuario puede seleccionar cuáles
 * comparar y cuántas semillas usar para cada una. 
 * 
 * Las semillas se generan a partir de la semilla global de datos, aunque esto 
 * no debiera ser necesario.
 */

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: INICIALIZACIÓN DE PESOS
// Variable : distribución × semilla (hasta 4 × 3 = 12 modelos)
// Fijo     : η=0.05, ReLU, sin dropout, red 2→4→1
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN ──────────────────────────────────────────────────────────


let SEMILLAS_INIT    = [];

// ── 2. GENERACIÓN DEL ENJAMBRE ────────────────────────────────────────────────

function generarEnjambreInit() {
  modelos = [];
  modeloSeleccionado  = null;
  modeloHover         = null;
  modeloReferencia    = null;
  J_max_epoca0  = 1.0;
  modoLogPanel2 = false;
  modoAccPanel2 = false;

  SEMILLAS_INIT = [
    semillaDatos,
    (semillaDatos * 6271 + 1) % 99991,
    (semillaDatos * 7919 + 1) % 99991
  ];
  console.log('[generarEnjambre] semillaDatos=', semillaDatos,
    'SEMILLAS_INIT calculado=', SEMILLAS_INIT);
  _actualizarDisplaySemillas();

  for (const dist of distActivas) {
    for (let s = 1; s <= semillasPorDist; s++) {
      const m   = crearModelo([2, 4, 1], 'relu', 0.05, 0, SEMILLAS_INIT[s - 1], dist);
      const hex  = COLORES_INIT[dist];
      const alfa = OPACIDADES_INIT[s - 1];
      m.color    = color(
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
        alfa
      );
      m.etiqueta = `${dist}·${'ABC'[s - 1]}`;
      const grid = calcularGridPrediccion(m, 50);
      m.frontera = calcularFrontera(grid, 50);
      modelos.push(m);
    }
  }

  if (modelos.length > 0) {
    modeloReferencia = 0;
    modeloMapa = modelos[0];
    renderizarMapa(modelos[0]);
  }
  console.log('[Enjambre Init] modelos:', modelos.length,
    modelos.map(m => m.etiqueta));
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayInit() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.id = 'controles-init';
  div.style.display = 'none';
  div.innerHTML = `
    <div class="p3-row">
      <label>Épocas máx.:&nbsp;<select id="select-epocas-init">
        <option value="500">500</option>
        <option value="1000" selected>1000</option>
        <option value="2000">2000</option>
        <option value="5000">5000</option>
        <option value="10000">10000</option>
        <option value="20000">20000</option>
      </select></label>
      <label style="margin-left:10px">Velocidad:&nbsp;<select id="select-velocidad-init">
        <option value="lenta">Lenta</option>
        <option value="normal" selected>Normal</option>
        <option value="rapida">Rápida</option>
      </select></label>
      <button id="btn-paso-init" style="margin-left:10px">+100</button>
    </div>
    <hr class="p3-sep">
    <div style="font-size:12px;margin-bottom:3px">Distribuciones:</div>
    <div class="p3-row" style="flex-wrap:wrap;gap:4px">
      <label><input type="checkbox" id="cb-uniforme" checked>&nbsp;Uniforme</label>
      <label><input type="checkbox" id="cb-normal"   checked>&nbsp;Normal</label>
      <label><input type="checkbox" id="cb-xavier"   checked>&nbsp;Xavier</label>
      <label><input type="checkbox" id="cb-he"       checked>&nbsp;He</label>
    </div>
    <hr class="p3-sep">
    <div class="p3-row" style="margin-top:2px">
      <span style="font-size:12px">Semillas:&nbsp;</span>
      <label><input type="radio" name="semillas" value="1" checked>&nbsp;1</label>&nbsp;&nbsp;
      <label><input type="radio" name="semillas" value="2">&nbsp;2</label>&nbsp;&nbsp;
      <label><input type="radio" name="semillas" value="3">&nbsp;3</label>
      <span id="span-semillas-vals" style="font-size:10px;color:#888;margin-left:10px"></span>
    </div>
  `;
  overlay.appendChild(div);

  document.getElementById('select-epocas-init').addEventListener('change', e => {
    maximoEpocas = parseInt(e.target.value);
  });
  document.getElementById('select-velocidad-init').addEventListener('change', e => {
    velocidad = e.target.value;
  });

  const _cbIds   = ['cb-uniforme', 'cb-normal', 'cb-xavier', 'cb-he'];
  const _cbDists = ['uniforme', 'normal', 'xavier', 'he'];
  _cbIds.forEach((id, idx) => {
    document.getElementById(id).addEventListener('change', () => {
      const activas = _cbDists.filter((_, i) => document.getElementById(_cbIds[i]).checked);
      if (activas.length === 0) {
        document.getElementById(id).checked = true;
        notificar('Al menos una distribución debe estar activa');
        return;
      }
      distActivas = activas;
      _actualizarTotalModelos();
      clearTimeout(_debounceInit);
      _debounceInit = setTimeout(() => resetear(), 300);
    });
  });
  document.querySelectorAll('input[name="semillas"]').forEach(r => {
    r.addEventListener('change', () => {
      semillasPorDist = parseInt(r.value);
      _actualizarDisplaySemillas();
      _actualizarTotalModelos();
      clearTimeout(_debounceInit);
      _debounceInit = setTimeout(() => resetear(), 300);
    });
  });
  document.getElementById('btn-paso-init').addEventListener('click', avanzar100);
  _actualizarDisplaySemillas();
}

function _actualizarTotalModelos() {
  const span = document.getElementById('span-total-modelos');
  if (span) span.textContent = distActivas.length * semillasPorDist;
}

function _actualizarDisplaySemillas() {
  const span = document.getElementById('span-semillas-vals');
  if (!span) {
    setTimeout(_actualizarDisplaySemillas, 50);
    return;
  }
  span.textContent = SEMILLAS_INIT.slice(0, semillasPorDist).join(' · ');
}

function actualizarUIEstadoInit() {
  const bloqueado     = enEstado('RUNNING', 'PAUSED');
  const bloqueadoPaso = enEstado('RUNNING', 'CONVERGED');
  ['select-epocas-init', 'cb-uniforme', 'cb-normal', 'cb-xavier', 'cb-he'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = bloqueado;
  });
  document.querySelectorAll('input[name="semillas"]').forEach(r => {
    r.disabled = bloqueado;
  });
  const btnPaso = document.getElementById('btn-paso-init');
  if (btnPaso) btnPaso.disabled = bloqueadoPaso;
}

function handleClickPanel3Init(mx, my, r3c) {
  // Click en nombre de distribución → selección grupal
  for (const zona of (_gruposHitAreas || [])) {
    if (mx >= zona.x && mx <= zona.x + zona.w &&
        my >= zona.y && my <= zona.y + zona.h) {
      distribucionSeleccionada =
        distribucionSeleccionada === zona.dist ? null : zona.dist;
      modeloSeleccionado = null;
      return;
    }
  }

  const DISTS      = ['uniforme', 'normal', 'xavier', 'he'];
  const gruposAct  = DISTS.filter(d => modelos.some(m => m.etiqueta.startsWith(d)));
  const S          = semillasPorDist;
  const anchoGrupo = 34 * (S - 1) + 14;
  const anchoTotal = gruposAct.length * anchoGrupo + (gruposAct.length - 1) * 48;
  let gx           = r3c.x + (r3c.w - anchoTotal) / 2;
  const cirY       = r3c.y + r3c.h - 36;

  let clickado = false;
  for (const dist of gruposAct) {
    if (clickado) break;
    const mdist = modelos.filter(m => m.etiqueta.startsWith(dist));
    for (let s = 0; s < mdist.length; s++) {
      const cx = gx + s * 34;
      if (Math.hypot(mx - cx, my - cirY) <= 14) {
        distribucionSeleccionada = null;
        const idx = modelos.indexOf(mdist[s]);
        modeloSeleccionado = (modeloSeleccionado === idx) ? null : idx;
        if (modeloSeleccionado !== null) {
          modeloMapa = modelos[idx];
          renderizarMapa(modeloMapa);
        }
        clickado = true;
        break;
      }
    }
    gx += anchoGrupo + 48;
  }
}

// ── 4. VISUALIZACIÓN PANEL 3 (p5.js) ─────────────────────────────────────────

function dibujarCirculosInit(r3) {
  const DISTS   = ['uniforme', 'normal', 'xavier', 'he'];
  const NOMBRES = { uniforme: 'Uniforme', normal: 'Normal', xavier: 'Xavier', he: 'He' };
  const DIAM    = 14;
  const RING    = DIAM + 5;
  const SEP_C   = 34;
  const SEP_G   = 48;
  const cirY    = r3.y + r3.h - 36;

  const gruposActivos = DISTS.filter(d => modelos.some(m => m.etiqueta.startsWith(d)));
  const S             = semillasPorDist;
  const anchoGrupo    = SEP_C * (S - 1) + DIAM;
  const anchoTotal    = gruposActivos.length * anchoGrupo + (gruposActivos.length - 1) * SEP_G;
  let gx              = r3.x + (r3.w - anchoTotal) / 2;

  for (const dist of gruposActivos) {
    const modelosDist = modelos.filter(m => m.etiqueta.startsWith(dist));

    if (dist === gruposActivos[0]) _gruposHitAreas = [];

    textSize(12); textStyle(BOLD);
    const wNombre = textWidth(NOMBRES[dist]);
    const xNombre = gx + anchoGrupo / 2 - wNombre / 2;
    const yNombre = cirY - DIAM / 2 - 26;
    _gruposHitAreas.push({ dist, x: xNombre - 4, y: yNombre - 2, w: wNombre + 8, h: 16 });

    noStroke();
    if (distribucionSeleccionada === dist) {
      fill(220, 220, 255);
      rect(xNombre - 4, yNombre - 2, wNombre + 8, 16, 3);
      fill(40);
    } else { fill(80); }
    textStyle(BOLD); textAlign(CENTER, BOTTOM);
    text(NOMBRES[dist], gx + anchoGrupo / 2, cirY - DIAM / 2 - 14);
    textStyle(NORMAL);

    for (let s = 0; s < modelosDist.length; s++) {
      const m   = modelosDist[s];
      const idx = modelos.indexOf(m);
      const cx  = gx + s * SEP_C;
      const c   = m.color;

      fill(red(c), green(c), blue(c), alpha(c)); noStroke();
      ellipse(cx, cirY, DIAM);

      noFill();
      if (m.estado === 'convergido') {
        stroke(46, 204, 113); strokeWeight(2); ellipse(cx, cirY, RING);
      } else if (m.estado === 'divergente') {
        stroke(226, 75, 74); strokeWeight(2); ellipse(cx, cirY, RING);
        const d = DIAM * 0.38; strokeWeight(1.5);
        line(cx - d, cirY - d, cx + d, cirY + d);
        line(cx + d, cirY - d, cx - d, cirY + d);
      } else if (m.estado === 'no_convergido') {
        stroke(150); strokeWeight(1.5); ellipse(cx, cirY, RING);
      }

      if (modeloSeleccionado === idx) {
        noFill(); stroke(30); strokeWeight(2); ellipse(cx, cirY, RING + 6);
      } else if (modeloHover === idx) {
        noFill(); stroke(100); strokeWeight(1); ellipse(cx, cirY, RING + 4);
      }

      if (m.historial && m.historial.length > 0) {
        const ult = m.historial[m.historial.length - 1];
        if (ult.accuracy_test !== undefined && ult.accuracy_test !== null) {
          const acc = ult.accuracy_test;
          fill(acc > 0.75 ? color(46, 180, 90) : acc > 0.50 ? color(200, 160, 0) : color(160));
          noStroke(); textSize(10); textAlign(CENTER, BOTTOM);
          text((acc * 100).toFixed(0) + '%', cx, cirY - DIAM / 2 - 2);
        }
      }

      noStroke(); fill(120); textSize(10); textAlign(CENTER, TOP);
      text('s' + (s + 1), cx, cirY + DIAM / 2 + 5);
    }
    gx += anchoGrupo + SEP_G;
  }
}

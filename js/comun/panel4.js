// ============================================================================
// panel4.js — Estadísticas del enjambre y visualización de red neuronal
// ============================================================================

// Posiciones normalizadas [0,1] para cada arquitectura soportada.
// x: posición horizontal de la capa; y[]: posiciones verticales de los nodos.
// Para arquitecturas no listadas, se usa una función de fallback.
const LAYOUT_RED = (() => {
  function _layout(capas) {
    const nCapas = capas.length;
    return capas.map((n, c) => ({
      x: nCapas === 1 ? 0.5 : c / (nCapas - 1),
      y: Array.from({ length: n }, (_, i) => (i + 1) / (n + 1))
    }));
  }
  const arqs = [
    [2, 1], [2, 2, 1], [2, 3, 1], [2, 4, 1], [2, 6, 1],
    [2, 2, 3, 1], [2, 3, 2, 1], [2, 4, 4, 1], [2, 6, 4, 1]
  ];
  const out = {};
  for (const c of arqs) out[c.join(',')] = _layout(c);
  return out;
})();

let _wMaxCache     = 0.001;
let _wMaxModeloRef = null;

function dibujarResumenPanel4() {
  if (!modelos || modelos.length === 0) return;
  const r = panelRect(4);
  const x = r.x + 14;
  let y = r.y + 36;
  const lineH = 18;

  const conv   = modelos.filter(m => m.estado === 'convergido').length;
  const div    = modelos.filter(m => m.estado === 'divergente').length;
  const noconv = modelos.filter(m => m.estado === 'no_convergido').length;
  const activ  = modelos.filter(m => m.estado === 'activo').length;
  const total  = modelos.length;

  textSize(11); textAlign(LEFT, TOP); noStroke();

  fill(60);
  text(`Enjambre: ${total} modelos`, x, y); y += lineH * 1.4;

  fill(46, 180, 90);
  text(`✓ Aprendizaje exitoso: ${conv}`, x, y); y += lineH;
  fill(200, 60, 60);
  text(`✗ Divergentes:    ${div}`, x, y); y += lineH;
  fill(140);
  text(`— No convergidos: ${noconv}`, x, y); y += lineH;

  if (activ > 0) {
    fill(80, 120, 200);
    text(`… Entrenando:     ${activ}`, x, y); y += lineH;
  }

  if (!enEstado('IDLE') && conv + div + noconv > 0) {
    y += lineH * 0.5;
    let mejorJ = Infinity, mejorEtiq = null;
    for (const m of modelos) {
      if (m.historial && m.historial.length > 0) {
        const jt = m.historial[m.historial.length - 1].J_test;
        if (jt !== undefined && jt < mejorJ) { mejorJ = jt; mejorEtiq = m.etiqueta; }
      }
    }
    if (isFinite(mejorJ)) {
      fill(60);
      text(`Mejor J_test: ${mejorJ.toFixed(4)}`, x, y); y += lineH;
      fill(100);
      text(`  → ${mejorEtiq}`, x, y);
    }
  }
}

function dibujarRedPanel4() {
  const r = panelRect(4);

  const RW  = r.w * 0.40;
  const RH  = r.h * 0.62;
  const rx0 = r.x + r.w - RW - 44;
  const ry0 = r.y + r.h - RH - 22;

  const m = modeloSeleccionado !== null ? modelos[modeloSeleccionado] : null;

  // Determinar arquitectura a dibujar
  const capas   = m ? m.capas : (esTipoClasif ? [2, 4, 1] : [1, 4, 1]);
  const key     = capas.join(',');
  const layout  = LAYOUT_RED[key] ?? (() => {
    // fallback dinámico para arquitecturas no en la tabla
    const nC = capas.length;
    return capas.map((n, c) => ({
      x: nC === 1 ? 0.5 : c / (nC - 1),
      y: Array.from({ length: n }, (_, i) => (i + 1) / (n + 1))
    }));
  })();

  const nCapas = capas.length;
  const RADIO  = 10;

  // Recalcular wMax solo cuando cambia el modelo seleccionado
  if (m !== _wMaxModeloRef) {
    _wMaxModeloRef = m;
    _wMaxCache = 0.001;
    if (m && m.pesos) {
      for (const capa of m.pesos)
        for (const w of capa)
          if (Math.abs(w) > _wMaxCache) _wMaxCache = Math.abs(w);
    }
  }
  const wMax = _wMaxCache;

  // Convertir posiciones normalizadas a píxeles
  const xs = layout.map(capa => rx0 + capa.x * RW);
  const ys = layout.map(capa => capa.y.map(yn => ry0 + yn * RH));

  const COLOR_NODO = [
    [200, 100, 100],  // entrada
    [80,  130, 200],  // oculta(s)
    [80,  180, 120]   // salida
  ];

  // Posiciones de nodos bias (entre capas adyacentes)
  const TB    = 8;
  const xBias = [];
  const yBias = [];
  for (let c = 0; c < nCapas - 1; c++) {
    xBias.push(xs[c] + (xs[c + 1] - xs[c]) * 0.28);
    const allY = [...ys[c], ...ys[c + 1]];
    yBias.push(Math.max(...allY) + RADIO * 2.2 - TB * 2);
  }

  // Conexiones bias
  for (let c = 0; c < nCapas - 1; c++) {
    const nOut = capas[c + 1];
    for (let j = 0; j < nOut; j++) {
      let cr, cg, cb, alfa, grosor;
      if (m && m.sesgos && m.sesgos[c]) {
        const w = m.sesgos[c][j];
        const t = Math.min(Math.abs(w) / wMax, 1);
        grosor = 0.5 + t * 3.0; alfa = 50 + t * 200;
        if (w >= 0) { cr = 60;  cg = 100; cb = 210; }
        else        { cr = 210; cg = 60;  cb = 60;  }
      } else { cr = 160; cg = 160; cb = 160; grosor = 0.7; alfa = 70; }
      stroke(cr, cg, cb, alfa); strokeWeight(grosor);
      line(xBias[c], yBias[c], xs[c + 1], ys[c + 1][j]);
    }
  }

  // Conexiones regulares
  for (let c = 0; c < nCapas - 1; c++) {
    const nIn = capas[c], nOut = capas[c + 1];
    for (let j = 0; j < nOut; j++) {
      for (let i = 0; i < nIn; i++) {
        let cr, cg, cb, alfa, grosor;
        if (m && m.pesos && m.pesos[c]) {
          const w = m.pesos[c][j * nIn + i];
          const t = Math.min(Math.abs(w) / wMax, 1);
          grosor = 0.5 + t * 3.0; alfa = 50 + t * 200;
          if (w >= 0) { cr = 60;  cg = 100; cb = 210; }
          else        { cr = 210; cg = 60;  cb = 60;  }
        } else { cr = 160; cg = 160; cb = 160; grosor = 0.7; alfa = 70; }
        stroke(cr, cg, cb, alfa); strokeWeight(grosor);
        line(xs[c], ys[c][i], xs[c + 1], ys[c + 1][j]);
      }
    }
  }

  // Nodos
  for (let c = 0; c < nCapas; c++) {
    // Capas ocultas usan índice 1 de COLOR_NODO; entrada=0, salida=última
    const colorIdx = c === 0 ? 0 : c === nCapas - 1 ? 2 : 1;
    const [nr, ng, nb] = COLOR_NODO[colorIdx];
    for (let i = 0; i < capas[c]; i++) {
      fill(nr, ng, nb, 200); stroke(nr * 0.6, ng * 0.6, nb * 0.6); strokeWeight(1.5);
      ellipse(xs[c], ys[c][i], RADIO * 2);
    }
  }

  // Nodos bias (triángulos)
  fill(255, 220, 50); stroke(180, 150, 0); strokeWeight(1.5);
  for (let c = 0; c < nCapas - 1; c++) {
    const bx = xBias[c], by = yBias[c];
    triangle(bx, by - TB, bx - TB, by + TB, bx + TB, by + TB);
  }

  // Etiquetas de capa
  noStroke(); fill(60); textSize(11); textAlign(CENTER, BOTTOM);
  for (let c = 0; c < nCapas; c++) {
    const etiq = c === 0 ? 'Entrada' : c === nCapas - 1 ? 'Salida' : `Oc.${c}`;
    text(etiq, xs[c], ry0 - 3);
  }

  // Etiquetas x₁, x₂
  const subIdx = ['₁', '₂'];
  textAlign(RIGHT, CENTER); textSize(11); fill(60);
  for (let i = 0; i < capas[0]; i++)
    text('x' + (subIdx[i] ?? (i + 1)), xs[0] - RADIO - 3, ys[0][i]);

  // Etiqueta y
  noStroke(); fill(60); textSize(12); textStyle(BOLD); textAlign(LEFT, CENTER);
  text('y', xs[nCapas - 1] + RADIO + 6, ys[nCapas - 1][0]);
  textStyle(NORMAL);

  if (m) {
    noStroke(); textSize(12); textAlign(LEFT, BOTTOM);
    fill(60, 100, 210);  text('+ positivo', rx0, r.y + r.h - 7);
    fill(210, 60, 60);   text('− negativo', rx0 + 62, r.y + r.h - 7);
    fill(130);           text('grosor = |w|', rx0 + 124, r.y + r.h - 7);
  }
}

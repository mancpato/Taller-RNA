// ============================================================================
// panel2.js — Historial de pérdida (curvas J_train / J_test)
// ============================================================================

function _xMaxPanel2() {
  const epocaMax = (modelos && modelos.length > 0)
    ? Math.max(...modelos.map(m => m.historial?.length ?? 0))
    : 10;
  return Math.max(epocaMax * 1.08, 10);
}

function _panel2PlotArea() {
  const r = panelRect(2);
  const PAD_L = 42, PAD_R = 12, PAD_T = 38, PAD_B = 36;
  return {
    x: r.x + PAD_L,
    y: r.y + PAD_T,
    w: r.w - PAD_L - PAD_R,
    h: r.h - PAD_T - PAD_B
  };
}

function _epToX(ep, xMax, plot) {
  return plot.x + (ep / Math.max(xMax, 1)) * plot.w;
}

function _calcularRangoY() {
  let yMin = Infinity, yMax = -Infinity;
  for (const m of modelos) {
    if (!m.historial || m.historial.length === 0) continue;
    for (const h of m.historial) {
      if (h.J_train !== undefined && isFinite(h.J_train)) {
        if (h.J_train < yMin) yMin = h.J_train;
        if (h.J_train > yMax) yMax = h.J_train;
      }
      if (mostrarCurvasTest && h.J_test !== undefined && isFinite(h.J_test)) {
        if (h.J_test < yMin) yMin = h.J_test;
        if (h.J_test > yMax) yMax = h.J_test;
      }
    }
  }
  if (!isFinite(yMin) || !isFinite(yMax))
    return { yMin: 0, yMax: J_max_epoca0 * 1.05 };
  const margen = (yMax - yMin) * 0.05 || 0.01;
  return { yMin: Math.max(0, yMin - margen), yMax: yMax + margen };
}

function _valToY(val, plot, yMin, yMax) {
  if (modoAccPanel2) {
    const v = constrain(val, 0, 1);
    return plot.y + plot.h - v * plot.h;
  }
  if (modoLogPanel2) {
    const vLog   = Math.log10(Math.max(val,  1e-8));
    const minLog = Math.log10(Math.max(yMin, 1e-8));
    const maxLog = Math.log10(Math.max(yMax, 1e-8));
    const rango  = maxLog - minLog || 1;
    return plot.y + plot.h - ((vLog - minLog) / rango) * plot.h;
  }
  const rango = yMax - yMin || 1;
  return plot.y + plot.h - ((val - yMin) / rango) * plot.h;
}

function dibujarHistorialPanel2() {
  if (moduloActivo === 'experimento') { dibujarCurvasExperimentoPanel2(); return; }
  const r    = panelRect(2);
  const plot = _panel2PlotArea();

  noStroke(); fill(250);
  rect(plot.x, plot.y, plot.w, plot.h);

  if (!modelos || modelos.length === 0) {
    fill(160); noStroke(); textSize(11); textAlign(CENTER, CENTER);
    text('Sin datos', plot.x + plot.w / 2, plot.y + plot.h / 2);
    _dibujarTogglesPanel2(r, plot);
    return;
  }

  const xMax = _xMaxPanel2();
  const { yMin, yMax } = _calcularRangoY();

  // Grilla
  stroke(220); strokeWeight(0.5);
  for (let i = 0; i <= 5; i++) {
    const y = plot.y + (i / 5) * plot.h;
    line(plot.x, y, plot.x + plot.w, y);
  }
  stroke(180); strokeWeight(1);
  line(plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h);
  line(plot.x, plot.y, plot.x, plot.y + plot.h);

  // Etiquetas eje Y
  noStroke(); fill(120); textSize(11); textAlign(RIGHT, CENTER);
  for (let i = 0; i <= 5; i++) {
    const val = modoLogPanel2
      ? Math.pow(10, Math.log10(Math.max(yMin, 1e-8)) +
          i * (Math.log10(Math.max(yMax, 1e-8)) - Math.log10(Math.max(yMin, 1e-8))) / 5)
      : yMin + (yMax - yMin) * i / 5;
    const ty   = _valToY(val, plot, yMin, yMax);
    // El piso 1e-8 usado en log(0) no debe aparecer como etiqueta visible
    const esPisoLog = modoLogPanel2 && i === 0 && yMin < 1e-7;
    const etiq = modoAccPanel2 ? (val * 100).toFixed(0) + '%'
               : (val === 0 || esPisoLog) ? '0'
               : val < 0.01 ? val.toExponential(1) : val.toFixed(3);
    text(etiq, plot.x - 3, ty);
  }

  // Etiquetas eje X — intervalo adaptativo
  function tickNice(xMax) {
    const objetivo = 6;
    const crudo = xMax / objetivo;
    const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
    const r = crudo / mag;
    let paso;
    if      (r < 1.5) paso = 1;
    else if (r < 3.5) paso = 2;
    else if (r < 7.5) paso = 5;
    else              paso = 10;
    return paso * mag;
  }
  const intervalo = tickNice(xMax);
  noStroke(); fill(120); textSize(11); textAlign(CENTER, TOP);
  for (let ep = 0; ep <= xMax; ep += intervalo)
    text(Math.round(ep), _epToX(ep, xMax, plot), plot.y + plot.h + 3);

  // Línea J* de referencia
  if (modeloReferencia !== null) {
    const mRef = modelos[modeloReferencia];
    if (mRef && mRef.historial && mRef.historial.length > 0) {
      const campoRef  = modoAccPanel2 ? 'accuracy_test' : 'J_train';
      const ultimoRef = mRef.historial[mRef.historial.length - 1][campoRef];
      if (ultimoRef !== undefined) {
        const yRef = _valToY(ultimoRef, plot, yMin, yMax);
        stroke(200, 200, 200); strokeWeight(1);
        drawingContext.setLineDash([4, 4]);
        line(plot.x, yRef, plot.x + plot.w, yRef);
        drawingContext.setLineDash([]);
        noStroke(); fill(140); textSize(10); textAlign(LEFT, BOTTOM);
        text('J*', plot.x + 2, yRef - 1);
      }
    }
  }

  // Curvas J_train
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(plot.x, plot.y, plot.w, plot.h);
  drawingContext.clip();

  const campo = modoAccPanel2 ? 'accuracy_test' : 'J_train';
  for (let i = 0; i < modelos.length; i++) {
    const m = modelos[i];
    if (!m.historial || m.historial.length < 2) continue;
    const c = m.color;
    let alfa;
    if (_modeloDestacado(i))      { alfa = 255; strokeWeight(2.5); }
    else if (modeloHover === i)   { alfa = 200; strokeWeight(2.0); }
    else if (_modeloAtenuado(i))  { alfa = 30;  strokeWeight(1.0); }
    else                          { alfa = 60;  strokeWeight(1.5); }
    stroke(red(c), green(c), blue(c), alfa); noFill();
    beginShape();
    for (let ep = 0; ep < m.historial.length; ep++) {
      const val = m.historial[ep][campo];
      if (val === undefined || val === null) continue;
      vertex(_epToX(ep, xMax, plot), _valToY(val, plot, yMin, yMax));
    }
    endShape();
  }

  // Curvas J_test
  if (mostrarCurvasTest) {
    const campoTest = modoAccPanel2 ? 'accuracy_test' : 'J_test';
    for (let i = 0; i < modelos.length; i++) {
      const m = modelos[i];
      if (!m.historial || m.historial.length < 2) continue;
      const c    = m.color;
      const alfa = modeloSeleccionado === i ? 200 : modeloHover === i ? 140 : 40;
      stroke(red(c), green(c), blue(c), alfa); strokeWeight(1); noFill();
      drawingContext.setLineDash([3, 3]);
      beginShape();
      for (let ep = 0; ep < m.historial.length; ep++) {
        const val = m.historial[ep][campoTest];
        if (val === undefined || val === null) continue;
        vertex(_epToX(ep, xMax, plot), _valToY(val, plot, yMin, yMax));
      }
      endShape();
      drawingContext.setLineDash([]);
    }
  }

  drawingContext.restore();
  _dibujarTogglesPanel2(r, plot);
}

function _dibujarTogglesPanel2(r, plot) {
  const BTN_W = 44, BTN_H = 18, GAP = 6;
  const bY      = r.y + 5;
  const bX_J    = r.x + r.w - 10 - BTN_W;
  const bX_Test = bX_J - GAP - BTN_W;
  const bX_Lin  = bX_Test - GAP - BTN_W;

  fill(modoLogPanel2 ? 180 : 230); stroke(150); strokeWeight(1);
  rect(bX_Lin, bY, BTN_W, BTN_H, 2);
  noStroke(); fill(40); textSize(10); textAlign(CENTER, CENTER);
  text(modoLogPanel2 ? 'Log' : 'Lin', bX_Lin + BTN_W / 2, bY + BTN_H / 2);

  fill(mostrarCurvasTest ? 180 : 230); stroke(150); strokeWeight(1);
  rect(bX_Test, bY, BTN_W, BTN_H, 2);
  noStroke(); fill(40); textSize(10); textAlign(CENTER, CENTER);
  text('Test', bX_Test + BTN_W / 2, bY + BTN_H / 2);

  if (esTipoClasif) {
    fill(modoAccPanel2 ? 180 : 230); stroke(150); strokeWeight(1);
    rect(bX_J, bY, BTN_W, BTN_H, 2);
    noStroke(); fill(40); textSize(10); textAlign(CENTER, CENTER);
    text(modoAccPanel2 ? 'Acc' : 'J', bX_J + BTN_W / 2, bY + BTN_H / 2);
  }
}

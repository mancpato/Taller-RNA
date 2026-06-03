// ============================================================================
// panel1.js — Espacio de salida: mapa de predicción, fronteras, datos
// ============================================================================

function _panel1PlotArea() {
  const r     = panelRect(1);
  const titleH = 24;
  const innerX = r.x;
  const innerY = r.y + titleH;
  const innerW = r.w;
  const innerH = r.h - titleH;
  const mx = innerW * 0.05;
  const my = innerH * 0.05;
  return { x: innerX + mx, y: innerY + my, w: innerW - 2 * mx, h: innerH - 2 * my };
}

function dataToPanel1(x1, x2) {
  const p = _panel1PlotArea();
  return {
    px: p.x + (x1 + 1) / 2 * p.w,
    py: p.y + (1 - (x2 + 1) / 2) * p.h
  };
}

function panel1ToData(px, py) {
  const p = _panel1PlotArea();
  return {
    x1: (px - p.x) / p.w * 2 - 1,
    x2: (1 - (py - p.y) / p.h) * 2 - 1
  };
}

// ── Utilidades de regresión ───────────────────────────────────────────────────

function _rangoRegresion() {
  const todos = [...datosTrain, ...datosTest];
  if (todos.length === 0) return { yMin: -1.2, yMax: 1.2 };
  let yMin = Infinity, yMax = -Infinity;
  for (const d of todos) {
    if (d.y < yMin) yMin = d.y;
    if (d.y > yMax) yMax = d.y;
  }
  const margen = (yMax - yMin) * 0.12 || 0.1;
  return { yMin: yMin - margen, yMax: yMax + margen };
}

function calcularCurvaRegresion(modelo, n) {
  const batch = [];
  for (let i = 0; i < n; i++) batch.push([-1 + (i / (n - 1)) * 2]);
  const fwd = forward(modelo, batch, false);
  const salida = fwd.activaciones[fwd.activaciones.length - 1];
  return batch.map((b, i) => ({ x1: b[0], yhat: salida[i][0] }));
}

function renderizarMapaRegresion(modelo) {
  const p = _panel1PlotArea();
  const gfx = createGraphics(Math.floor(p.w), Math.floor(p.h));
  gfx.clear();
  gfx.noStroke();

  const n = 50;
  const batch = [];
  for (let j = 0; j < n; j++) batch.push([-1 + (j / (n - 1)) * 2]);
  const fwd = forward(modelo, batch, false);
  const ychats = fwd.activaciones[fwd.activaciones.length - 1].map(a => a[0]);

  const yhatMin = Math.min(...ychats);
  const yhatMax = Math.max(...ychats);
  const yhatRange = yhatMax - yhatMin || 1;

  const cellW = p.w / n;
  for (let j = 0; j < n; j++) {
    const t = (ychats[j] - yhatMin) / yhatRange;
    gfx.fill(
      Math.round(75  + t * 157),
      Math.round(139 - t * 9),
      Math.round(190 - t * 100),
      55
    );
    gfx.rect(j * cellW, 0, cellW + 1, Math.floor(p.h));
  }
  return gfx;
}

// Función unificada para calcular frontera (clasif.) o curva (regresión)
function calcularFronteraModelo(m) {
  if (esTipoClasif) {
    const grid = calcularGridPrediccion(m, 50);
    return calcularFrontera(grid, 50);
  }
  return calcularCurvaRegresion(m, 100);
}

// ── Mapa de predicción ────────────────────────────────────────────────────────

function calcularGridPrediccion(modelo, resolucion) {
  const n     = resolucion;
  const grid  = new Float32Array(n * n);
  const batch = [];
  for (let i = 0; i < n; i++) {
    const x2 = 1 - (i / (n - 1)) * 2;
    for (let j = 0; j < n; j++) {
      const x1 = -1 + (j / (n - 1)) * 2;
      batch.push([x1, x2]);
    }
  }
  const fwd = forward(modelo, batch, false);
  const salida = fwd.activaciones[fwd.activaciones.length - 1];
  for (let k = 0; k < n * n; k++) grid[k] = salida[k][0];
  return grid;
}

function renderizarMapaPrediccion(grid, resolucion) {
  const p   = _panel1PlotArea();
  const gfx = createGraphics(Math.floor(p.w), Math.floor(p.h));
  gfx.clear();
  gfx.noStroke();

  const n     = resolucion;
  const cellW = p.w / n;
  const cellH = p.h / n;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const yhat     = grid[i * n + j];
      const confianza = Math.abs(yhat - 0.5) * 2;
      const alfa      = confianza * 180;
      if (yhat < 0.5) gfx.fill(75, 139, 190, alfa);
      else            gfx.fill(232, 130, 90, alfa);
      gfx.rect(j * cellW, i * cellH, cellW + 1, cellH + 1);
    }
  }
  return gfx;
}

function renderizarMapa(modelo) {
  if (esTipoClasif) {
    const grid = calcularGridPrediccion(modelo, 50);
    gfxMapa        = renderizarMapaPrediccion(grid, 50);
    fronteraPrueba = calcularFrontera(grid, 50);
  } else {
    gfxMapa        = renderizarMapaRegresion(modelo);
    fronteraPrueba = [];
  }
}

function dibujarMapaPanel1() {
  if (!gfxMapa) return;
  const p = _panel1PlotArea();
  image(gfxMapa, p.x, p.y, p.w, p.h);
}

// ── Fronteras de decisión ─────────────────────────────────────────────────────

function calcularFrontera(gridPrediccion, resolucion) {
  const n      = resolucion;
  const puntos = [];
  const idx    = (i, j) => i * n + j;
  const toData = (i, j) => ({
    x1: -1 + (j / (n - 1)) * 2,
    x2:  1 - (i / (n - 1)) * 2
  });

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = gridPrediccion[idx(i, j)];
      if (j + 1 < n) {
        const vr = gridPrediccion[idx(i, j + 1)];
        if ((v - 0.5) * (vr - 0.5) < 0) {
          const t = (0.5 - v) / (vr - v);
          const a = toData(i, j); const b = toData(i, j + 1);
          puntos.push({ x1: a.x1 + t * (b.x1 - a.x1), x2: a.x2 + t * (b.x2 - a.x2) });
        }
      }
      if (i + 1 < n) {
        const vd = gridPrediccion[idx(i + 1, j)];
        if ((v - 0.5) * (vd - 0.5) < 0) {
          const t = (0.5 - v) / (vd - v);
          const a = toData(i, j); const b = toData(i + 1, j);
          puntos.push({ x1: a.x1 + t * (b.x1 - a.x1), x2: a.x2 + t * (b.x2 - a.x2) });
        }
      }
    }
  }
  return puntos;
}

function _ordenarFrontera(puntos) {
  if (puntos.length === 0) return puntos;
  let cx = 0, cy = 0;
  for (const p of puntos) { cx += p.x1; cy += p.x2; }
  cx /= puntos.length; cy /= puntos.length;
  return [...puntos].sort((a, b) => {
    const angA = Math.atan2(a.x2 - cy, a.x1 - cx);
    const angB = Math.atan2(b.x2 - cy, b.x1 - cx);
    return angA - angB;
  });
}

function _modeloDestacado(i) {
  if (modeloSeleccionado !== null) return i === modeloSeleccionado;
  if (distribucionSeleccionada !== null)
    return modelos[i].etiqueta.startsWith(distribucionSeleccionada);
  return false;
}

function _modeloAtenuado(i) {
  if (modeloSeleccionado !== null) return i !== modeloSeleccionado;
  if (distribucionSeleccionada !== null)
    return !modelos[i].etiqueta.startsWith(distribucionSeleccionada);
  return false;
}

function _dibujarCurvasRegresion() {
  const p = _panel1PlotArea();
  const { yMin, yMax } = _rangoRegresion();
  const rango = yMax - yMin || 1;

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(p.x, p.y, p.w, p.h);
  drawingContext.clip();

  for (let i = 0; i < modelos.length; i++) {
    const m = modelos[i];
    if (!m.frontera || m.frontera.length === 0) continue;

    let grosor, alfa;
    if (_modeloDestacado(i))     { grosor = 3;   alfa = 255; }
    else if (modeloHover === i)  { grosor = 2.5; alfa = 230; }
    else if (_modeloAtenuado(i)) { grosor = 1;   alfa = 40;  }
    else                         { grosor = 2;   alfa = 180; }

    const c = m.color;
    stroke(red(c), green(c), blue(c), alfa);
    strokeWeight(grosor);
    noFill();
    beginShape();
    for (const pt of m.frontera) {
      const px = p.x + (pt.x1 + 1) / 2 * p.w;
      const py = p.y + (1 - (pt.yhat - yMin) / rango) * p.h;
      vertex(px, py);
    }
    endShape();
  }

  drawingContext.restore();
}

function dibujarFronterasPanel1() {
  if (moduloActivo === 'experimento') { dibujarFronterasExperimentoPanel1(); return; }
  if (!modelos || modelos.length === 0) return;
  if (!esTipoClasif) { _dibujarCurvasRegresion(); return; }
  noFill();
  for (let i = 0; i < modelos.length; i++) {
    const m = modelos[i];
    if (!m.frontera || m.frontera.length === 0) continue;

    let grosor, alfa;
    if (_modeloDestacado(i))     { grosor = 3;   alfa = 255; }
    else if (modeloHover === i)  { grosor = 2.5; alfa = 230; }
    else if (_modeloAtenuado(i)) { grosor = 1;   alfa = 40;  }
    else                         { grosor = 2;   alfa = 180; }

    const c = m.color;
    stroke(red(c), green(c), blue(c), alfa);
    strokeWeight(grosor);

    if (_modeloDestacado(i) && modeloSeleccionado === i) {
      const ordenados = _ordenarFrontera(m.frontera);
      beginShape();
      for (const pt of ordenados) {
        const { px, py } = dataToPanel1(pt.x1, pt.x2);
        vertex(px, py);
      }
      endShape(CLOSE);
    } else {
      for (const pt of m.frontera) {
        const { px, py } = dataToPanel1(pt.x1, pt.x2);
        point(px, py);
      }
    }
  }
}

// ── Datos train/test ──────────────────────────────────────────────────────────

function _dibujarDatosRegresion() {
  const p = _panel1PlotArea();
  const { yMin, yMax } = _rangoRegresion();
  const yRango = yMax - yMin || 1;

  function xToP(x1) { return p.x + (x1 + 1) / 2 * p.w; }
  function yToP(y)  { return p.y + (1 - (y - yMin) / yRango) * p.h; }

  // Marco del área
  noFill(); stroke(200); strokeWeight(1);
  rect(p.x, p.y, p.w, p.h);

  // Eje x en y=0 si está dentro del rango
  const py0 = (yMin <= 0 && yMax >= 0) ? yToP(0) : p.y + p.h;
  stroke(180); strokeWeight(1);
  line(p.x, py0, p.x + p.w, py0);

  // Eje y en x=0 (x1 normalizado = 0)
  const px0 = xToP(0);
  line(px0, p.y, px0, p.y + p.h);

  const TICK = 4;

  // Ticks eje X
  fill(0x44, 0x44, 0x44); noStroke(); textSize(11); textAlign(CENTER, TOP);
  for (let v = -1; v <= 1.001; v += 0.5) {
    const vr = Math.round(v * 10) / 10;
    const tx = xToP(vr);
    stroke(180); strokeWeight(1);
    line(tx, py0 - TICK, tx, py0 + TICK);
    if (Math.abs(vr) > 0.01) {
      noStroke(); fill(0x44, 0x44, 0x44);
      text(vr.toFixed(1), tx, py0 + TICK + 2);
    }
  }

  // Ticks eje Y
  textAlign(RIGHT, CENTER);
  const nTicks = 5;
  for (let i = 0; i <= nTicks; i++) {
    const val = yMin + yRango * i / nTicks;
    const ty = yToP(val);
    stroke(180); strokeWeight(1);
    line(px0 - TICK, ty, px0 + TICK, ty);
    if (i > 0 || Math.abs(val) > 1e-4) {
      noStroke(); fill(0x44, 0x44, 0x44);
      text(val.toFixed(2), px0 - TICK - 2, ty);
    }
  }

  // Etiquetas de ejes
  noStroke(); fill(0x33, 0x33, 0x33); textSize(12);
  textAlign(LEFT, BOTTOM);
  text('x', p.x + p.w + 8, py0 + 4);
  textAlign(LEFT, TOP);
  text('y', px0 + 3, p.y - 4);

  // Datos train — color neutro
  noStroke(); fill(110, 110, 110, 200);
  for (const d of datosTrain) circle(xToP(d.x[0]), yToP(d.y), 7);

  // Datos test — cruces
  const ARM = 3;
  stroke(110, 110, 110, 200); strokeWeight(1.5); noFill();
  for (const d of datosTest) {
    const px = xToP(d.x[0]);
    const py = yToP(d.y);
    line(px - ARM, py, px + ARM, py);
    line(px, py - ARM, px, py + ARM);
  }

  // Leyenda
  const lx = p.x - 6;
  const ly = p.y + p.h - 28;
  fill(20, 20, 20, 150); noStroke();
  rect(lx - 4, ly - 4, 52, 34, 3);
  noStroke(); fill(180); ellipse(lx + 5, ly + 7, 7);
  fill(255); textSize(9); textAlign(LEFT, CENTER); noStroke();
  text('Train', lx + 13, ly + 7);
  stroke(0xdd, 0xdd, 0xdd); strokeWeight(1.5); noFill();
  line(lx + 2, ly + 22, lx + 8, ly + 22);
  line(lx + 5, ly + 19, lx + 5, ly + 25);
  noStroke(); fill(255); textSize(9); textAlign(LEFT, CENTER);
  text('Test', lx + 13, ly + 22);
}

function dibujarDatosPanel1() {
  if (!esTipoClasif) { _dibujarDatosRegresion(); return; }

  const COLOR_CLASE = ['#4B8BBE', '#E8825A'];
  const p = _panel1PlotArea();

  // Ejes
  stroke(180); strokeWeight(1);
  const { px: ax0 } = dataToPanel1(-1, 0);
  const { px: ax1 } = dataToPanel1(1, 0);
  const { py: ayMid } = dataToPanel1(0, 0);
  line(ax0, ayMid, ax1, ayMid);

  const { py: ay0 } = dataToPanel1(0, -1);
  const { py: ay1 } = dataToPanel1(0, 1);
  const { px: axMid } = dataToPanel1(0, 0);
  line(axMid, ay0, axMid, ay1);

  const TICK_SIZE = 4;
  fill(0x44); noStroke(); textSize(12); textAlign(CENTER, TOP);

  for (let v = -1; v <= 1.001; v += 0.5) {
    const vr = Math.round(v * 10) / 10;
    const { px: tx } = dataToPanel1(vr, 0);
    stroke(180); strokeWeight(1);
    line(tx, ayMid - TICK_SIZE, tx, ayMid + TICK_SIZE);
    if (Math.abs(vr) > 0.01) {
      noStroke(); fill(0x44, 0x44, 0x44);
      text(vr.toFixed(1), tx, ayMid + TICK_SIZE + 2);
    }
    const { py: ty } = dataToPanel1(0, vr);
    stroke(180); strokeWeight(1);
    line(axMid - TICK_SIZE, ty, axMid + TICK_SIZE, ty);
    if (Math.abs(vr) > 0.01) {
      noStroke(); fill(0x44, 0x44, 0x44); textAlign(RIGHT, CENTER);
      text(vr.toFixed(1), axMid - TICK_SIZE - 2, ty);
      textAlign(CENTER, TOP);
    }
  }

  fill(0x33, 0x33, 0x33); noStroke(); textSize(12); textAlign(RIGHT, BOTTOM);
  text('x₁', ax1 + 12, ayMid + 4);
  textAlign(LEFT, TOP);
  text('x₂', axMid + 3, ay1 - 14);

  // Datos train
  noStroke();
  for (const d of datosTrain) {
    fill(color(COLOR_CLASE[d.y]));
    const { px, py } = dataToPanel1(d.x[0], d.x[1]);
    circle(px, py, 8);
  }

  // Datos test — cruz +
  const ARM = 4; // mitad del brazo = radio equivalente a circle(8)
  for (const d of datosTest) {
    const { px, py } = dataToPanel1(d.x[0], d.x[1]);
    stroke(color(COLOR_CLASE[d.y])); strokeWeight(2); noFill();
    line(px - ARM, py, px + ARM, py);
    line(px, py - ARM, px, py + ARM);
  }

  // Leyenda
  const lx = p.x - 6;
  const ly = p.y + p.h - 28;
  fill(20, 20, 20, 150); noStroke();
  rect(lx - 4, ly - 4, 52, 34, 3);
  fill(180); noStroke(); ellipse(lx + 5, ly + 7, 7);
  fill(255); textSize(9); textAlign(LEFT, CENTER); noStroke();
  text('Train', lx + 13, ly + 7);
  // Cruz de leyenda para Test — color neutro
  stroke(0xdd, 0xdd, 0xdd); strokeWeight(2); noFill();
  line(lx + 2, ly + 22, lx + 8, ly + 22);
  line(lx + 5, ly + 19, lx + 5, ly + 25);
  noStroke(); fill(255); textSize(9); textAlign(LEFT, CENTER);
  text('Test', lx + 13, ly + 22);
}

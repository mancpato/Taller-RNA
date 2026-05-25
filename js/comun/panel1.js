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
  const grid  = calcularGridPrediccion(modelo, 50);
  gfxMapa     = renderizarMapaPrediccion(grid, 50);
  fronteraPrueba = calcularFrontera(grid, 50);
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

function dibujarFronterasPanel1() {
  if (!modelos || modelos.length === 0) return;
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

function dibujarDatosPanel1() {
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

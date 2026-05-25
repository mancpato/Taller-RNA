// ============================================================================
// eventos.js — Interacción del mouse: Panel 1, Panel 2, Panel 3, pestañas
// ============================================================================

function _distMinFrontera(puntos) {
  let minDist = Infinity;
  for (const pt of puntos) {
    const { px, py } = dataToPanel1(pt.x1, pt.x2);
    const d = Math.hypot(mouseX - px, mouseY - py);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function _handleClickPanel3Default(mx, my, r3c) {
  const DIAM_C = 10, SEP_C = 48;
  const totalW = modelos.length * SEP_C - (SEP_C - DIAM_C);
  const cirX0  = r3c.x + (r3c.w - totalW) / 2;
  const cirY   = r3c.y + r3c.h - 40;
  const HIT_R  = 14;

  for (let i = 0; i < modelos.length; i++) {
    const cx = cirX0 + i * SEP_C;
    if (Math.hypot(mx - cx, my - cirY) <= HIT_R) {
      modeloSeleccionado = (modeloSeleccionado === i) ? null : i;
      if (modeloSeleccionado !== null) {
        modeloMapa = modelos[modeloSeleccionado];
        renderizarMapa(modeloMapa);
      }
      break;
    }
  }
}

function mousePressed(event) {
  // ── Pestañas ────────────────────────────────────────────────────────────────
  const pestanas     = ['topologia', 'activacion', 'init', 'eta', 'momentum'];
  const anchoPestana = 140;
  let xTab = 8;
  for (let i = 0; i < pestanas.length; i++) {
    if (mouseX > xTab && mouseX < xTab + anchoPestana &&
        mouseY > 0    && mouseY < TAB_HEIGHT) {
      moduloActivo = pestanas[i];
      actualizarModuloOverlay();
      resetear();
      break;
    }
    xTab += anchoPestana + 2;
  }

  // ── Panel 3: círculos del enjambre ───────────────────────────────────────────
  if (modelos && modelos.length > 0) {
    const r3c = panelRect(3);
    if (moduloActivo === 'init') handleClickPanel3Init(mouseX, mouseY, r3c);
    else                         _handleClickPanel3Default(mouseX, mouseY, r3c);
  }

  // ── Panel 1: click en frontera ───────────────────────────────────────────────
  const r1 = panelRect(1);
  if (mouseX >= r1.x && mouseX <= r1.x + r1.w &&
      mouseY >= r1.y && mouseY <= r1.y + r1.h) {
    let mejorIdx = null, mejorDist = Infinity;
    for (let i = 0; i < modelos.length; i++) {
      if (!modelos[i].frontera || modelos[i].frontera.length === 0) continue;
      const d = _distMinFrontera(modelos[i].frontera);
      if (d < 8 && d < mejorDist) { mejorDist = d; mejorIdx = i; }
    }
    if (mejorIdx !== null) {
      modeloSeleccionado = mejorIdx;
      modeloMapa = modelos[mejorIdx];
      renderizarMapa(modeloMapa);
    } else {
      modeloSeleccionado = null;
      distribucionSeleccionada = null;
    }
  }

  // ── Panel 2: toggles ─────────────────────────────────────────────────────────
  {
    const r2 = panelRect(2);
    const BTN_W = 44, BTN_H = 18, GAP = 6;
    const bY      = r2.y + 5;
    const bX_J    = r2.x + r2.w - 10 - BTN_W;
    const bX_Test = bX_J - GAP - BTN_W;
    const bX_Lin  = bX_Test - GAP - BTN_W;
    if (mouseY >= bY && mouseY <= bY + BTN_H) {
      if (mouseX >= bX_Lin  && mouseX <= bX_Lin  + BTN_W) modoLogPanel2 = !modoLogPanel2;
      if (mouseX >= bX_Test && mouseX <= bX_Test + BTN_W) mostrarCurvasTest = !mostrarCurvasTest;
      if (esTipoClasif && mouseX >= bX_J && mouseX <= bX_J + BTN_W) modoAccPanel2 = !modoAccPanel2;
    }
  }

  // ── Panel 2: click en curva ───────────────────────────────────────────────────
  {
    const r2 = panelRect(2);
    if (mouseX >= r2.x && mouseX <= r2.x + r2.w &&
        mouseY >= r2.y && mouseY <= r2.y + r2.h) {
      const plot  = _panel2PlotArea();
      const campo = modoAccPanel2 ? 'accuracy_test' : 'J_train';
      const { yMin, yMax } = _calcularRangoY();
      let mejorIdx = null, mejorDist = 10;
      if (modelos) {
        for (let i = 0; i < modelos.length; i++) {
          const m = modelos[i];
          if (!m.historial || m.historial.length < 2) continue;
          for (let ep = 0; ep < m.historial.length; ep++) {
            const val = m.historial[ep][campo];
            if (val === undefined || val === null) continue;
            const cx = _epToX(ep, _xMaxPanel2(), plot);
            const cy = _valToY(val, plot, yMin, yMax);
            const d  = Math.hypot(mouseX - cx, mouseY - cy);
            if (d < mejorDist) { mejorDist = d; mejorIdx = i; }
          }
        }
      }
      if (mejorIdx !== null) {
        modeloSeleccionado = mejorIdx;
        modeloMapa = modelos[mejorIdx];
        renderizarMapa(modeloMapa);
      }
    }
  }

  if (event && event.target && event.target.tagName === 'CANVAS') return false;
}

function mouseMoved() {
  const r1 = panelRect(1);
  if (mouseX >= r1.x && mouseX <= r1.x + r1.w &&
      mouseY >= r1.y && mouseY <= r1.y + r1.h) {
    let mejorIdx = null, mejorDist = Infinity;
    for (let i = 0; i < modelos.length; i++) {
      if (!modelos[i].frontera || modelos[i].frontera.length === 0) continue;
      const d = _distMinFrontera(modelos[i].frontera);
      if (d < 8 && d < mejorDist) { mejorDist = d; mejorIdx = i; }
    }
    modeloHover = mejorIdx;
  } else {
    const r2 = panelRect(2);
    if (mouseX >= r2.x && mouseX <= r2.x + r2.w &&
        mouseY >= r2.y && mouseY <= r2.y + r2.h) {
      const plot  = _panel2PlotArea();
      const campo = modoAccPanel2 ? 'accuracy_test' : 'J_train';
      const { yMin, yMax } = _calcularRangoY();
      let mejorIdx = null, mejorDist = 12;
      if (modelos) {
        for (let i = 0; i < modelos.length; i++) {
          const m = modelos[i];
          if (!m.historial || m.historial.length < 2) continue;
          for (let ep = 0; ep < m.historial.length; ep++) {
            const val = m.historial[ep][campo];
            if (val === undefined || val === null) continue;
            const cx = _epToX(ep, _xMaxPanel2(), plot);
            const cy = _valToY(val, plot, yMin, yMax);
            const d  = Math.hypot(mouseX - cx, mouseY - cy);
            if (d < mejorDist) { mejorDist = d; mejorIdx = i; }
          }
        }
      }
      modeloHover = mejorIdx;
    } else {
      modeloHover = null;
    }
  }
}

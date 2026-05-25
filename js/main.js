/**
 * TalleRNA: Taller de Redes Neuronales Artificiales
 * @file: main.js
 * @description: Maneja la inicialización, loop principal y 
 *    redimensionamiento de la ventana.
 * @author: Miguel Ángel Norzagaray Cosío
 * @since: abril de 2026
 * 
 * Este archivo es el punto de entrada principal del proyecto. 
 * Contiene la función setup() para la inicialización y draw() 
 * para el loop de renderizado. También incluye la función 
 * windowResized() para manejar cambios en el tamaño de la ventana. 
 * Las funciones initDatos() e initHistorial() están definidas pero 
 * vacías, ya que su implementación se realizará en etapas posteriores 
 * del proyecto.
 */

// ============================================================================
// INICIALIZACIÓN Y LOOP PRINCIPAL
// ============================================================================

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('p5-container');
  colorMode(RGB, 255);

  inicializarPaletas();

  const datosGenerados = generarDatos(problema, nivelRuido / 100, trainRatio, semillaDatos);
  const datosNorm = normalizarDatos(datosGenerados.datosTrain, datosGenerados.datosTest);
  datosTrain = datosNorm.datosTrain;
  datosTest = datosNorm.datosTest;

  crearOverlayBarra();
  crearOverlayPanel3();
  actualizarModuloOverlay();
  initEnjambre();
  initDatos();
  initHistorial();

  const _mReg = crearModelo([1, 4, 1], 'relu', 0.05, 0, 7, 'xavier');
  const _prevClasif = esTipoClasif;
  esTipoClasif = false;
  const _fwdReg = forward(_mReg, [[0.5]], false);
  const _salReg = _fwdReg.activaciones[_fwdReg.activaciones.length - 1][0][0];
  esTipoClasif = _prevClasif;
  console.log('[Bug#1 fix] Salida regresión:', _salReg);

  const _mDrop = crearModelo([2, 4, 1], 'relu', 0.05, 0.5, 99, 'xavier');
  const _f1 = forward(_mDrop, [[0.1, 0.2]], true);
  _mDrop.stepCount++;
  const _f2 = forward(_mDrop, [[0.1, 0.2]], true);
  const _m1 = Array.from(_f1.mascarasDropout[1][0]);
  const _m2 = Array.from(_f2.mascarasDropout[1][0]);
  const _distintas = _m1.some((v, i) => v !== _m2[i]);
  console.log('[Bug#2 fix] Máscaras dropout distintas:', _distintas);

  console.log('Setup completado. Estado: IDLE');
}

function draw() {
  background(245);

  dibujarBarraGlobal();
  dibujarPestanas();
  dibujarPaneles();
  dibujarMapaPanel1();
  dibujarFronterasPanel1();
  dibujarDatosPanel1();
  dibujarHistorialPanel2();
  dibujarControlesPanel3();
  dibujarResumenPanel4();
  dibujarRedPanel4();
  dibujarNotificacion();

  if (enEstado('RUNNING')) {
    const pasos = pasosPorFrame();
    for (let p = 0; p < pasos; p++) {
      for (const m of modelos)
        if (m.estado === 'activo')
          stepModelo(m);

      if (modelos.length > 0 && modelos.every(m => m.estado !== 'activo')) {
        converger();
        break;
      }

      if (_epochTarget !== null) {
        const epMax = modelos
          .filter(m => m.estado === 'activo')
          .reduce((acc, m) => Math.max(acc, m.historial.length), 0);
        if (epMax >= _epochTarget) {
          _epochTarget = null;
          detener();
          break;
        }
      }
    }

    if (_epochTarget !== null) {
      const epActual = modelos.length > 0
        ? Math.max(...modelos.map(m => m.historial.length)) : 0;
      if (epActual >= _epochTarget) {
        _epochTarget = null;
        detener();
      }
    }

    const activosIdx = modelos
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.estado === 'activo');
    
    if (activosIdx.length > 0) {
      fronteraUpdateIdx = fronteraUpdateIdx % activosIdx.length;
      const { m: mActualizar } = activosIdx[fronteraUpdateIdx];
      const grid = calcularGridPrediccion(mActualizar, 50);
      mActualizar.frontera = calcularFrontera(grid, 50);
      fronteraUpdateIdx++;
    }

    const actualizarMapa = velocidad === 'lenta' ||
                           (velocidad === 'normal' && frameCount % 5  === 0) ||
                           (velocidad === 'rapida' && frameCount % 25 === 0);
    if (actualizarMapa && modelos.length > 0) {
      const ref = modeloSeleccionado !== null ? modeloSeleccionado : 0;
      renderizarMapa(modelos[ref]);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  posicionarOverlayBarra();
  posicionarOverlayPanel3();
  if (modeloMapa) 
    renderizarMapa(modeloMapa);
}

// Funciones vacías necesarias en esta etapa
function initDatos() {}
function initHistorial() {}
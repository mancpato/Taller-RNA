// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: EXPERIMENTO FACTORIAL
// Variable 1: configurable (η, momentum, activación, topología)
// Variable 2: configurable (ídem, distinto al primero)
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. CONFIGURACIÓN Y ESTADO DEL EXPERIMENTO ─────────────────────────────────

const EXP_PASOS_POR_FRAME = 10;

// Máquina de estados del módulo (independiente del estado global de TalleRNA)
let expEstado = 'CONFIGURANDO'; // | 'EJECUTANDO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO'

// Grilla de runs
let expGrilla    = [];   // Array 2D [i][j] de ExperimentRun
let expCola      = [];   // expGrilla.flat() al lanzar — orden FIFO
let expRunActual = 0;    // índice en expCola del run en curso
let expTotal     = 0;    // expCola.length

// Configuración activa del experimento
let expConfig = {
  par:          'eta_topologia',
  hiper1:       { nombre: 'eta',      tipo: 'continuo',  valores: [] },
  hiper2:       { nombre: 'topologia', tipo: 'ordinal',   valores: [] },
  maximoEpocas: 200,
  semillaPesos: 1,
  pregunta:     '¿Una red más profunda necesita η más baja?'
};

// Selección en heatmap (Panel 4)
let expHover      = null;  // {i,j} | null
let expSel        = null;  // {i,j} | null
let expSelFila    = null;  // índice i | null
let expSelColumna = null;  // índice j | null

// Referencia de tiempo para estimación (~500ms por modelo si no hay datos)
let expTiempoRefMs = 500;

// Determina si Panel 4 usa barras agrupadas en lugar de heatmap
let expUsaBarras = false;

// Evita recalcular paleta si no hay runs nuevos
let expCompletadosUltimoPaleta = -1;

// Modelo activo en Panel 1 (el de menor J_test o el seleccionado)
let _expModeloActivoIdx = null;

// Selector de métrica en Panel 4
let expMetrica = 'J_test'; // | 'J_train' | 'accuracy' | 'epocas' | 'gap'

// Cache de escala de paleta
let _expPaletaMin = 0;
let _expPaletaMax = 1;

// Posición del selector DOM en Panel 4
let _expSelectMetrica = null;

// Pares curados con valores por defecto y preguntas
const EXP_PARES_CURADOS = {
  eta_activacion: {
    label:    'η × activación',
    pregunta: '¿ReLU sigue ganando con η pequeña?',
    hiper1: { nombre:'eta',       tipo:'continuo',   min:0.01, max:0.20, pasos:4 },
    hiper2: { nombre:'activacion', tipo:'categorico', valores:['relu','sigmoid','tanh','lineal'] }
  },
  eta_topologia: {
    label:    'η × topología',
    pregunta: '¿Una red más profunda necesita η más baja?',
    hiper1: { nombre:'eta',       tipo:'continuo', min:0.01, max:0.20, pasos:4 },
    hiper2: { nombre:'topologia', tipo:'ordinal',  valores:['T0','T1','T2','T3'] }
  },
  eta_momentum: {
    label:    'η × momentum β',
    pregunta: '¿Con β alto puedo usar η más pequeña?',
    hiper1: { nombre:'eta',      tipo:'continuo', min:0.01, max:0.20, pasos:4 },
    hiper2: { nombre:'momentum', tipo:'continuo', min:0.0,  max:0.9,  pasos:4 }
  },
  topologia_momentum: {
    label:    'topología × momentum β',
    pregunta: '¿El momentum importa más en redes grandes?',
    hiper1: { nombre:'topologia', tipo:'ordinal',  valores:['T0','T1','T2','T3'] },
    hiper2: { nombre:'momentum',  tipo:'continuo', min:0.0, max:0.9, pasos:4 }
  }
};

// Definición de topologías (mismas que módulo topología)
const EXP_TOPOLOGIAS = {
  T0: { capas: [2, 1],       etiqueta: '2→1'     },
  T1: { capas: [2, 2, 1],   etiqueta: '2→2→1'   },
  T2: { capas: [2, 3, 1],   etiqueta: '2→3→1'   },
  T3: { capas: [2, 4, 1],   etiqueta: '2→4→1 ★' },
  T4: { capas: [2, 2, 3, 1], etiqueta: '2→2→3→1' },
  T5: { capas: [2, 3, 2, 1], etiqueta: '2→3→2→1' },
  T6: { capas: [2, 4, 4, 1], etiqueta: '2→4→4→1' },
  T7: { capas: [2, 6, 4, 1], etiqueta: '2→6→4→1' }
};

// ── 2. GENERACIÓN Y EJECUCIÓN ─────────────────────────────────────────────────

function iniciarModuloExperimento() 
{
  if (expEstado === 'EJECUTANDO' || expEstado === 'PAUSADO') {
    cancelarExperimento();
  }
  expEstado             = 'CONFIGURANDO';
  expGrilla             = [];
  expCola               = [];
  expRunActual          = 0;
  expTotal              = 0;
  expHover              = null;
  expSel                = null;
  expSelFila            = null;
  expSelColumna         = null;
  expUsaBarras          = false;
  expCompletadosUltimoPaleta = -1;
  _expModeloActivoIdx   = null;

  _expMostrarFaseConfigurando();
}

function _resolverValoresContinuos(min, max, pasos, escala) 
{
  const vals = [];
  for (let k = 0; k < pasos; k++) {
    if (escala === 'log') {
      vals.push(min * Math.pow(max / min, k / (pasos - 1)));
    } else {
      vals.push(min + (max - min) * k / (pasos - 1));
    }
  }
  return vals;
}

function _resolverValoresHiper(cfg) {
  if (cfg.tipo === 'continuo') {
    const escala = cfg.nombre === 'eta' ? 'log' : 'lineal';
    return _resolverValoresContinuos(cfg.min, cfg.max, cfg.pasos, escala);
  }
  return cfg.valores; // ordinal o categórico: ya son los valores directos
}

function generarGrilla() {
  const vals1 = _resolverValoresHiper(expConfig.hiper1);
  const vals2 = _resolverValoresHiper(expConfig.hiper2);

  expConfig.hiper1.valores = vals1;
  expConfig.hiper2.valores = vals2;
  expUsaBarras = expConfig.hiper1.tipo === 'categorico' || expConfig.hiper2.tipo === 'categorico';

  expGrilla = [];
  for (let i = 0; i < vals1.length; i++) {
    expGrilla[i] = [];
    for (let j = 0; j < vals2.length; j++) {
      const mc = _resolverModeloConfig(expConfig.hiper1.nombre, vals1[i],
                                       expConfig.hiper2.nombre, vals2[j]);
      expGrilla[i][j] = {
        coordenada: { i, j },
        hiper1:     { nombre: expConfig.hiper1.nombre, valor: vals1[i] },
        hiper2:     { nombre: expConfig.hiper2.nombre, valor: vals2[j] },
        modeloConfig: mc,
        modelo:   null,
        estado:   'pendiente',
        metricas: { J_train: null, J_test: null, accuracy: null,
                    epocas: null, gap: null, tiempo_ms: null },
        historial: [],
        t0:        null
      };
    }
  }
  expTotal = vals1.length * vals2.length;
}

function _resolverModeloConfig(nombre1, valor1, nombre2, valor2) {
  const cfg = {
    capas:        esTipoClasif ? [2, 4, 1] : [1, 4, 1],
    activacion:   'relu',
    eta:          0.05,
    beta:         0.9,
    dropout:      0,
    distribucion: 'xavier',
    semillaPesos: expConfig.semillaPesos
  };

  function aplicar(nombre, valor) {
    if (nombre === 'eta')        cfg.eta       = valor;
    else if (nombre === 'momentum')   cfg.beta  = valor;
    else if (nombre === 'activacion') cfg.activacion = valor;
    else if (nombre === 'topologia') {
      const id = typeof valor === 'string' ? valor : valor.id;
      cfg.capas = EXP_TOPOLOGIAS[id].capas.slice();
      if (!esTipoClasif) cfg.capas[0] = 1;
    }
  }
  aplicar(nombre1, valor1);
  aplicar(nombre2, valor2);
  return cfg;
}

function lanzarExperimento() {
  generarGrilla();
  expCola      = expGrilla.flat();
  expTotal     = expCola.length;
  expRunActual = 0;
  expEstado    = 'EJECUTANDO';
  expCompletadosUltimoPaleta = -1;

  if (expCola.length > 0) iniciarRun(expCola[0]);
  _expMostrarFaseProgreso();
}

function iniciarRun(run) {
  const c = run.modeloConfig;
  run.modelo = crearModelo(c.capas, c.activacion, c.eta, c.dropout,
                           c.semillaPesos, c.distribucion, c.beta);
  run.estado = 'entrenando';
  run.t0     = performance.now();
}

function stepExperimento() {
  if (expRunActual >= expTotal) {
    expEstado = 'COMPLETADO';
    _expMostrarFaseCompletado();
    return;
  }

  const run = expCola[expRunActual];
  if (!run || run.estado !== 'entrenando') return;

  for (let s = 0; s < EXP_PASOS_POR_FRAME; s++) {
    const hist  = run.modelo.historial;
    const J_ant = hist.length > 0 ? hist[hist.length - 1].J_train : null;

    entrenarEpoca(run.modelo, datosTrain);

    if (hayNaN(run.modelo)) {
      finalizarRun(run, 'nan'); break;
    }
    const { diverge } = verificarDivergencia(run.modelo, J_ant);
    if (diverge) {
      finalizarRun(run, 'divergente'); break;
    }
    if (verificarConvergencia(run.modelo)) {
      finalizarRun(run, 'convergido'); break;
    }
    if (hist.length >= expConfig.maximoEpocas) {
      finalizarRun(run, 'max_epocas'); break;
    }
  }
}

function finalizarRun(run, estado) {
  run.estado = estado;
  const h    = run.historial;
  const ult  = h.length > 0 ? h[h.length - 1] : {};

  run.metricas = {
    J_train:   ult.J_train   ?? null,
    J_test:    ult.J_test    ?? null,
    accuracy:  ult.accuracy_test ?? null,
    epocas:    h.length,
    gap:       (ult.J_test != null && ult.J_train != null)
               ? ult.J_test - ult.J_train : null,
    tiempo_ms: performance.now() - run.t0
  };

  expTiempoRefMs = run.metricas.tiempo_ms;

  const hist = run.modelo.historial;
  if (hist.length > 0) {
    const ultimo = hist[hist.length - 1];
    run.metricas.J_train  = ultimo.J_train  ?? null;
    run.metricas.J_test   = ultimo.J_test   ?? null;
    run.metricas.accuracy = ultimo.accuracy_test ?? null;
    run.metricas.epocas   = hist.length;
    run.metricas.gap = (run.metricas.J_test != null && run.metricas.J_train != null)
      ? run.metricas.J_test - run.metricas.J_train : null;
  }

  expRunActual++;
  if (expRunActual < expTotal) {
    iniciarRun(expCola[expRunActual]);
  }
}

function hayNaN(modelo) {
  for (const capa of modelo.pesos)
    for (const w of capa)
      if (!isFinite(w) || Math.abs(w) > 1e6) return true;
  for (const capa of modelo.sesgos)
    for (const b of capa)
      if (!isFinite(b) || Math.abs(b) > 1e6) return true;
  return false;
}

function cancelarExperimento() {
  if (expRunActual < expTotal) {
    const run = expCola[expRunActual];
    if (run && run.estado === 'entrenando') finalizarRun(run, 'cancelado');
    for (let k = expRunActual; k < expTotal; k++) {
      if (expCola[k].estado === 'pendiente') expCola[k].estado = 'cancelado';
    }
  }
  expEstado = 'CANCELADO';
  _expMostrarFaseCancelado();
}

function togglePausaExperimento() {
  if (expEstado === 'EJECUTANDO') expEstado = 'PAUSADO';
  else if (expEstado === 'PAUSADO') expEstado = 'EJECUTANDO';
  _expActualizarBotonesProgreso();
}

// ── 3. CONTROLES PANEL 3 (DOM) ────────────────────────────────────────────────

function crearSeccionOverlayExperimento() {
  const overlay = document.getElementById('panel3-overlay');
  if (!overlay) return;

  const div = document.createElement('div');
  div.id = 'controles-experimento';
  div.style.display = 'none';
  div.innerHTML = `
    <div id="exp-fase-config">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <button id="exp-btn-iniciar" style="flex:0 0 40%;font-size:11px">Iniciar experimento</button>
        <select id="select-epocas-exp" style="flex:1;font-size:11px">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200" selected>200</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
        <input id="exp-semilla" type="number" min="1" max="9999" value="1"
               style="width:48px;font-size:11px">
        <span id="exp-total-display" style="font-size:10px;color:#666;white-space:nowrap">0</span>
      </div>
      <div id="exp-aviso-n" style="display:none;font-size:11px;color:#a06000;margin-bottom:4px"></div>
      <button id="exp-btn-confirmar" style="display:none;width:100%;margin-bottom:4px;font-size:11px">Confirmar e iniciar</button>

      <div style="font-size:11px;font-weight:bold;margin:4px 0 2px">Par de hiperparámetros:</div>
      <select id="exp-select-par" style="width:100%;margin-bottom:6px;font-size:11px">
        <optgroup label="── Pares recomendados ──">
          <option value="eta_activacion">η × activación</option>
          <option value="eta_topologia" selected>η × topología</option>
          <option value="eta_momentum">η × momentum β</option>
          <option value="topologia_momentum">topología × momentum β</option>
        </optgroup>
        <optgroup label="── Modo libre ──">
          <option value="libre">Libre…</option>
        </optgroup>
      </select>

      <div id="exp-libre-selects" style="display:none;margin-bottom:6px">
        <div style="display:flex;gap:4px;align-items:center;font-size:11px">
          <select id="exp-libre-h1" style="flex:1;font-size:11px">
            <option value="eta">η</option>
            <option value="momentum">momentum β</option>
            <option value="topologia">topología</option>
            <option value="activacion">activación</option>
          </select>
          <span>×</span>
          <select id="exp-libre-h2" style="flex:1;font-size:11px">
            <option value="topologia">topología</option>
            <option value="eta">η</option>
            <option value="momentum">momentum β</option>
            <option value="activacion">activación</option>
          </select>
        </div>
        <div id="exp-aviso-cat" style="display:none;font-size:10px;color:#888;margin-top:3px">
          ⚠ Panel 4 usará tabla de barras en lugar de mapa de calor
        </div>
      </div>

      <div style="display:flex;gap:6px">
        <div id="exp-controles-h1" style="flex:1;min-width:0"></div>
        <div id="exp-controles-h2" style="flex:1;min-width:0"></div>
      </div>

      <div id="exp-pregunta-wrap" style="margin-top:4px;font-size:9px;color:#446;display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        <em id="exp-pregunta-texto"></em>
      </div>
    </div>

    <div id="exp-fase-progreso" style="display:none">
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button id="exp-btn-pausa" style="flex:1">Pausar</button>
        <button id="exp-btn-cancelar" style="flex:1">Cancelar</button>
      </div>
      <div style="font-size:11px;font-weight:bold;margin-bottom:2px">Progreso:</div>
      <div style="background:#e0e0e0;border-radius:2px;height:10px;margin-bottom:3px">
        <div id="exp-barra-prog" style="background:#4a90d9;height:10px;border-radius:2px;width:0%"></div>
      </div>
      <div id="exp-texto-prog" style="font-size:11px;margin-bottom:4px">0 / 0 modelos</div>
      <div style="font-size:11px;font-weight:bold">En curso:</div>
      <div id="exp-en-curso" style="font-size:11px;color:#555;margin-bottom:4px">—</div>
      <div id="exp-stats-prog" style="font-size:11px;color:#555;line-height:1.6"></div>
    </div>

    <div id="exp-fase-completado" style="display:none">
      <div style="font-size:12px;font-weight:bold;color:#2a8a4a;margin-bottom:6px">✓ Experimento completado</div>
      <div id="exp-resumen-completado" style="font-size:11px;margin-bottom:8px"></div>
      <button id="exp-btn-exportar" style="width:100%;margin-bottom:4px">Exportar CSV</button>
      <button id="exp-btn-nuevo" style="width:100%">Nuevo experimento</button>
    </div>

    <div id="exp-fase-cancelado" style="display:none">
      <div style="font-size:12px;font-weight:bold;color:#c04040;margin-bottom:6px">✗ Experimento cancelado</div>
      <div id="exp-resumen-cancelado" style="font-size:11px;margin-bottom:8px"></div>
      <button id="exp-btn-exportar-parc" style="width:100%;margin-bottom:4px">Exportar CSV parcial</button>
      <button id="exp-btn-nuevo-parc" style="width:100%">Nuevo experimento</button>
    </div>
  `;
  overlay.appendChild(div);

  // Eventos
  document.getElementById('exp-btn-iniciar').addEventListener('click', _expClickIniciar);
  document.getElementById('exp-btn-confirmar').addEventListener('click', lanzarExperimento);
  document.getElementById('exp-select-par').addEventListener('change', _expCambiarPar);
  document.getElementById('exp-libre-h1').addEventListener('change', _expActualizarLibre);
  document.getElementById('exp-libre-h2').addEventListener('change', _expActualizarLibre);
  document.getElementById('select-epocas-exp').addEventListener('change', function() {
    expConfig.maximoEpocas = parseInt(this.value);
  });
  document.getElementById('exp-semilla').addEventListener('change', function() {
    expConfig.semillaPesos = parseInt(this.value) || 1;
  });
  document.getElementById('exp-btn-pausa').addEventListener('click', togglePausaExperimento);
  document.getElementById('exp-btn-cancelar').addEventListener('click', cancelarExperimento);
  document.getElementById('exp-btn-exportar').addEventListener('click', exportarCSV);
  document.getElementById('exp-btn-exportar-parc').addEventListener('click', exportarCSV);
  document.getElementById('exp-btn-nuevo').addEventListener('click', _expNuevoExperimento);
  document.getElementById('exp-btn-nuevo-parc').addEventListener('click', _expNuevoExperimento);

  // Crear selector de métrica para Panel 4
  _expCrearSelectorMetrica();

  // Cargar par por defecto
  _expCambiarPar();
}

function _expCrearSelectorMetrica() {
  if (_expSelectMetrica) return;
  _expSelectMetrica = document.createElement('select');
  _expSelectMetrica.id = 'exp-select-metrica';
  _expSelectMetrica.style.cssText = 'position:absolute;font-size:10px;display:none';
  _expSelectMetrica.innerHTML = `
    <option value="J_test" selected>J_test</option>
    <option value="J_train">J_train</option>
    <option value="accuracy">Accuracy</option>
    <option value="epocas">Épocas</option>
    <option value="gap">Gap</option>
  `;
  _expSelectMetrica.addEventListener('change', function() {
    expMetrica = this.value;
    expCompletadosUltimoPaleta = -1; // forzar recálculo
  });
  document.body.appendChild(_expSelectMetrica);
}

function _expPosicionarSelectorMetrica() {
  if (!_expSelectMetrica) return;
  if (moduloActivo !== 'experimento') {
    _expSelectMetrica.style.display = 'none';
    return;
  }
  const r4 = panelRect(4);
  _expSelectMetrica.style.display = 'block';
  _expSelectMetrica.style.left = (r4.x + 8) + 'px';
  _expSelectMetrica.style.top  = (r4.y + 28) + 'px';

  // Deshabilitar Accuracy en regresión
  const optAcc = _expSelectMetrica.querySelector('option[value="accuracy"]');
  if (optAcc) optAcc.disabled = !esTipoClasif;
  if (!esTipoClasif && expMetrica === 'accuracy') {
    expMetrica = 'J_test';
    _expSelectMetrica.value = 'J_test';
  }
}

function _expCambiarPar() {
  const sel = document.getElementById('exp-select-par');
  if (!sel) return;
  const par = sel.value;

  const libreDiv = document.getElementById('exp-libre-selects');
  if (par === 'libre') {
    libreDiv.style.display = 'block';
    _expActualizarLibre();
  } else {
    libreDiv.style.display = 'none';
    const def = EXP_PARES_CURADOS[par];
    if (!def) return;
    expConfig.par = par;
    expConfig.pregunta = def.pregunta;
    expConfig.hiper1 = Object.assign({}, def.hiper1);
    expConfig.hiper2 = Object.assign({}, def.hiper2);
    _expRenderizarControlesHiper(1, expConfig.hiper1);
    _expRenderizarControlesHiper(2, expConfig.hiper2);
    const pWrap = document.getElementById('exp-pregunta-wrap');
    const pTxt  = document.getElementById('exp-pregunta-texto');
    if (pWrap && pTxt) {
      pTxt.textContent = `"${def.pregunta}"`;
      pWrap.style.display = 'block';
    }
  }
  _expActualizarTotal();
}

function _expActualizarLibre() {
  const h1 = document.getElementById('exp-libre-h1')?.value;
  const h2 = document.getElementById('exp-libre-h2')?.value;
  if (!h1 || !h2) return;

  // Prevenir duplicados
  if (h1 === h2) {
    notificar('Los dos hiperparámetros deben ser distintos');
    return;
  }

  const avisoDiv = document.getElementById('exp-aviso-cat');
  const tieneCateg = h1 === 'activacion' || h2 === 'activacion';
  if (avisoDiv) avisoDiv.style.display = tieneCateg ? 'block' : 'none';

  expConfig.par = 'libre';
  expConfig.pregunta = '';
  expConfig.hiper1 = _expConfigPorNombre(h1);
  expConfig.hiper2 = _expConfigPorNombre(h2);
  _expRenderizarControlesHiper(1, expConfig.hiper1);
  _expRenderizarControlesHiper(2, expConfig.hiper2);

  const pWrap = document.getElementById('exp-pregunta-wrap');
  if (pWrap) pWrap.style.display = 'none';

  _expActualizarTotal();
}

function _expConfigPorNombre(nombre) {
  if (nombre === 'eta')
    return { nombre:'eta', tipo:'continuo', min:0.01, max:0.20, pasos:4 };
  if (nombre === 'momentum')
    return { nombre:'momentum', tipo:'continuo', min:0.0, max:0.9, pasos:4 };
  if (nombre === 'topologia')
    return { nombre:'topologia', tipo:'ordinal', valores:['T0','T1','T2','T3'] };
  if (nombre === 'activacion')
    return { nombre:'activacion', tipo:'categorico', valores:['relu','sigmoid','tanh','lineal'] };
  return { nombre, tipo:'continuo', min:0, max:1, pasos:3 };
}

function _expRenderizarControlesHiper(num, cfg) {
  const cont = document.getElementById(`exp-controles-h${num}`);
  if (!cont) return;

  const label = { eta:'η', momentum:'momentum β', topologia:'topología', activacion:'activación' };
  const titulo = label[cfg.nombre] || cfg.nombre;

  let html = `<div style="font-size:10px;font-weight:bold;margin:3px 0 2px;border-top:1px solid #ddd;padding-top:3px">H${num}: ${titulo}</div>`;

  if (cfg.tipo === 'continuo') {
    const escala = cfg.nombre === 'eta' ? 'log' : 'lin';
    html += `
      <div style="display:flex;gap:8px;align-items:center;font-size:10px">
        <label style="display:flex;align-items:center;gap:2px;white-space:nowrap">Mín<input type="number" id="exp-h${num}-min" value="${cfg.min}" step="0.001" style="width:42px;font-size:10px"></label>
        <label style="display:flex;align-items:center;gap:2px;white-space:nowrap">Máx<input type="number" id="exp-h${num}-max" value="${cfg.max}" step="0.001" style="width:42px;font-size:10px"></label>
        <label style="display:flex;align-items:center;gap:2px;white-space:nowrap">N<select id="exp-h${num}-pasos" style="font-size:10px">${[2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cfg.pasos ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <div style="font-size:9px;color:#888;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escala} · <span id="exp-h${num}-vals-display"></span></div>
    `;
  } else if (cfg.tipo === 'ordinal') {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:11px" id="exp-h${num}-checks">`;
    Object.entries(EXP_TOPOLOGIAS).forEach(([id, topo]) => {
      const checked = cfg.valores.includes(id) ? 'checked' : '';
      html += `<label><input type="checkbox" class="exp-h${num}-topo-cb" value="${id}" ${checked}> ${id} — ${topo.etiqueta}</label>`;
    });
    html += `</div>`;
  } else { // categorico (activacion)
    const nombres = { relu:'ReLU', sigmoid:'Sigmoid', tanh:'Tanh', lineal:'Lineal', leaky_relu:'Leaky ReLU' };
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:11px">`;
    Object.entries(nombres).forEach(([val, lbl]) => {
      const checked = cfg.valores.includes(val) ? 'checked' : '';
      html += `<label><input type="checkbox" class="exp-h${num}-act-cb" value="${val}" ${checked}> ${lbl}</label>`;
    });
    html += `</div>`;
  }

  cont.innerHTML = html;

  // Eventos para controles continuos
  if (cfg.tipo === 'continuo') {
    const actualizar = () => {
      const mn  = parseFloat(document.getElementById(`exp-h${num}-min`)?.value) || cfg.min;
      const mx  = parseFloat(document.getElementById(`exp-h${num}-max`)?.value) || cfg.max;
      const ps  = parseInt(document.getElementById(`exp-h${num}-pasos`)?.value) || cfg.pasos;
      cfg.min   = mn; cfg.max = mx; cfg.pasos = ps;
      const esc = cfg.nombre === 'eta' ? 'log' : 'lineal';
      const vs  = _resolverValoresContinuos(mn, mx, ps, esc);
      const fmt = cfg.nombre === 'eta' ? v => v.toFixed(3) : v => v.toFixed(2);
      const disp = document.getElementById(`exp-h${num}-vals-display`);
      if (disp) disp.textContent = 'Valores: ' + vs.map(fmt).join(' · ');
      _expActualizarTotal();
    };
    ['change', 'input'].forEach(ev => {
      document.getElementById(`exp-h${num}-min`)?.addEventListener(ev, actualizar);
      document.getElementById(`exp-h${num}-max`)?.addEventListener(ev, actualizar);
      document.getElementById(`exp-h${num}-pasos`)?.addEventListener(ev, actualizar);
    });
    actualizar();
  }

  // Eventos para checkboxes ordinales
  if (cfg.tipo === 'ordinal') {
    const actualizarOrd = () => {
      const cbs = [...document.querySelectorAll(`.exp-h${num}-topo-cb:checked`)].map(c => c.value);
      if (cbs.length < 2) {
        notificar('Mínimo 2 topologías activas');
        // Revertir el último cambio buscando el checkbox no marcado
        document.querySelectorAll(`.exp-h${num}-topo-cb`).forEach(cb => {
          if (!cbs.includes(cb.value) && cfg.valores.includes(cb.value)) cb.checked = true;
        });
        return;
      }
      cfg.valores = cbs;
      _expActualizarTotal();
    };
    document.querySelectorAll(`.exp-h${num}-topo-cb`).forEach(cb =>
      cb.addEventListener('change', actualizarOrd));
  }

  // Eventos para checkboxes categóricos
  if (cfg.tipo === 'categorico') {
    const actualizarCat = () => {
      const cbs = [...document.querySelectorAll(`.exp-h${num}-act-cb:checked`)].map(c => c.value);
      if (cbs.length < 2) {
        notificar('Mínimo 2 funciones de activación activas');
        document.querySelectorAll(`.exp-h${num}-act-cb`).forEach(cb => {
          if (!cbs.includes(cb.value) && cfg.valores.includes(cb.value)) cb.checked = true;
        });
        return;
      }
      cfg.valores = cbs;
      _expActualizarTotal();
    };
    document.querySelectorAll(`.exp-h${num}-act-cb`).forEach(cb =>
      cb.addEventListener('change', actualizarCat));
  }
}

function _expActualizarTotal() {
  const n1 = expConfig.hiper1.tipo === 'continuo' ? (expConfig.hiper1.pasos || 4)
             : (expConfig.hiper1.valores?.length || 0);
  const n2 = expConfig.hiper2.tipo === 'continuo' ? (expConfig.hiper2.pasos || 4)
             : (expConfig.hiper2.valores?.length || 0);
  const total = n1 * n2;
  const disp  = document.getElementById('exp-total-display');
  if (disp) disp.textContent = total;

  const avisoDiv  = document.getElementById('exp-aviso-n');
  const btnConf   = document.getElementById('exp-btn-confirmar');
  const btnInic   = document.getElementById('exp-btn-iniciar');
  if (total > 25) {
    const segs = Math.round(total * expTiempoRefMs / 1000);
    avisoDiv.textContent  = `⚠ Este experimento entrenará ${total} modelos (~${segs}s estimados).`;
    avisoDiv.style.display = 'block';
    btnConf.style.display  = 'block';
    btnInic.style.display  = 'none';
  } else {
    avisoDiv.style.display = 'none';
    btnConf.style.display  = 'none';
    btnInic.style.display  = 'block';
  }
}

function _expClickIniciar() {
  _expSincronizarConfigDesdeDOM();
  lanzarExperimento();
}

function _expSincronizarConfigDesdeDOM() {
  const selEpocas = document.getElementById('select-epocas-exp');
  if (selEpocas) expConfig.maximoEpocas = parseInt(selEpocas.value) || 200;
  const semEl = document.getElementById('exp-semilla');
  if (semEl) expConfig.semillaPesos = parseInt(semEl.value) || 1;

  // Sincronizar valores actuales de checkboxes y min/max
  if (expConfig.hiper1.tipo === 'continuo') {
    const mn = parseFloat(document.getElementById('exp-h1-min')?.value);
    const mx = parseFloat(document.getElementById('exp-h1-max')?.value);
    const ps = parseInt(document.getElementById('exp-h1-pasos')?.value);
    if (isFinite(mn)) expConfig.hiper1.min  = mn;
    if (isFinite(mx)) expConfig.hiper1.max  = mx;
    if (ps)           expConfig.hiper1.pasos = ps;
  } else {
    expConfig.hiper1.valores = [...document.querySelectorAll('.exp-h1-topo-cb:checked, .exp-h1-act-cb:checked')].map(c => c.value);
  }
  if (expConfig.hiper2.tipo === 'continuo') {
    const mn = parseFloat(document.getElementById('exp-h2-min')?.value);
    const mx = parseFloat(document.getElementById('exp-h2-max')?.value);
    const ps = parseInt(document.getElementById('exp-h2-pasos')?.value);
    if (isFinite(mn)) expConfig.hiper2.min  = mn;
    if (isFinite(mx)) expConfig.hiper2.max  = mx;
    if (ps)           expConfig.hiper2.pasos = ps;
  } else {
    expConfig.hiper2.valores = [...document.querySelectorAll('.exp-h2-topo-cb:checked, .exp-h2-act-cb:checked')].map(c => c.value);
  }
}

function _expMostrarFaseConfigurando() {
  _expSetFase('config');
  if (_expSelectMetrica) _expSelectMetrica.style.display = 'none';
}

function _expMostrarFaseProgreso() {
  _expSetFase('progreso');
}

function _expMostrarFaseCompletado() {
  const comp    = expCola.filter(r => r.estado !== 'pendiente' && r.estado !== 'cancelado').length;
  const totalMs = expCola.reduce((s, r) => s + (r.metricas?.tiempo_ms || 0), 0);
  const mins    = Math.floor(totalMs / 60000);
  const segs    = Math.round((totalMs % 60000) / 1000);
  const tiempoStr = mins > 0 ? `${mins}m ${segs}s` : `${segs}s`;
  const div = document.getElementById('exp-resumen-completado');
  if (div) div.textContent = `${comp} de ${expTotal} modelos entrenados en ${tiempoStr}.`;
  _expSetFase('completado');
}

function _expMostrarFaseCancelado() {
  const comp = expCola.filter(r => ['convergido','max_epocas','divergente','nan'].includes(r.estado)).length;
  const div = document.getElementById('exp-resumen-cancelado');
  if (div) div.textContent = `${comp} de ${expTotal} modelos completados antes de cancelar.`;
  _expSetFase('cancelado');
}

function _expSetFase(fase) {
  ['config','progreso','completado','cancelado'].forEach(f => {
    const el = document.getElementById(`exp-fase-${f}`);
    if (el) el.style.display = f === fase ? 'block' : 'none';
  });
}

function _expActualizarBotonesProgreso() {
  const btn = document.getElementById('exp-btn-pausa');
  if (btn) btn.textContent = expEstado === 'PAUSADO' ? 'Reanudar' : 'Pausar';
}

function actualizarUIProgreso() {
  if (expEstado !== 'EJECUTANDO' && expEstado !== 'PAUSADO') return;

  _expActualizarBotonesProgreso();

  const completados = expCola.filter(r =>
    ['convergido','max_epocas','divergente','nan','cancelado'].includes(r.estado)).length;
  const pct = expTotal > 0 ? (completados / expTotal) * 100 : 0;

  const barra = document.getElementById('exp-barra-prog');
  if (barra) barra.style.width = pct.toFixed(1) + '%';

  const textoP = document.getElementById('exp-texto-prog');
  if (textoP) textoP.textContent = `${completados} / ${expTotal} modelos`;

  const enCursoEl = document.getElementById('exp-en-curso');
  if (enCursoEl) {
    if (expRunActual < expTotal) {
      const run = expCola[expRunActual];
      if (run) {
        const h1v = _expFormatarValor(run.hiper1.nombre, run.hiper1.valor);
        const h2v = _expFormatarValor(run.hiper2.nombre, run.hiper2.valor);
        const ep  = run.historial.length;
        enCursoEl.textContent = `${h1v} · ${h2v} → época ${ep} / ${expConfig.maximoEpocas}`;
      }
    } else {
      enCursoEl.textContent = '—';
    }
  }

  const statsEl = document.getElementById('exp-stats-prog');
  if (statsEl) {
    const conv   = expCola.filter(r => r.estado === 'convergido').length;
    const div_   = expCola.filter(r => r.estado === 'divergente').length;
    const maxep  = expCola.filter(r => r.estado === 'max_epocas').length;
    const pend   = expCola.filter(r => r.estado === 'pendiente').length;
    statsEl.innerHTML =
      `✓ convergidos: ${conv}<br>✗ divergentes: ${div_}<br>— max épocas: ${maxep}<br>⏳ pendientes: ${pend}`;
  }
}

function _expFormatarValor(nombre, valor) {
  if (nombre === 'eta')       return `η=${typeof valor === 'number' ? valor.toFixed(3) : valor}`;
  if (nombre === 'momentum')  return `β=${typeof valor === 'number' ? valor.toFixed(2) : valor}`;
  if (nombre === 'topologia') return typeof valor === 'string' ? valor : valor.id;
  if (nombre === 'activacion') return valor;
  return String(valor);
}

function actualizarUIEstadoExperimento() {
  // El módulo experimento gestiona su propio estado; no interfiere con los botones globales
}

function _expNuevoExperimento() {
  expGrilla             = [];
  expCola               = [];
  expRunActual          = 0;
  expTotal              = 0;
  expHover              = null;
  expSel                = null;
  expSelFila            = null;
  expSelColumna         = null;
  expCompletadosUltimoPaleta = -1;
  _expModeloActivoIdx   = null;
  expEstado             = 'CONFIGURANDO';
  _expMostrarFaseConfigurando();
}

function exportarCSV() {
  const runsCompletos = expCola.filter(r =>
    ['convergido','max_epocas','divergente','nan'].includes(r.estado));
  if (runsCompletos.length === 0) {
    notificar('No hay runs completados para exportar');
    return;
  }

  const ahora   = new Date();
  const fecha   = ahora.toISOString().slice(0,10);
  const horaMin = ahora.toTimeString().slice(0,8);
  const tiempoTotal = expCola.reduce((s, r) => s + (r.metricas?.tiempo_ms || 0), 0);

  const h1n = expConfig.hiper1.nombre;
  const h2n = expConfig.hiper2.nombre;

  let csv = `# TalleRNA — Experimento Factorial\n`;
  csv += `# Versión: 1.1\n`;
  csv += `# Fecha: ${fecha} ${horaMin}\n`;
  csv += `# Problema: ${problema}   Ruido: ${nivelRuido}%   Train: ${Math.round(trainRatio*100)}%\n`;
  csv += `# Semilla pesos: ${expConfig.semillaPesos}   (misma para todos los modelos)\n`;
  csv += `# Hiper 1: ${h1n}   tipo: ${expConfig.hiper1.tipo}\n`;
  csv += `# Hiper 2: ${h2n}   tipo: ${expConfig.hiper2.tipo}\n`;
  csv += `# Total modelos: ${expTotal}   Épocas máx.: ${expConfig.maximoEpocas}\n`;
  csv += `# Tiempo total: ${Math.round(tiempoTotal)} ms\n`;
  csv += `#\n`;
  csv += `${h1n},${h2n},J_train,J_test,${esTipoClasif ? 'accuracy,' : ''}epocas,gap,estado,tiempo_ms\n`;

  for (const run of expCola) {
    const v1 = _expSerializarValor(h1n, run.hiper1.valor);
    const v2 = _expSerializarValor(h2n, run.hiper2.valor);
    const m  = run.metricas;
    const tieneMetricas = m && m.J_train != null;
    const jTrain  = tieneMetricas ? m.J_train.toFixed(4)   : '';
    const jTest   = tieneMetricas ? m.J_test.toFixed(4)    : '';
    const acc     = esTipoClasif ? (tieneMetricas && m.accuracy != null ? m.accuracy.toFixed(1) : '') : '';
    const epocas  = tieneMetricas ? m.epocas : '';
    const gap     = tieneMetricas && m.gap != null ? m.gap.toFixed(4) : '';
    const tms     = tieneMetricas && m.tiempo_ms != null ? Math.round(m.tiempo_ms) : '';
    const fila    = esTipoClasif
      ? `${v1},${v2},${jTrain},${jTest},${acc},${epocas},${gap},${run.estado},${tms}`
      : `${v1},${v2},${jTrain},${jTest},${epocas},${gap},${run.estado},${tms}`;
    csv += fila + '\n';
  }

  const yyyymmdd = ahora.toISOString().slice(0,10).replace(/-/g,'');
  const hhmm     = ahora.toTimeString().slice(0,5).replace(':','');
  const nombre   = `tallerna_${h1n}-${h2n}_${yyyymmdd}-${hhmm}.csv`;
  const blob     = new Blob([csv], { type: 'text/csv' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function _expSerializarValor(nombre, valor) {
  if (nombre === 'eta' || nombre === 'momentum') return typeof valor === 'number' ? valor.toFixed(4) : valor;
  if (nombre === 'topologia') return typeof valor === 'string' ? valor : valor.id;
  return String(valor);
}

// ── 4. VISUALIZACIÓN (p5.js) ──────────────────────────────────────────────────

// Paleta Viridis: 5 puntos de control [[R,G,B], ...]
const EXP_VIRIDIS = [
  [68,  1,   84],
  [59,  82,  139],
  [33,  145, 140],
  [94,  201, 98],
  [253, 231, 37]
];

function _expViridis(t) {
  const n  = EXP_VIRIDIS.length - 1;
  const ti = Math.max(0, Math.min(1, t)) * n;
  const lo = Math.floor(ti);
  const hi = Math.min(lo + 1, n);
  const f  = ti - lo;
  const a  = EXP_VIRIDIS[lo];
  const b  = EXP_VIRIDIS[hi];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f)
  ];
}

function _expColorRun(run) {
  const i = run.coordenada.i;
  const j = run.coordenada.j;
  const n1 = expConfig.hiper1.valores.length;
  const n2 = expConfig.hiper2.valores.length;

  if (expConfig.hiper1.tipo === 'categorico') {
    const clave = expConfig.hiper1.valores[i];
    return PALETAS.activacion[clave] || color(150);
  }
  if (expConfig.hiper2.tipo === 'categorico') {
    const clave = expConfig.hiper2.valores[j];
    return PALETAS.activacion[clave] || color(150);
  }
  if (expConfig.hiper1.tipo === 'ordinal') {
    const id = expConfig.hiper1.valores[i];
    return color(PALETAS.topologia[id] || '#888');
  }
  if (expConfig.hiper2.tipo === 'ordinal') {
    const id = expConfig.hiper2.valores[j];
    return color(PALETAS.topologia[id] || '#888');
  }
  // continuo × continuo: gradiente por posición en grilla
  const t = n1 > 1 ? i / (n1 - 1) : 0.5;
  const rgb = _expViridis(t);
  return color(rgb[0], rgb[1], rgb[2]);
}

function dibujarControlesExperimento(r3) {
  // Panel 3 p5.js: solo se usa para posicionar el overlay DOM
  _expPosicionarSelectorMetrica();
}

function dibujarHeatmapPanel4() {
  if (expGrilla.length === 0 || expEstado === 'CONFIGURANDO') {
    const r4 = panelRect(4);
    fill(120); noStroke(); textSize(12); textAlign(CENTER, CENTER);
    text('Configura y lanza un experimento', r4.x + r4.w / 2, r4.y + r4.h / 2);
    return;
  }

  _expPosicionarSelectorMetrica();

  if (expUsaBarras) {
    dibujarBarrasAgrupadasPanel4();
    return;
  }

  const r4  = panelRect(4);
  const PAD_L = 52, PAD_T = 50, PAD_R = 16, PAD_B = 16;
  const plotX = r4.x + PAD_L;
  const plotY = r4.y + PAD_T;
  const plotW = r4.w - PAD_L - PAD_R;
  const plotH = r4.h - PAD_T - PAD_B;

  const n1 = expGrilla.length;
  const n2 = n1 > 0 ? expGrilla[0].length : 0;
  if (n1 === 0 || n2 === 0) return;

  const cW = plotW / n2;
  const cH = plotH / n1;

  // Recalcular escala de paleta si hay runs nuevos
  if (expRunActual !== expCompletadosUltimoPaleta) {
    _expRecalcularPaleta();
    expCompletadosUltimoPaleta = expRunActual;
  }

  // Dibujar celdas
  for (let i = 0; i < n1; i++) {
    for (let j = 0; j < n2; j++) {
      const run = expGrilla[i][j];
      const cx  = plotX + j * cW;
      const cy  = plotY + i * cH;
      _expDibujarCelda(run, cx, cy, cW, cH);
    }
  }

  // Etiquetas eje Y (hiper1) — izquierda
  noStroke(); fill(60); textSize(10); textAlign(RIGHT, CENTER);
  for (let i = 0; i < n1; i++) {
    const v   = expConfig.hiper1.valores[i];
    const lbl = _expEtiquetarValor(expConfig.hiper1.nombre, v);
    text(lbl, plotX - 4, plotY + (i + 0.5) * cH);
  }

  // Etiquetas eje X (hiper2) — arriba
  textAlign(CENTER, BOTTOM);
  for (let j = 0; j < n2; j++) {
    const v   = expConfig.hiper2.valores[j];
    const lbl = _expEtiquetarValor(expConfig.hiper2.nombre, v);
    const cx  = plotX + (j + 0.5) * cW;
    // Detectar click en etiqueta eje X
    text(lbl, cx, plotY - 4);
  }

  // Título eje Y
  push(); translate(r4.x + 10, plotY + plotH / 2); rotate(-HALF_PI);
  fill(80); noStroke(); textSize(10); textAlign(CENTER, CENTER);
  const labelH1 = { eta:'η', momentum:'β', topologia:'Topología', activacion:'Activación' };
  text(labelH1[expConfig.hiper1.nombre] || expConfig.hiper1.nombre, 0, 0);
  pop();

  // Título eje X
  fill(80); noStroke(); textSize(10); textAlign(CENTER, TOP);
  const labelH2 = { eta:'η', momentum:'β', topologia:'Topología', activacion:'Activación' };
  text(labelH2[expConfig.hiper2.nombre] || expConfig.hiper2.nombre, plotX + plotW / 2, r4.y + 30);

  // Tooltip
  if (expHover) {
    const run = expGrilla[expHover.i]?.[expHover.j];
    if (run && run.estado !== 'pendiente') {
      _expDibujarTooltip(run, plotX, plotY, plotW, plotH, cW, cH);
    }
  }
}

function _expDibujarCelda(run, cx, cy, cW, cH) {
  const m  = run.metricas;
  const isHov = expHover && expHover.i === run.coordenada.i && expHover.j === run.coordenada.j;
  const isSel = expSel   && expSel.i   === run.coordenada.i && expSel.j   === run.coordenada.j;
  const isFilSel = expSelFila    !== null && expSelFila    === run.coordenada.i;
  const isColSel = expSelColumna !== null && expSelColumna === run.coordenada.j;

  rectMode(CORNER);

  if (run.estado === 'pendiente') {
    fill('#e8e8e8'); noStroke();
    rect(cx, cy, cW, cH);
  } else if (run.estado === 'entrenando') {
    fill('#c8c8c8'); noStroke();
    rect(cx, cy, cW, cH);
    // Barra de progreso interna
    const pct = expConfig.maximoEpocas > 0
      ? run.historial.length / expConfig.maximoEpocas : 0;
    fill('#4a90d9'); noStroke();
    rect(cx, cy + cH - 4, cW * pct, 4);
  } else if (run.estado === 'cancelado') {
    fill('#b0b0b0'); noStroke();
    rect(cx, cy, cW, cH);
  } else if (run.estado === 'nan') {
    fill('#202020'); noStroke();
    rect(cx, cy, cW, cH);
    fill(255); noStroke(); textSize(12); textAlign(CENTER, CENTER);
    text('∅', cx + cW / 2, cy + cH / 2);
  } else if (run.estado === 'divergente') {
    fill('#808080'); noStroke();
    rect(cx, cy, cW, cH);
    // Rayas diagonales
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(cx, cy, cW, cH);
    drawingContext.clip();
    stroke('#909090'); strokeWeight(1);
    const paso = 5;
    for (let d = -cH; d < cW + cH; d += paso) {
      line(cx + d, cy, cx + d + cH, cy + cH);
    }
    drawingContext.restore();
  } else {
    // Estado terminal con métricas: color viridis
    const val = _expObtenerMetrica(run);
    let t;
    if (val !== null && _expPaletaMax > _expPaletaMin) {
      t = (val - _expPaletaMin) / (_expPaletaMax - _expPaletaMin);
      if (expMetrica !== 'accuracy') t = 1 - t; // menor es mejor
    } else {
      t = 0.5;
    }
    const [r, g, b] = _expViridis(t);
    fill(r, g, b); noStroke();
    rect(cx, cy, cW, cH);

    // Borde punteado para max_epocas
    if (run.estado === 'max_epocas') {
      noFill();
      drawingContext.setLineDash([3, 3]);
      stroke('#555'); strokeWeight(1.5);
      rect(cx, cy, cW, cH);
      drawingContext.setLineDash([]);
    }
  }

  // Bordes de selección
  noFill();
  if (isSel) { stroke('#2255aa'); strokeWeight(2.5); rect(cx, cy, cW, cH); }
  else if (isHov) { stroke('#2255aa'); strokeWeight(2.0); rect(cx, cy, cW, cH); }
  else if (isFilSel || isColSel) { stroke('#2255aa'); strokeWeight(1.5); rect(cx, cy, cW, cH); }
}

function _expObtenerMetrica(run) {
  if (!run.metricas) return null;
  const m = run.metricas;
  if (expMetrica === 'J_test')    return m.J_test;
  if (expMetrica === 'J_train')   return m.J_train;
  if (expMetrica === 'accuracy')  return m.accuracy;
  if (expMetrica === 'epocas')    return m.epocas;
  if (expMetrica === 'gap')       return m.gap;
  return null;
}

function _expRecalcularPaleta() {
  let vMin = Infinity, vMax = -Infinity;
  for (const run of expCola) {
    if (!['convergido','max_epocas'].includes(run.estado)) continue;
    const v = _expObtenerMetrica(run);
    if (v === null || !isFinite(v)) continue;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  if (!isFinite(vMin)) { _expPaletaMin = 0; _expPaletaMax = 1; return; }
  if (vMin === vMax)   { _expPaletaMin = vMin * 0.9; _expPaletaMax = vMax * 1.1 || 1; return; }
  _expPaletaMin = vMin;
  _expPaletaMax = vMax;
}

function _expEtiquetarValor(nombre, valor) {
  if (nombre === 'eta')       return typeof valor === 'number' ? valor.toFixed(3) : String(valor);
  if (nombre === 'momentum')  return typeof valor === 'number' ? valor.toFixed(2) : String(valor);
  if (nombre === 'topologia') return typeof valor === 'string' ? valor : valor.id;
  if (nombre === 'activacion') {
    const map = { relu:'ReLU', sigmoid:'Sig', tanh:'Tanh', lineal:'Lin', leaky_relu:'LReLU' };
    return map[valor] || valor;
  }
  return String(valor);
}

function _expDibujarTooltip(run, plotX, plotY, plotW, plotH, cW, cH) {
  const i = run.coordenada.i;
  const j = run.coordenada.j;
  const m = run.metricas;

  const lineas = [
    `${_expFormatarValor(run.hiper1.nombre, run.hiper1.valor)} · ${_expFormatarValor(run.hiper2.nombre, run.hiper2.valor)}`,
    `J_test:  ${m.J_test   != null ? m.J_test.toFixed(4)   : '—'}`,
    `J_train: ${m.J_train  != null ? m.J_train.toFixed(4)  : '—'}`,
    `Gap:     ${m.gap      != null ? m.gap.toFixed(4)      : '—'}`,
  ];
  if (esTipoClasif)
    lineas.push(`Acc:     ${m.accuracy != null ? m.accuracy.toFixed(1) + '%' : '—'}`);
  lineas.push(
    `Épocas:  ${m.epocas  != null ? m.epocas : '—'}`,
    `Estado:  ${run.estado}`,
    `Tiempo:  ${m.tiempo_ms != null ? Math.round(m.tiempo_ms) + ' ms' : '—'}`
  );

  const TW = 140, TH = lineas.length * 14 + 10;
  const cellX = plotX + j * cW;
  const cellY = plotY + i * cH;
  let tx = cellX + cW + 4;
  if (tx + TW > plotX + plotW) tx = cellX - TW - 4;
  const ty = constrain(cellY, plotY, plotY + plotH - TH);

  fill(30, 30, 30, 220); noStroke();
  rect(tx, ty, TW, TH, 3);
  fill(255); noStroke(); textSize(10); textAlign(LEFT, TOP);
  lineas.forEach((l, idx) => text(l, tx + 5, ty + 5 + idx * 14));
}

function dibujarBarrasAgrupadasPanel4() {
  const r4 = panelRect(4);
  const PAD_L = 40, PAD_T = 50, PAD_R = 10, PAD_B = 30;
  const plotX = r4.x + PAD_L;
  const plotY = r4.y + PAD_T;
  const plotW = r4.w - PAD_L - PAD_R;
  const plotH = r4.h - PAD_T - PAD_B;

  // Determinar qué eje es categórico
  const catEje = expConfig.hiper1.tipo === 'categorico' ? 1 : 2;
  const numEje = catEje === 1 ? 2 : 1;
  const catCfg = catEje === 1 ? expConfig.hiper1 : expConfig.hiper2;
  const numCfg = catEje === 1 ? expConfig.hiper2 : expConfig.hiper1;

  const cats = catCfg.valores;
  const nums = numCfg.valores;
  if (cats.length === 0 || nums.length === 0) return;

  // Calcular rango Y
  let yMax = 0;
  for (const run of expCola) {
    const v = _expObtenerMetrica(run);
    if (v != null && isFinite(v) && v > yMax) yMax = v;
  }
  if (yMax === 0) yMax = 1;
  yMax *= 1.05;

  const grupoW  = plotW / nums.length;
  const barW    = grupoW / (cats.length + 1);
  const GAP_GRP = barW * 0.5;

  // Eje Y
  stroke(180); strokeWeight(1);
  line(plotX, plotY, plotX, plotY + plotH);
  for (let i = 0; i <= 4; i++) {
    const y   = plotY + plotH - (i / 4) * plotH;
    const val = (i / 4) * yMax;
    stroke(220); strokeWeight(0.5);
    line(plotX, y, plotX + plotW, y);
    noStroke(); fill(100); textSize(9); textAlign(RIGHT, CENTER);
    text(val.toFixed(3), plotX - 3, y);
  }

  // Barras
  for (let ni = 0; ni < nums.length; ni++) {
    const gx = plotX + ni * grupoW + GAP_GRP / 2;
    for (let ci = 0; ci < cats.length; ci++) {
      // Encontrar el run correspondiente
      let run = null;
      if (catEje === 1) run = expGrilla[ci]?.[ni];
      else              run = expGrilla[ni]?.[ci];
      if (!run) continue;

      const bx = gx + ci * barW;
      const bh = (() => {
        const v = _expObtenerMetrica(run);
        if (v == null || !isFinite(v)) return 4;
        return (v / yMax) * plotH;
      })();
      const by = plotY + plotH - bh;

      let c;
      if (run.estado === 'divergente' || run.estado === 'nan') {
        c = color('#E24B4A');
      } else {
        const clave = cats[ci];
        c = PALETAS.activacion?.[clave] || color(150);
      }
      fill(c); noStroke();
      rect(bx, by, barW - 1, bh);
    }
    // Etiqueta eje X
    noStroke(); fill(80); textSize(9); textAlign(CENTER, TOP);
    const vNum = nums[ni];
    text(_expEtiquetarValor(numCfg.nombre, vNum), gx + (cats.length * barW) / 2, plotY + plotH + 4);
  }

  // Leyenda categorías — alineada a la derecha del plot para no colisionar con el selector
  fill(80); noStroke(); textSize(9); textAlign(LEFT, CENTER);
  const legItemW = 55;
  const lx0 = plotX + plotW - cats.length * legItemW;
  const ly0 = r4.y + 32;
  cats.forEach((cat, ci) => {
    const c = PALETAS.activacion?.[cat] || color(150);
    fill(c); noStroke();
    rect(lx0 + ci * legItemW, ly0 - 6, 10, 10);
    fill(60); noStroke();
    text(_expEtiquetarValor(catCfg.nombre, cat), lx0 + ci * legItemW + 12, ly0);
  });
}

function dibujarFronterasExperimentoPanel1() {
  if (expGrilla.length === 0) return;
  if (!esTipoClasif) { _expDibujarCurvasRegresionExperimento(); return; }

  // Determinar run activo
  const runActivo = _expRunActivo();

  // Actualizar mapa de fondo si cambió el run activo
  if (runActivo && _expModeloActivoIdx !== _expIdxRun(runActivo)) {
    _expModeloActivoIdx = _expIdxRun(runActivo);
    if (runActivo.modelo) {
      if (!runActivo.modelo.frontera) runActivo.modelo.frontera = calcularFronteraModelo(runActivo.modelo);
      renderizarMapa(runActivo.modelo);
    }
  }

  noFill();
  for (const run of expCola) {
    if (!run.modelo || !run.modelo.frontera || run.modelo.frontera.length === 0) continue;

    const esActivo  = runActivo && _expIdxRun(run) === _expIdxRun(runActivo);
    const esVecino  = runActivo && _expEsVecinoInmediato(run, runActivo);
    const esFilaSel = expSelFila !== null && run.coordenada.i === expSelFila;
    const esColSel  = expSelColumna !== null && run.coordenada.j === expSelColumna;

    let grosor, alfa;
    if (esActivo)          { grosor = 2.5; alfa = 255; }
    else if (esVecino)     { grosor = 1.0; alfa = 76;  }
    else if (esFilaSel || esColSel) { grosor = 1.5; alfa = 128; }
    else                   continue;

    const c = _expColorRun(run);
    stroke(red(c), green(c), blue(c), alfa);
    strokeWeight(grosor);
    for (const pt of run.modelo.frontera) {
      const { px, py } = dataToPanel1(pt.x1, pt.x2);
      point(px, py);
    }
  }
}

function _expDibujarCurvasRegresionExperimento() {
  const p = _panel1PlotArea();
  const { yMin, yMax } = _rangoRegresion();
  const rango = yMax - yMin || 1;

  const runActivo = _expRunActivo();
  if (runActivo && _expModeloActivoIdx !== _expIdxRun(runActivo)) {
    _expModeloActivoIdx = _expIdxRun(runActivo);
    if (runActivo.modelo) {
      if (!runActivo.modelo.frontera) runActivo.modelo.frontera = calcularFronteraModelo(runActivo.modelo);
      renderizarMapa(runActivo.modelo);
    }
  }

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(p.x, p.y, p.w, p.h);
  drawingContext.clip();

  for (const run of expCola) {
    if (!run.modelo || !run.modelo.frontera || run.modelo.frontera.length === 0) continue;
    const esActivo = runActivo && _expIdxRun(run) === _expIdxRun(runActivo);
    const esVecino = runActivo && _expEsVecinoInmediato(run, runActivo);
    const esFilaSel = expSelFila !== null && run.coordenada.i === expSelFila;
    const esColSel  = expSelColumna !== null && run.coordenada.j === expSelColumna;

    let grosor, alfa;
    if (esActivo)                   { grosor = 2.5; alfa = 255; }
    else if (esVecino)              { grosor = 1.0; alfa = 76;  }
    else if (esFilaSel || esColSel) { grosor = 1.5; alfa = 128; }
    else continue;

    const c = _expColorRun(run);
    stroke(red(c), green(c), blue(c), alfa);
    strokeWeight(grosor); noFill();
    beginShape();
    for (const pt of run.modelo.frontera) {
      const px = p.x + (pt.x1 + 1) / 2 * p.w;
      const py = p.y + (1 - (pt.yhat - yMin) / rango) * p.h;
      vertex(px, py);
    }
    endShape();
  }
  drawingContext.restore();
}

function _expRunActivo() {
  if (expHover) return expGrilla[expHover.i]?.[expHover.j] || null;
  if (expSel)   return expGrilla[expSel.i]?.[expSel.j]     || null;
  // Menor J_test entre completados
  let mejorRun = null, mejorJ = Infinity;
  for (const run of expCola) {
    if (!['convergido','max_epocas'].includes(run.estado)) continue;
    if (run.metricas?.J_test != null && run.metricas.J_test < mejorJ) {
      mejorJ = run.metricas.J_test; mejorRun = run;
    }
  }
  return mejorRun;
}

function _expIdxRun(run) {
  return run.coordenada.i * 1000 + run.coordenada.j;
}

function _expEsVecinoInmediato(run, ref) {
  const di = Math.abs(run.coordenada.i - ref.coordenada.i);
  const dj = Math.abs(run.coordenada.j - ref.coordenada.j);
  return (di === 1 && dj === 0) || (di === 0 && dj === 1);
}

function dibujarCurvasExperimentoPanel2() {
  const r    = panelRect(2);
  const plot = _panel2PlotArea();

  noStroke(); fill(250);
  rect(plot.x, plot.y, plot.w, plot.h);

  // Sin selección — texto orientativo
  if (!expHover && !expSel && expSelFila === null && expSelColumna === null) {
    fill(160); noStroke(); textSize(11); textAlign(CENTER, CENTER);
    text('Selecciona una celda', plot.x + plot.w / 2, plot.y + plot.h / 2);
    _dibujarTogglesPanel2(r, plot);
    return;
  }

  // Determinar qué runs mostrar
  let runsVis = [];
  if (expHover) {
    const r1 = expGrilla[expHover.i]?.[expHover.j];
    if (r1) runsVis = [r1];
  } else if (expSel) {
    const r1 = expGrilla[expSel.i]?.[expSel.j];
    if (r1) runsVis = [r1];
  } else if (expSelFila !== null) {
    runsVis = (expGrilla[expSelFila] || []).filter(r => r);
  } else if (expSelColumna !== null) {
    runsVis = expGrilla.map(fila => fila[expSelColumna]).filter(r => r);
  }

  const runsConHistorial = runsVis.filter(r => r.modelo?.historial && r.modelo.historial.length >= 2);
  if (runsConHistorial.length === 0) {
    fill(160); noStroke(); textSize(11); textAlign(CENTER, CENTER);
    text('Sin datos aún', plot.x + plot.w / 2, plot.y + plot.h / 2);
    _dibujarTogglesPanel2(r, plot);
    return;
  }

  // Calcular xMax
  const xMax = Math.max(...runsConHistorial.map(r => r.modelo.historial.length)) * 1.08;

  // Calcular rango Y
  let yMin = Infinity, yMax2 = -Infinity;
  for (const run of runsConHistorial) {
    for (const h of run.modelo.historial) {
      if (h.J_train !== undefined && isFinite(h.J_train)) {
        if (h.J_train < yMin) yMin = h.J_train;
        if (h.J_train > yMax2) yMax2 = h.J_train;
      }
      if (mostrarCurvasTest && h.J_test !== undefined && isFinite(h.J_test)) {
        if (h.J_test < yMin) yMin = h.J_test;
        if (h.J_test > yMax2) yMax2 = h.J_test;
      }
    }
  }
  if (!isFinite(yMin)) { yMin = 0; yMax2 = 1; }
  const yMargen = (yMax2 - yMin) * 0.05 || 0.01;
  yMin  = Math.max(0, yMin - yMargen);
  yMax2 = yMax2 + yMargen;

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
          i * (Math.log10(Math.max(yMax2, 1e-8)) - Math.log10(Math.max(yMin, 1e-8))) / 5)
      : yMin + (yMax2 - yMin) * i / 5;
    const ty   = _valToY(val, plot, yMin, yMax2);
    const etiq = (val === 0) ? '0' : val < 0.01 ? val.toExponential(1) : val.toFixed(3);
    text(etiq, plot.x - 3, ty);
  }

  // Etiquetas eje X
  const _xNiceExp = (xM) => {
    const crudo = xM / 6;
    const mag   = Math.pow(10, Math.floor(Math.log10(Math.max(crudo, 1))));
    const r     = crudo / mag;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
  };
  const intervalo = _xNiceExp(xMax);
  noStroke(); fill(120); textSize(11); textAlign(CENTER, TOP);
  for (let ep = 0; ep <= xMax; ep += intervalo)
    text(Math.round(ep), _epToX(ep, xMax, plot), plot.y + plot.h + 3);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(plot.x, plot.y, plot.w, plot.h);
  drawingContext.clip();

  for (const run of runsConHistorial) {
    const c = _expColorRun(run);
    stroke(red(c), green(c), blue(c), 200); strokeWeight(1.5); noFill();
    beginShape();
    for (let ep = 0; ep < run.modelo.historial.length; ep++) {
      const val = run.modelo.historial[ep].J_train;
      if (val === undefined || val === null) continue;
      vertex(_epToX(ep, xMax, plot), _valToY(val, plot, yMin, yMax2));
    }
    endShape();

    if (mostrarCurvasTest) {
      stroke(red(c), green(c), blue(c), 100); strokeWeight(1); noFill();
      drawingContext.setLineDash([3, 3]);
      beginShape();
      for (let ep = 0; ep < run.modelo.historial.length; ep++) {
        const val = run.modelo.historial[ep].J_test;
        if (val === undefined || val === null) continue;
        vertex(_epToX(ep, xMax, plot), _valToY(val, plot, yMin, yMax2));
      }
      endShape();
      drawingContext.setLineDash([]);
    }
  }

  drawingContext.restore();

  // Métricas del run seleccionado — texto fijo en Panel 2
  if (expSel) {
    const runSel = expGrilla[expSel.i]?.[expSel.j];
    if (runSel && runSel.estado !== 'pendiente' && runSel.metricas) {
      const m   = runSel.metricas;
      const h1v = _expFormatarValor(runSel.hiper1.nombre, runSel.hiper1.valor);
      const h2v = _expFormatarValor(runSel.hiper2.nombre, runSel.hiper2.valor);
      const lineas = [
        `${h1v} · ${h2v}`,
        `J_train: ${m.J_train  != null ? m.J_train.toFixed(4)  : '—'}`,
        `J_test:  ${m.J_test   != null ? m.J_test.toFixed(4)   : '—'}`,
        `Gap:     ${m.gap      != null ? m.gap.toFixed(4)      : '—'}`,
      ];
      if (esTipoClasif)
        lineas.push(`Acc:     ${m.accuracy != null ? m.accuracy.toFixed(1) + '%' : '—'}`);
      lineas.push(
        `Épocas:  ${m.epocas != null ? m.epocas : '—'}`,
        `Estado:  ${runSel.estado}`
      );
      noStroke(); fill(80); textSize(10); textAlign(RIGHT, TOP);
      lineas.forEach((l, idx) => text(l, plot.x + plot.w - 4, plot.y + 5 + idx * 13));
    }
  }

  _dibujarTogglesPanel2(r, plot);
}

// ── Interacción heatmap (llamadas desde eventos.js) ──────────────────────────

function _expHitTestHeatmap(mx, my) {
  if (expGrilla.length === 0) return null;
  const r4    = panelRect(4);
  const PAD_L = 52, PAD_T = 50, PAD_R = 16, PAD_B = 16;
  const plotX = r4.x + PAD_L;
  const plotY = r4.y + PAD_T;
  const plotW = r4.w - PAD_L - PAD_R;
  const plotH = r4.h - PAD_T - PAD_B;
  const n1    = expGrilla.length;
  const n2    = expGrilla[0].length;
  const cW    = plotW / n2;
  const cH    = plotH / n1;

  if (mx < plotX || mx > plotX + plotW || my < plotY || my > plotY + plotH) {
    // Revisar etiquetas eje Y
    for (let i = 0; i < n1; i++) {
      const cy = plotY + (i + 0.5) * cH;
      if (Math.abs(my - cy) < cH / 2 && mx < plotX && mx > r4.x)
        return { tipo:'fila', i };
    }
    // Revisar etiquetas eje X
    for (let j = 0; j < n2; j++) {
      const cx = plotX + (j + 0.5) * cW;
      if (Math.abs(mx - cx) < cW / 2 && my < plotY && my > r4.y)
        return { tipo:'columna', j };
    }
    return { tipo:'fuera' };
  }

  const j = Math.floor((mx - plotX) / cW);
  const i = Math.floor((my - plotY) / cH);
  if (i >= 0 && i < n1 && j >= 0 && j < n2)
    return { tipo:'celda', i, j };
  return { tipo:'fuera' };
}

function _expHitTestBarras(mx, my) {
  if (expGrilla.length === 0) return { tipo: 'fuera' };

  const r4 = panelRect(4);
  const PAD_L = 40, PAD_T = 50, PAD_R = 10, PAD_B = 30;
  const plotX = r4.x + PAD_L;
  const plotY = r4.y + PAD_T;
  const plotW = r4.w - PAD_L - PAD_R;
  const plotH = r4.h - PAD_T - PAD_B;

  if (mx < plotX || mx > plotX + plotW || my < plotY || my > plotY + plotH)
    return { tipo: 'fuera' };

  const catEje  = expConfig.hiper1.tipo === 'categorico' ? 1 : 2;
  const catCfg  = catEje === 1 ? expConfig.hiper1 : expConfig.hiper2;
  const numCfg  = catEje === 1 ? expConfig.hiper2 : expConfig.hiper1;
  const cats    = catCfg.valores;
  const nums    = numCfg.valores;
  if (cats.length === 0 || nums.length === 0) return { tipo: 'fuera' };

  const grupoW  = plotW / nums.length;
  const barW    = grupoW / (cats.length + 1);
  const GAP_GRP = barW * 0.5;

  for (let ni = 0; ni < nums.length; ni++) {
    const gx = plotX + ni * grupoW + GAP_GRP / 2;
    for (let ci = 0; ci < cats.length; ci++) {
      const bx = gx + ci * barW;
      if (mx >= bx && mx <= bx + barW - 1) {
        const i = catEje === 1 ? ci : ni;
        const j = catEje === 1 ? ni : ci;
        return { tipo: 'celda', i, j };
      }
    }
  }
  return { tipo: 'fuera' };
}

function expHandleMouseMoved(mx, my) {
  if (moduloActivo !== 'experimento') { expHover = null; return; }
  const hit = expUsaBarras ? _expHitTestBarras(mx, my) : _expHitTestHeatmap(mx, my);
  if (hit && hit.tipo === 'celda') expHover = { i: hit.i, j: hit.j };
  else expHover = null;
}

function expHandleMousePressed(mx, my) {
  if (moduloActivo !== 'experimento') return false;
  const r4 = panelRect(4);
  if (mx < r4.x || mx > r4.x + r4.w || my < r4.y || my > r4.y + r4.h) return false;

  const hit = expUsaBarras ? _expHitTestBarras(mx, my) : _expHitTestHeatmap(mx, my);
  if (!hit) return false;

  if (hit.tipo === 'celda') {
    expSel = { i: hit.i, j: hit.j };
    expSelFila = null; expSelColumna = null;
  } else if (hit.tipo === 'fila') {
    expSelFila = hit.i;
    expSel = null; expSelColumna = null;
  } else if (hit.tipo === 'columna') {
    expSelColumna = hit.j;
    expSel = null; expSelFila = null;
  } else {
    expSel = null; expSelFila = null; expSelColumna = null;
  }
  return true;
}

function _expMostrarFaseConfigurando() {
  _expSetFase('config');
  if (_expSelectMetrica) _expSelectMetrica.style.display = 'none';
}

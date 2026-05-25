// ============================================================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================================================

const TOOLBAR_HEIGHT = 40;
const TAB_HEIGHT = 32;
const BORDER_COLOR = '#cccccc';
const BORDER_WIDTH = 1;
const PANEL_BG = '#ffffff';

const VERTICAL_RATIO = 0.65; 
const HORIZONTAL_RATIO = 0.5; 

// ============================================================================
// PALETAS DE COLOR
// ============================================================================

let PALETAS = {};

function inicializarPaletas() {
  PALETAS.eta = {
    azulVioleta: color('#7B52D4'),
    naranja: color('#FF8C1A')
  };

  PALETAS.init = {
    uniforme: color('#378ADD'),
    normal: color('#1D9E75'),
    xavier: color('#BA7517'),
    he: color('#534AB7')
  };

  PALETAS.activacion = {
    relu: color('#185FA5'),
    sigmoid: color('#D85A30'),
    tanh: color('#1D9E75'),
    lineal: color('#888780'),
    leaky_relu: color('#534AB7'),
    elu:        color('#E67E22'),
    escalon:    color('#7F8C8D')
  };

  PALETAS.momentum = {
    azulClaro:     color('#57AFDB'),  // hsl(200,65%,60%)
    naranjaOscuro: color('#C65C10')   // hsl(25,85%,42%)
  };

  PALETAS.dropout = {
    naranjaOscuro: color('#B85A1A'),
    azul: color('#2277BB')
  };

  PALETAS.topologia = {
    T0: color('#888780'),
    T1: color('#B5D4F4'),
    T2: color('#6BAFDE'),
    T3: color('#378ADD'),
    T4: color('#C5DB8A'),
    T5: color('#97C459'),
    T6: color('#639922'),
    T7: color('#1D9E75')
  };
}

// ============================================================================
// VARIABLES GLOBALES 
// ============================================================================

let problema = 'lineal';
let nivelRuido = 0;
let trainRatio = 0.8;
let semillaDatos = 4721;
let esTipoClasif = true;

let datosTrain = [];
let datosTest = [];

let gfxMapa = null;
let modeloMapa = null;
let fronteraPrueba = [];
let moduloActivo = 'topologia';
let estado = 'IDLE';

let velocidad = 'normal';
let maximoEpocas = 500;
let mostrarCurvasTest = false;

let modelos = [];
let modeloReferencia = null;
let modeloSeleccionado = null;
let modeloHover = null;
let distribucionSeleccionada = null;
let _gruposHitAreas = [];

let notificacion = { texto: '', frameInicio: -200, duracion: 120 };

let fronteraUpdateIdx = 0;
let _epochTarget = null;
let _debounceEta = null;

let J_max_epoca0 = 1.0;
let modoLogPanel2 = false;
let modoAccPanel2 = false;

let interfaz = {
  controlesBarra: {
    problema: 'espiral', ruido: 0, train: 0.8, semilla: 4721
  },
  controlesModulo: {}
};

// Variables específicas del módulo ETA
let etaMinVal = 0.005;
let etaMaxVal = 0.500;

// Variables específicas del módulo INIT
const DISTRIBUCIONES = ['uniforme', 'normal', 'xavier', 'he'];
const COLORES_INIT = {
  uniforme: '#378ADD',
  normal:   '#1D9E75',
  xavier:   '#BA7517',
  he:       '#534AB7'
};
const OPACIDADES_INIT = [255, 166, 102];

let distActivas     = ['uniforme', 'normal', 'xavier', 'he'];
let semillasPorDist = 1;
let _debounceInit   = null;

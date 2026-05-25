/**
 * motor_ml.js
 * 
 * Este archivo contiene la implementación del motor de aprendizaje automático,
 * incluyendo generación de datos, normalización, arquitectura de red neuronal,
 * funciones de activación, entrenamiento y evaluación.
 * 
 * Se han implementado las funciones de activación ReLU, Sigmoid, Tanh, 
 * Lineal, Leaky y ReLU. La red neuronal es de tipo feedforward con una 
 * arquitectura definida por el usuario. El entrenamiento se realiza mediante 
 * backpropagation normalizado, es decir, se promedian los gradientes.
 * 
 * De otra forma: los pesos se actualizan empleando descenso por gradiente 
 * con momentum.
 * 
 * Por simplicidad no se usa librerías externas ni hiperparámetros como 
 * regularización o batch size, tal vez para cuando se discuta con la academia.
 * 
 * La topología por default es 2->4->1, con activación ReLU en la capa oculta 
 * y Sigmoid en la salida.
 * 
 * El código está estructurado para ser claro y educativo, con comentarios 
 * explicativos. Se han incluido mecanismos para detectar convergencia y 
 * divergencia durante el entrenamiento.
 */


// ============================================================================
// GENERACIÓN DE DATOS Y NORMALIZACIÓN 
// ============================================================================

/* 
 Generador Congruencial Lineal
 No uso random nativo para poder controlar la semilla y reproducibilidad
 Este se encuentra en https://en.wikipedia.org/wiki/Linear_congruential_generator
 */
class LCG { 
  constructor(seed) 
  {
    this.seed = seed >>> 0; 
    this.a = 1103515245;
    this.c = 12345;
    this.m = 2147483648; 
  }

  next() 
  {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m; 
  }

  /* Si no se usa Box-Muller, la otra opción sería usar la función de 
   distribución inversa de la normal, pero la complejidad temporal es mayor.
  */
  nextGaussian() // Box-Muller para los pesos y ruido gaussiano
  {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    return z;
  }
}

/* Los conjuntos de datos pretenden ilustrar diversidad de problemas de 
  clasificación, con formas no lineales y ruido.
- Espiral: Dos clases en forma de espiral entrelazada, el más difícil
- Círculos concéntricos: Una clase dentro de la otra, también no lineal.
- XOR: Cuatro cuadrantes con dos clases alternadas, clásico problema no lineal.
- Medialuna: Dos clases en forma de media luna enfrentada, otro caso no lineal.
- Seno: Regresión con ruido, para ilustrar un problema de predicción continua.

Las dos medias lunas no termina de convencerme, pero es un clásico. Otro que
podría agregarse es una sinusoide con ruido, para ilustrar un problema de 
regresión.

El nivel de ruido se ajusta para que sea visible pero no excesivo, permitiendo 
observar el efecto del mismo en el entrenamiento.
*/
function generarDatos(problema, nivelRuido, trainRatio, semilla) 
{
  const rng = new LCG(semilla);
  const sigma = nivelRuido * 0.25; // Ajuste de ruido para que sea visible pero no excesivo

  let datos = [];
  let vueltas = 3;

  if (problema === 'lineal') {
    for (let i = 0; i < 200; i++) {
      const x1 = rng.next() * 2 - 1;
      const x2 = rng.next() * 2 - 1;
      const clase = (x2 > x1) ? 1 : 0;
      datos.push({
        x: [
          x1 + rng.nextGaussian() * sigma,
          x2 + rng.nextGaussian() * sigma
        ],
        y: clase
      });
    }
  } else if (problema === 'espiral') {
    for (let clase = 0; clase < 2; clase++) {
      for (let i = 0; i < 100; i++) {
        const t = (i / 100) * (vueltas * Math.PI); 
        const r = t / (vueltas * Math.PI); 
        const angulo = t + clase * Math.PI;
        let x1 = r * Math.cos(angulo);
        let x2 = r * Math.sin(angulo);
        x1 += rng.nextGaussian() * sigma/4;
        x2 += rng.nextGaussian() * sigma/4;
        datos.push({ x: [x1, x2], y: clase });
      }
    }
  } else if (problema === 'circulos') {
    for (let clase = 0; clase < 2; clase++) {
      const rMin = clase === 0 ? 0.1 : 0.6;
      const rMax = clase === 0 ? 0.4 : 1.0;
      for (let i = 0; i < 100; i++) {
        const r = rMin + rng.next() * (rMax - rMin);
        const theta = rng.next() * 2 * Math.PI;
        let x1 = r * Math.cos(theta);
        let x2 = r * Math.sin(theta);
        x1 += rng.nextGaussian() * sigma;
        x2 += rng.nextGaussian() * sigma;
        datos.push({ x: [x1, x2], y: clase });
      }
    }
  } else if (problema === 'xor') {
    const cuadrantes = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let q = 0; q < 4; q++) {
      const [sx, sy] = cuadrantes[q];
      const clase = (sx * sy > 0) ? 0 : 1; 
      for (let i = 0; i < 50; i++) {
        const x1 = sx * rng.next();
        const x2 = sy * rng.next();
        datos.push({
          x: [
            x1 + rng.nextGaussian() * sigma,
            x2 + rng.nextGaussian() * sigma
          ],
          y: clase
        });
      }
    }
  } else if (problema === 'medialuna') {
    // Clase 0: semicírculo superior, centro (0, 0), radio 1
    // Clase 1: semicírculo inferior, centro (0.5, 0), radio 1
    // El offset −0.3 acerca las medias lunas verticalemente.
    for (let i = 0; i < 100; i++) {
      const t = (i / 99) * Math.PI;
      datos.push({
        x: [
          Math.cos(t)        + rng.nextGaussian() * sigma,
          Math.sin(t) - 0.5 + rng.nextGaussian() * sigma
        ],
        y: 0
      });
      datos.push({
        x: [
          0.5 + Math.cos(t)  + rng.nextGaussian() * sigma,
          -Math.sin(t) + 0.2 + rng.nextGaussian() * sigma
        ],
        y: 1
      });
    }
  } else if (problema === 'seno') {
    /* for (let i = 0; i < 200; i++) {
      const x1 = i / 199; 
      const y_true = Math.sin(2 * Math.PI * x1);
      const y = y_true + rng.nextGaussian() * sigma;
      datos.push({ x: [x1], y: y });
    } */
  }

  for (let i = datos.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [datos[i], datos[j]] = [datos[j], datos[i]];
  }

  const trainCount = Math.floor(datos.length * trainRatio);
  const datosTrain = datos.slice(0, trainCount);
  const datosTest  = datos.slice(trainCount);

  esTipoClasif = (problema !== 'seno'); 
  return { datosTrain, datosTest };
}

function normalizarDatos(datosTrain, datosTest) 
{
  const nInput = datosTrain.length > 0 ? datosTrain[0].x.length : 1;

  const todosLosDatos = [...datosTrain, ...datosTest];

  const mins = new Array(nInput).fill(Infinity);
  const maxs = new Array(nInput).fill(-Infinity);

  for (const d of todosLosDatos) {
    for (let k = 0; k < nInput; k++) {
      if (d.x[k] < mins[k]) 
        mins[k] = d.x[k];
      if (d.x[k] > maxs[k]) 
        maxs[k] = d.x[k];
    }
  }

  const datosTrain_norm = datosTrain.map(d => ({
    ...d,
    x: d.x.map((v, k) => {
      const rango = maxs[k] - mins[k] || 1;
      return ((v - mins[k]) / rango) * 2 - 1;
    })
  }));

  const datosTest_norm = datosTest.map(d => ({
    ...d,
    x: d.x.map((v, k) => {
      const rango = maxs[k] - mins[k] || 1;
      return ((v - mins[k]) / rango) * 2 - 1;
    })
  }));

  return { datosTrain: datosTrain_norm, datosTest: datosTest_norm };
}

// ============================================================================
// FUNCIONES DE ACTIVACIÓN Y RED NEURONAL
// ============================================================================

function aplicarActivacion(z, tipo) {
  if (typeof z === 'number') z = [z];
  const result = new Float32Array(z.length);
  for (let i = 0; i < z.length; i++) {
    const val = z[i];
    if (tipo === 'relu') 
      result[i] = Math.max(0, val);
    else if (tipo === 'sigmoid') {
      const clamped = Math.min(100, Math.max(-100, val));
      result[i] = 1 / (1 + Math.exp(-clamped));
    } else if (tipo === 'tanh') 
      result[i] = Math.tanh(val);
    else if (tipo === 'lineal') 
      result[i] = val;
    else if (tipo === 'leaky_relu') 
      result[i] = val > 0 ? val : 0.01 * val;
    else 
      result[i] = val;
  }
  return result;
}

function derivadaActivacion(z, tipo)
{
  const result = new Float32Array(z.length);
  for (let i = 0; i < z.length; i++) {
    const val = z[i];
    if (tipo === 'relu') 
      result[i] = val > 0 ? 1 : 0;
    else if (tipo === 'sigmoid') {
      const clamped = Math.min(100, Math.max(-100, val));
      const sig = 1 / (1 + Math.exp(-clamped));
      result[i] = sig * (1 - sig);
    } else if (tipo === 'tanh') {
      const t = Math.tanh(val);
      result[i] = 1 - t * t;
    } else if (tipo === 'lineal')
      result[i] = 1;
    else if (tipo === 'leaky_relu')
      result[i] = val > 0 ? 1 : 0.01;
    else 
      result[i] = 1;
  }
  return result;
}

function crearModelo(capas, activacion, eta, dropout, semillaPesos, distribucion, beta = 0.9) 
{
  const modelo = {
    capas, activacion, eta, dropout, semillaPesos, distribucion, beta,
    pesos: [], sesgos: [], velPesos: [], velSesgos: [],
    historial: [], estado: 'activo', epocaFinal: null,
    contadorConv: 0, stepCount: 0
  };
  inicializarPesos(modelo, distribucion, semillaPesos);
  return modelo;
}

function inicializarPesos(modelo, distribucion, semillaPesos) {
  const { capas } = modelo;
  const rng = new LCG(semillaPesos);

  modelo.pesos = []; modelo.sesgos = [];
  modelo.velPesos = []; modelo.velSesgos = [];

  for (let l = 1; l < capas.length; l++) {
    const nIn = capas[l - 1];
    const nOut = capas[l];
    const nWeights = nIn * nOut;

    let std;
    if (distribucion === 'uniforme') std = null;
    else if (distribucion === 'normal') std = 0.1;
    else if (distribucion === 'xavier') std = Math.sqrt(2 / (nIn + nOut));
    else if (distribucion === 'he') std = Math.sqrt(2 / nIn);
    else std = 0.1;

    const pesos = new Float32Array(nWeights);
    for (let i = 0; i < nWeights; i++) {
      if (distribucion === 'uniforme') {
        pesos[i] = (rng.next() - 0.5); 
      } else {
        pesos[i] = rng.nextGaussian() * std;
      }
    }
    modelo.pesos.push(pesos);
    modelo.velPesos.push(new Float32Array(nWeights)); 

    const sesgos = new Float32Array(nOut);
    modelo.sesgos.push(sesgos);
    modelo.velSesgos.push(new Float32Array(nOut)); 
  }
}

function forward(modelo, X, conDropout = false) {
  let ejemplos = X;
  if (X.length > 0 && !Array.isArray(X[0])) {
    ejemplos = [X];
  }

  const n = ejemplos.length;
  const { capas, activacion, dropout, pesos, sesgos } = modelo;
  const L = capas.length - 1; 

  const activaciones = []; 
  const preActivaciones = []; 
  const mascarasDropout = [];

  let a = [];
  for (let i = 0; i < n; i++) a.push(new Float32Array(ejemplos[i]));
  activaciones.push(a);
  preActivaciones.push(null);
  mascarasDropout.push(null);

  for (let l = 1; l <= L; l++) {
    const W = pesos[l - 1];
    const b = sesgos[l - 1];
    const nIn = capas[l - 1];
    const nOut = capas[l];
    const a_prev = a;

    let z = [];
    for (let i = 0; i < n; i++) {
      const zi = new Float32Array(nOut);
      for (let j = 0; j < nOut; j++) zi[j] = b[j];
      const ai = a_prev[i];
      for (let j = 0; j < nOut; j++) {
        for (let k = 0; k < nIn; k++) {
          zi[j] += W[k * nOut + j] * ai[k];
        }
      }
      z.push(zi);
    }
    preActivaciones.push(z);

    if (l < L) {
      a = z.map(zi => aplicarActivacion(zi, activacion));
      if (conDropout && dropout > 0) {
        const mascaraL = [];
        const p = dropout;
        const rng = new LCG(modelo.semillaPesos * 10007 + l * 1009 + modelo.stepCount * 997); 
        for (let i = 0; i < n; i++) {
          const m = new Float32Array(a[i].length);
          for (let j = 0; j < a[i].length; j++) {
            const keep = rng.next() < (1 - p) ? 1 : 0;
            m[j] = keep / (1 - p); 
            a[i][j] *= m[j];
          }
          mascaraL.push(m);
        }
        mascarasDropout.push(mascaraL);
      } else 
        mascarasDropout.push(null);
    } else {
      const activacionSalida = esTipoClasif ? 'sigmoid' : 'lineal';
      a = z.map(zi => aplicarActivacion(zi, activacionSalida));
      mascarasDropout.push(null);
    }
    activaciones.push(a);
  }

  return { activaciones, preActivaciones, mascarasDropout };
}

// ============================================================================
// ENTRENAMIENTO Y MÉTRICAS
// ============================================================================

function calcularLoss(yPred, yReal, tipo) {
  if (yPred.length === 0) return 0;
  const epsilon = 1e-7;
  let suma = 0;

  if (tipo === 'bce') {
    for (let i = 0; i < yPred.length; i++) {
      const yp = Math.min(1 - epsilon, Math.max(epsilon, yPred[i]));
      const y = yReal[i];
      suma += y * Math.log(yp) + (1 - y) * Math.log(1 - yp);
    }
    return -suma / yPred.length;
  } else if (tipo === 'mse') {
    for (let i = 0; i < yPred.length; i++) {
      const diff = yReal[i] - yPred[i];
      suma += diff * diff;
    }
    return suma / yPred.length;
  }
  return 0;
}

function calcularAccuracy(yPred, yReal) {
  if (yPred.length === 0) return 0;
  let correctas = 0;
  for (let i = 0; i < yPred.length; i++) {
    const yp_clase = yPred[i] >= 0.5 ? 1 : 0;
    if (yp_clase === yReal[i]) correctas++;
  }
  return correctas / yPred.length;
}

function backprop(modelo, activaciones, preActivaciones, yReal, tipo) {
  const L = modelo.capas.length - 1;
  const n = activaciones[0].length; 
  const dW = []; const db = [];
  const delta = new Array(L + 1);

  const yPred = activaciones[L];
  delta[L] = [];
  for (let i = 0; i < n; i++) {
    const deltaL = new Float32Array(yPred[i].length);
    for (let j = 0; j < yPred[i].length; j++) {
      deltaL[j] = yPred[i][j] - yReal[i]; 
    }
    delta[L].push(deltaL);
  }

  for (let l = L - 1; l >= 1; l--) {
    const zl = preActivaciones[l];
    const nOut_l = modelo.capas[l];
    const nOut_lplus1 = modelo.capas[l + 1];
    const W_lplus1 = modelo.pesos[l]; 

    delta[l] = [];
    for (let i = 0; i < n; i++) {
      const deltaL = new Float32Array(nOut_l);
      for (let j = 0; j < nOut_l; j++) {
        let suma = 0;
        for (let k = 0; k < nOut_lplus1; k++) {
          suma += W_lplus1[j * nOut_lplus1 + k] * delta[l + 1][i][k];
        }
        deltaL[j] = suma;
      }
      const f_prime = derivadaActivacion(zl[i], modelo.activacion);
      for (let j = 0; j < nOut_l; j++) deltaL[j] *= f_prime[j];
      delta[l].push(deltaL);
    }
  }

  for (let l = 1; l <= L; l++) {
    const nIn = modelo.capas[l - 1];
    const nOut = modelo.capas[l];

    const dWl = new Float32Array(nIn * nOut);
    const dbl = new Float32Array(nOut);

    for (let i = 0; i < n; i++) {
      const a_prev = activaciones[l - 1][i]; 
      const deltaL = delta[l][i]; 

      for (let j = 0; j < nOut; j++) {
        for (let k = 0; k < nIn; k++) 
          dWl[k * nOut + j] += deltaL[j] * a_prev[k];

        dbl[j] += deltaL[j];
      }
    }

    for (let i = 0; i < dWl.length; i++) 
      dWl[i] /= n;
    for (let i = 0; i < dbl.length; i++) 
      dbl[i] /= n;

    dW.push(dWl); db.push(dbl);
  }
  return { dW, db };
}

function actualizarPesos(modelo, gradientes) 
{
  const beta = modelo.beta;
  const eta = modelo.eta;
  
  for (let l = 0; l < modelo.pesos.length; l++) {
    const W = modelo.pesos[l];
    const b = modelo.sesgos[l];
    const vW = modelo.velPesos[l];
    const vb = modelo.velSesgos[l];
    const dWl = gradientes.dW[l];
    const dbl = gradientes.db[l];

    for (let i = 0; i < W.length; i++) {
      vW[i] = beta * vW[i] + eta * dWl[i];
      W[i] -= vW[i];
    }
    for (let i = 0; i < b.length; i++) {
      vb[i] = beta * vb[i] + eta * dbl[i];
      b[i] -= vb[i];
    }
  }
}

function entrenarEpoca(modelo, datosTrain) 
{
  if (datosTrain.length === 0) 
    return { J_train: 0 };

  modelo.stepCount = (modelo.stepCount || 0) + 1; 

  const X_train = datosTrain.map(d => d.x);
  const y_train = datosTrain.map(d => d.y);
  const tipoLoss = esTipoClasif ? 'bce' : 'mse'; 

  const conDropout = modelo.dropout > 0;
  const fwd = forward(modelo, X_train, conDropout);

  const yPred = fwd.activaciones[fwd.activaciones.length - 1].map(a => a[0]);
  const J_train = calcularLoss(yPred, y_train, tipoLoss);
  const gradientes = backprop(modelo, fwd.activaciones, fwd.preActivaciones, 
                          y_train, tipoLoss);

  let sumaCuad = 0; let countGrad = 0;
  for (const dWl of gradientes.dW) 
    for (const g of dWl) { 
      sumaCuad += g * g; 
      countGrad++; 

  }
  for (const dbl of gradientes.db) 
    for (const g of dbl) { 
      sumaCuad += g * g; 
      countGrad++; 
    }

  modelo.gradNormaMedia = countGrad > 0 ? Math.sqrt(sumaCuad / countGrad) : 0;

  actualizarPesos(modelo, gradientes);

  const { J_test, accuracy_test } = evaluarTest(modelo, datosTest);
  modelo.historial.push({ epoca: modelo.historial.length,
    J_train, J_test, accuracy_test
  });

  return { J_train };
}

function evaluarTest(modelo, datosTest) {
  if (datosTest.length === 0) 
    return { J_test: 0, accuracy_test: 0 };
  const X_test = datosTest.map(d => d.x);
  const y_test = datosTest.map(d => d.y);
  const tipoLoss = esTipoClasif ? 'bce' : 'mse'; 

  const fwd = forward(modelo, X_test, false);
  const yPred = fwd.activaciones[fwd.activaciones.length - 1].map(a => a[0]);

  const J_test = calcularLoss(yPred, y_test, tipoLoss);
  let accuracy_test = null;
  if (esTipoClasif) 
    accuracy_test = calcularAccuracy(yPred, y_test);

  return { J_test, accuracy_test };
}

function verificarConvergencia(modelo) 
{
  const h = modelo.historial;
  if (h.length < 2) 
    return false;

  const J_actual   = h[h.length - 1].J_train;
  const J_anterior = h[h.length - 2].J_train;

  const cond1 = Math.abs(J_actual - J_anterior) < 1e-4;
  if (cond1) 
    modelo.contadorConv++;
  else 
    modelo.contadorConv = 0;

  if (modelo.contadorConv < 30) 
    return false;

  const J_inicial = h[0].J_train;
  const mejora = (J_inicial - J_actual) / (J_inicial + 1e-8);
  if (mejora < 0.15) 
    return false;

  const ultimoH = h[h.length - 1];
  const J_test_final = ultimoH.J_test ?? Infinity;
  const baseline = esTipoClasif ? 0.693 : J_inicial;
  const calidadOK = J_test_final < baseline * 0.50;

  return calidadOK;
}

function verificarDivergencia(modelo, J_anterior) {
  if (modelo.historial.length === 0)
    return { diverge: false, tipo: null };
  const J_actual = modelo.historial[modelo.historial.length - 1].J_train;

  if (J_anterior && J_actual > J_anterior * 10 && J_actual > 1e-6) 
    return { diverge: true, tipo: 'explosion' };

  for (const W of modelo.pesos) {
    for (const w of W) 
      if (!isFinite(w) || Math.abs(w) > 1e6) 
        return { diverge: true, tipo: 'colapso' };
  }
  for (const b of modelo.sesgos) {
    for (const bi of b) 
      if (!isFinite(bi) || Math.abs(bi) > 1e6) 
        return { diverge: true, tipo: 'colapso' };
  }
  return { diverge: false, tipo: null };
}

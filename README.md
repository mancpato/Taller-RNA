# TalleRNA

Visualizador interactivo de múltiples de redes neuronales entrenando 
simultáneamente para uso didáctico. Desarrollado en el Departamento 
Académico de Sistemas Computacionales (DASC), Universidad Autónoma de 
Baja California Sur (UABCS).

## Descripción

TalleRNA permite explorar cómo los hiperparámetros afectan el entrenamiento
de múltiples redes neuronales simultáneamente. El usuario configura un rango
de valores para cada hiperparámetro, lanza varios modelos y observa en tiempo 
real cómo evolucionan las fronteras de decisión, la pérdida y el rendimiento 
de cada modelo.

## Uso

Abrir `index.html` directamente en el navegador.
Solo depende de p5.js (cargado vía CDN).

## Interfaz

| Panel | Contenido |
|-------|-----------|
| 1 — Espacio de salida | Mapa de predicción y fronteras de decisión del enjambre |
| 2 — Historial de pérdida | Curvas J_train y J_test por modelo en tiempo real |
| 3 — Controles del módulo | Hiperparámetros del módulo activo y estado del enjambre |
| 4 — Estadísticas | Resumen de convergencia y mejor modelo al terminar |

## Módulos (pestañas)

- **Topología**: ✅ operativo
- **Activación**: ✅ operativo
- **Inicialización**: ✅ operativo
- **Tasa de aprendizaje**: ✅ operativo
- **Momentum**: ✅ operativo
- **Experimentos**:  pendiente

## Problemas disponibles

Lineal · XOR · Círculos · Media luna · Espiral · Seno (regresión, pendiente)

## Arquitectura base

Red 2→4→1, activación ReLU, optimizador SGD con momento.
Toda la aleatoriedad usa un generador LCG con semilla explícita
para garantizar reproducibilidad entre sesiones.
El módulo activo al cargar es Topología; el problema por defecto es Lineal.

## Organización modular

```text
/TalleRNA
├── index.html
├── css/
│   └── style.css
└── js/
    ├── config.js        (Variables globales y paletas)
    ├── motor_ml.js      (Matemáticas, red neuronal y datos)
    ├── main.js          (Bucle principal: setup, draw)
    ├── comun/
    │   ├── estado.js    (Máquina de estados y control del enjambre)
    │   ├── layout.js    (Geometría, barra global, pestañas, notificaciones)
    │   ├── panel1.js    (Espacio de salida: mapa, fronteras, datos)
    │   ├── panel2.js    (Historial de pérdida)
    │   ├── panel4.js    (Estadísticas y visualización de red)
    │   └── eventos.js   (Interacción: mouse, pestañas)
    └── modulos/
        ├── eta.js       (Módulo tasa de aprendizaje)
        ├── init.js      (Módulo inicialización de pesos)
        ├── activacion.js(Módulo función de activación)
        ├── momentum.js  (Módulo momentum)
        ├── dropout.js   (Módulo dropout)
        └── topologia.js (Módulo topología)
```

## Autor

Prof. Miguel Ángel Norzagaray Cosío - UABCS
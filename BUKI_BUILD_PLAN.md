# Buki — Plan de construcción

Estado: Fase 0 definida  
Escenario de validación inicial: centro de Santiago de Chile  
Documento base: [BUKI_PRODUCT_CONTRACT.md](./BUKI_PRODUCT_CONTRACT.md)

## 1. Dirección del producto

Buki ayuda a una persona que está en una ciudad y quiere decidir qué hacer ahora. La persona escribe su intención en lenguaje natural y recibe un pequeño circuito caminable con lugares reales, horarios, distancias y una alternativa si algo cambia. La ciudad no está fijada a Santiago: la experiencia puede operar en cualquier lugar con cobertura y datos disponibles del proveedor de mapas seleccionado.

> “Estoy en el centro de Santiago. Tengo toda la tarde, quiero comer algo típico, conocer dos lugares interesantes y caminar no más de veinte minutos entre cada parada.”

La experiencia principal ocurre dentro de Buki: el mapa queda incrustado en la aplicación, como en una aplicación de movilidad. El usuario no debe salir a otra aplicación para entender el plan o seguir la siguiente parada.

WebMCP es una capa interna para que un agente pueda consultar y adaptar el plan. No es la promesa principal del producto.

## 2. Estrategia de migración

No se copiarán archivos completos entre proyectos.

### Se conserva de `proyecto-mapa-ia-local`

- Modelo conceptual de lugares e itinerarios.
- Descubrimiento geográfico como punto de partida.
- FastAPI como backend de referencia.
- Abstracción de proveedor LLM.
- Prompt y validación de JSON estructurado.
- Pruebas multiciudad como metodología.

### Se conserva del prototipo WebMCP anterior

- React, Vite y TypeScript.
- Registro de herramientas WebMCP.
- Historial de acciones del agente.
- Patrón propuesta → validación → confirmación.
- Pruebas E2E con Playwright.
- Degradación manual cuando WebMCP no está disponible.

### Se reescribe

- Entrada basada en clics, para pasar a lenguaje natural.
- Selectores de mood y duración, para pasar a restricciones interpretadas.
- Línea visual entre coordenadas, para pasar a rutas caminando reales.
- Layout de escritorio, para convertirlo en experiencia mobile-first.
- Llamadas LLM desde el navegador, para llevar secretos y orquestación al backend.
- El contexto empresarial anterior, para enfocarlo en una persona explorando una ciudad; Santiago será la primera validación de campo.

### Se mantiene fuera del producto hasta validar

- `proyecto-mapa-ia-local/` como referencia.
- El prototipo WebMCP anterior no forma parte de la nueva aplicación.

La nueva aplicación vivirá inicialmente en `proyecto-webmcp/buki/`.

## 3. Arquitectura objetivo

```text
Petición natural + ubicación
            ↓
Extracción de restricciones
            ↓
Lugares reales y estado actual
            ↓
Rutas caminando
            ↓
Planificador verificable
            ↓
Explicación del LLM
            ↓
Mapa y siguiente parada dentro de Buki
            ↓
Reparación cuando una parada cambia
```

### Responsabilidad de cada capa

- **Frontend:** captura intención, muestra el mapa, presenta el plan y permite corregirlo.
- **Backend:** protege claves, consulta proveedores, normaliza respuestas y coordina el plan.
- **Proveedor de mapas:** entrega lugares, coordenadas, estado, horarios y rutas.
- **Planificador determinista:** aplica tiempo, distancia, orden y disponibilidad.
- **LLM:** interpreta lenguaje natural y explica decisiones sobre datos verificados.
- **WebMCP:** expone acciones del producto a un agente mediante contratos estructurados.

El LLM nunca será la fuente de verdad para nombres de lugares, horarios o distancias.

## 4. Decisión inicial de proveedores

Para probar la promesa de “mapa real” se usará Google Maps Platform de punta a punta:

- Maps JavaScript API para el mapa incrustado.
- Places API para lugares y detalles.
- Routes API para rutas caminando.

Google ofrece campos de estado del negocio y horarios actuales en Places, y rutas con modo `WALK` en Routes. La implementación deberá revisar los campos solicitados, atribuciones y precios vigentes en la fecha de desarrollo:

- [Places API](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- [Routes API](https://developers.google.com/maps/documentation/routes/compute-route-over)
- [Precios de Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Políticas y atribuciones de Places](https://developers.google.com/maps/documentation/places/web-service/policies)

### Controles de costo

- Billing y presupuesto configurados antes de consumir datos reales.
- Cuotas diarias y alertas.
- Field masks para pedir únicamente campos necesarios.
- Buscar candidatos primero y pedir detalles solo de los finalistas.
- No consultar una API por cada tecla escrita.
- Adaptador falso para tests.
- No descargar fotos, reseñas ni datos avanzados en el primer recorrido.

Mapbox, OpenStreetMap y OSRM quedan como alternativas de evaluación posterior. No se implementarán varios proveedores en paralelo durante el MVP.

## 5. Construcción por fases

### Fase 0 — Contrato del producto

Estado: completada.

Entregable: [BUKI_PRODUCT_CONTRACT.md](./BUKI_PRODUCT_CONTRACT.md).

Se definieron:

- Promesa del producto.
- Usuario y problema.
- Escenario de validación inicial en Santiago centro.
- Recorrido feliz y evento de reparación.
- Límites del MVP.
- Criterios de éxito.
- Prueba de campo.
- Regla de parada.

No se continúa ampliando el alcance si la historia principal todavía no funciona.

### Fase 1 — Base reversible

Objetivo: crear la nueva aplicación sin romper los proyectos existentes.

Pasos:

1. Inicializar Git en la raíz si todavía no existe.
2. Crear un commit de línea base.
3. Crear la rama `feature/buki-local-mcp`.
4. Crear `buki/` con React, Vite y TypeScript.
5. Crear un backend FastAPI separado.
6. Definir variables de entorno para claves y límites.
7. Definir un modo `mock` para desarrollo y pruebas.
8. Verificar que el contrato y la documentación de Buki siguen siendo la referencia activa.

Salida de fase: Buki arranca localmente con un modo simulado y el prototipo anterior ya no forma parte del árbol activo.

### Fase 2 — Experiencia móvil con datos simulados

Objetivo: validar que la experiencia se entiende antes de pagar APIs.

Pasos:

1. Crear una pantalla mobile-first con el mapa ocupando la mayor parte del viewport.
2. Añadir una caja de texto para la intención del usuario.
3. Añadir ubicación actual simulada y selección manual de punto.
4. Mostrar un panel inferior con el plan.
5. Mostrar dos o tres paradas.
6. Mostrar tiempo caminando entre cada parada.
7. Mostrar la tarjeta “Siguiente parada”.
8. Mostrar una parada cerrada y un reemplazo simulado.
9. Crear una vista desktop con mapa y plan lado a lado.

Salida de fase: una persona puede entender el flujo completo sin conocer WebMCP ni la arquitectura.

### Fase 3 — Recorrido real con Google Maps

Objetivo: reemplazar datos sintéticos por datos geográficos reales en la ciudad seleccionada.

Pasos:

1. Integrar el mapa incrustado de Google Maps.
2. Solicitar geolocalización con consentimiento explícito.
3. Consultar lugares cercanos según categorías extraídas.
4. Obtener detalles solo para candidatos finalistas.
5. Consultar estado de apertura y horarios disponibles.
6. Calcular rutas reales caminando.
7. Dibujar ruta, marcadores y posición actual dentro de Buki.
8. Mostrar la fuente y hora de consulta cuando sea necesario.
9. Manejar permisos denegados, resultados vacíos, límites y errores de API.

Salida de fase: desde un punto de la ciudad seleccionada se pueden mostrar lugares reales y una ruta caminable válida dentro de Buki.

### Fase 4 — Lenguaje natural y planificación

Objetivo: convertir una frase libre en un plan factible.

Pasos:

1. Extraer a una estructura `TripRequest`:
   - origen;
   - hora de inicio;
   - tiempo disponible;
   - intereses;
   - presupuesto opcional;
   - caminata máxima por tramo;
   - ritmo o cantidad de paradas.
2. Pedir aclaración solo cuando falte un dato imprescindible.
3. Consultar candidatos usando esas restricciones.
4. Calcular rutas antes de ordenar las paradas.
5. Aplicar reglas deterministas de tiempo y distancia.
6. Pedir al LLM una explicación breve basada en el plan validado.
7. Rechazar nombres o datos que no provengan de los proveedores.
8. Mostrar advertencias cuando un horario no pueda verificarse.

Salida de fase: el escenario de validación se inicia con lenguaje natural y no con un formulario largo.

### Fase 5 — WebMCP mínimo

Objetivo: permitir que un agente use las capacidades reales de Buki.

Herramientas iniciales conceptuales:

- `search_nearby_places`;
- `get_place_status`;
- `compute_walking_route`;
- `get_itinerary`;
- `propose_itinerary`;
- `replace_stop`;
- `focus_stop`.

Pasos:

1. Definir descripciones y esquemas de entrada.
2. Marcar las operaciones de lectura como read-only.
3. Hacer que las propuestas sean visibles antes de aplicarlas.
4. Registrar cada invocación y resultado de forma resumida.
5. Mantener controles manuales equivalentes.
6. Probar errores, entradas incompletas y ausencia de WebMCP.

No se implementará todavía un catálogo grande de tools. La ampliación del alcance de WebMCP queda pendiente de descubrimiento después de validar este flujo.

### Fase 6 — Reparación de una parada

Objetivo: demostrar adaptación sin rehacer todo el itinerario.

Pasos:

1. Permitir marcar una parada como cerrada o no disponible.
2. Identificar qué tramos quedan afectados.
3. Buscar alternativas con la misma intención.
4. Recalcular tiempos y distancias.
5. Conservar origen, tiempo disponible y caminata máxima.
6. Mostrar comparación antes/después.
7. Explicar por qué se eligió el reemplazo.
8. Permitir aceptar o deshacer la reparación.
9. Mostrar estado “desconocido” cuando no exista evidencia suficiente.

Noticias y fuentes externas se evaluarán después. Una noticia no debe cambiar el plan automáticamente sin indicar fuente, fecha y nivel de confianza.

### Fase 7 — Verificación, móvil y despliegue

Objetivo: demostrar el producto en un teléfono real, inicialmente en Santiago.

Pasos:

1. Pruebas unitarias del planificador.
2. Pruebas E2E en escritorio.
3. Pruebas E2E en viewport móvil aproximado de 390×844.
4. Prueba con WebMCP disponible.
5. Prueba manual sin WebMCP.
6. Prueba de geolocalización con HTTPS.
7. Prueba de rutas en el centro de Santiago.
8. Verificación de atribuciones, privacidad y claves restringidas.
9. Configuración de cuotas y alertas.
10. Despliegue público con HTTPS.
11. Prueba de campo caminando con un teléfono real.

El despliegue se hace después de que el recorrido local y la experiencia móvil pasen.

## 6. Prueba definitiva del MVP

Una persona abre Buki desde su celular en el centro de Santiago y escribe:

> “Tengo toda la tarde, quiero comer algo típico, conocer dos lugares interesantes y caminar no más de veinte minutos entre cada parada. Dame un plan que funcione hoy.”

La prueba pasa si:

1. Buki entiende la intención sin explicación externa.
2. El usuario puede confirmar su ubicación.
3. Aparecen dos o tres lugares reales.
4. El mapa incrustado muestra el circuito completo.
5. El plan respeta el tiempo disponible y la caminata máxima.
6. Se muestran horarios o estados con incertidumbre explícita.
7. El usuario identifica cuál es la siguiente parada.
8. Puede seguir el mapa sin salir de Buki.
9. Una parada cerrada puede reemplazarse conservando las restricciones.
10. La experiencia funciona tanto manualmente como mediante WebMCP.

## 7. Métricas de la prueba de campo

- Tiempo desde abrir la aplicación hasta obtener el primer plan.
- Tiempo hasta entender la siguiente acción.
- Porcentaje de lugares correctamente identificados.
- Diferencia entre tiempo caminando estimado y observado.
- Número de correcciones necesarias.
- Porcentaje de reparaciones aceptadas.
- Errores de API o geolocalización.
- Consumo de API por sesión.
- Si la persona volvería a usar Buki para decidir qué hacer ahora.

## 8. Regla de parada y decisiones pendientes

La primera versión se detiene después de una historia completa en Santiago centro. Esto valida el producto en una ciudad concreta; no convierte a Santiago en una restricción geográfica permanente.

No se agregan antes de esa validación:

- reservas o pagos;
- vuelos, hoteles o traslados;
- planificación que combine varias ciudades o varios días;
- navegación giro a giro propia;
- rastreo automático de noticias;
- segundo proveedor de mapas;
- catálogo ampliado de WebMCP tools;
- cuentas, perfiles o red social.

Después de la prueba de campo se decidirá, con evidencia de uso, si Buki necesita:

- ampliar WebMCP;
- incorporar fuentes de noticias o eventos;
- ampliar la validación a otras ciudades;
- añadir proveedores alternativos;
- incorporar funciones de reserva;
- mantener Google Maps o evaluar Mapbox/OSM.

# Buki — Contrato del producto

Estado: Fase 0 definida  
Fecha: 28 de agosto de 2026  
Escenario de validación inicial: centro de Santiago de Chile

## 1. Promesa del producto

> Buki convierte “¿qué puedo hacer ahora?” en un plan caminable, realista y adaptable.

La persona escribe en lenguaje natural qué quiere hacer, cuánto tiempo tiene y cuánto está dispuesta a caminar. Buki combina esa intención con lugares reales, horarios y rutas para entregar un pequeño circuito que se pueda ejecutar ahora mismo.

Si una parada deja de estar disponible, Buki propone un reemplazo que conserva las restricciones importantes del plan.

### Qué significa “realista”

- Los lugares existen y provienen de una fuente geográfica identificable.
- La ruta usa tiempos y distancias caminando calculados por un proveedor de mapas.
- El plan respeta el tiempo disponible y la distancia máxima por tramo.
- El estado de apertura se muestra con su fuente y hora de consulta cuando esté disponible.
- La IA explica y coordina; no inventa lugares, horarios ni distancias.

## 2. Usuario y trabajo a resolver

### Usuario inicial

Una persona que viaja sola o está explorando su propia ciudad quiere decidir qué hacer durante las próximas horas sin armar un itinerario desde cero. Buki está pensada para funcionar en cualquier ciudad con cobertura y datos disponibles del proveedor de mapas; la primera validación se hará en Santiago.

### Problema

La persona no necesita una guía turística de veinte páginas. Necesita una decisión ejecutable ahora: dónde ir primero, cuánto caminará, qué hará después y qué hacer si un lugar está cerrado.

### Frase de entrada principal — ejemplo de validación inicial

> “Estoy en el centro de Santiago de Chile, cerca de Plaza de Armas. Tengo toda la tarde. Quiero comer algo típico, conocer dos lugares interesantes y caminar; no quiero caminar más de veinte minutos entre cada parada. Dame un plan que funcione hoy.”

La frase es un ejemplo de prueba, no una reserva ni una recomendación fija. Los lugares y horarios deben consultarse en tiempo de ejecución.

## 3. Escenario de validación: Santiago

### Recorrido feliz

1. La persona abre Buki desde el celular en la ciudad donde se encuentra; la primera prueba será en el centro de Santiago.
2. Autoriza la ubicación o elige un punto en el mapa.
3. Escribe su intención en una sola caja de texto.
4. Buki identifica las restricciones: punto de partida, tiempo disponible, intereses y caminata máxima.
5. Consulta lugares cercanos, estado de apertura y rutas caminando.
6. Muestra un circuito de dos o tres paradas sobre el mapa.
7. La persona toca “Ir a la siguiente parada” y Buki mantiene el mapa incrustado, mostrando su posición, la ruta y la siguiente parada sin sacarla de la aplicación.

### Evento de reparación

Durante el recorrido, la persona informa:

> “El museo que me recomendaste está cerrado.”

Buki debe:

- marcar esa parada como no disponible;
- buscar una alternativa cultural cercana y abierta, si existe;
- conservar el punto de partida, el tiempo restante y la caminata máxima;
- recalcular los tramos afectados;
- mostrar claramente qué cambió y por qué;
- ofrecer una opción manual si no puede verificar una alternativa.

## 4. Límites del MVP

### Incluido

- Una experiencia web responsive con prioridad para celular.
- Un único caso principal: plan caminable espontáneo dentro de una sola ciudad, validado inicialmente en Santiago centro.
- Entrada por lenguaje natural.
- Ubicación actual o punto elegido en mapa.
- Dos o tres paradas por plan.
- Lugares reales, horarios/estado disponible y rutas caminando.
- Mapa visual incrustado y panel de “siguiente parada”.
- Ruta caminando y posición actual dentro de Buki, sin depender de cambiar de aplicación.
- Reparación de una parada no disponible.
- WebMCP para que un agente consulte, proponga y repare el plan.
- Controles manuales equivalentes cuando WebMCP no esté disponible.
- Datos simulados para pruebas automatizadas y datos reales para la prueba de campo.

### Explícitamente fuera del MVP

- Comprar entradas, reservar restaurantes o pagar servicios.
- Reservar vuelos, hoteles o traslados.
- Navegación giro a giro propia.
- Planificación de viajes de varios días.
- Garantía de cobertura o disponibilidad en todas las ciudades del mundo, y proveedores alternativos al inicial.
- Rastreo exhaustivo de noticias y redes sociales.
- Promesas de seguridad personal o recomendaciones médicas.
- Login, perfiles, red social, favoritos sincronizados o monetización.
- Segundo proveedor de mapas en la interfaz.

## 5. Arquitectura conceptual aceptada

```text
Intención + ubicación
        ↓
Restricciones estructuradas
        ↓
Lugares reales + estado
        ↓
Rutas caminando
        ↓
Planificador verificable
        ↓
Plan móvil
        ↓
Reparación cuando una parada cambia
```

Google Maps/Places/Routes sería la fuente inicial para mapa, lugares y rutas. El LLM no será la fuente de verdad geográfica: interpretará la petición y redactará la explicación sobre datos devueltos por las APIs.

El mapa y las peticiones compatibles con frontend de Google Maps podrán ejecutarse desde el navegador usando una clave restringida por dominio, APIs y cuotas. La clave del LLM se mantendrá exclusivamente en una función server-side de Vercel; no se necesita un servidor FastAPI separado. La ciudad es un parámetro de operación, no una limitación conceptual del producto. La cobertura efectiva, los campos disponibles y la calidad de los datos dependerán de Google Maps en cada ubicación. Santiago se usa como escenario de validación y prueba de campo del MVP.

WebMCP será una capa de interacción para el agente, no el argumento de valor para la persona. Las herramientas iniciales serán conceptualmente:

- `search_nearby_places`;
- `get_place_status`;
- `compute_walking_route`;
- `propose_itinerary`;
- `replace_stop`;
- `focus_stop`.

## Pendiente posterior al MVP: ampliar WebMCP

La primera versión solo necesita las capacidades mínimas para construir, leer y reparar un plan caminable. Queda pendiente investigar el alcance completo de WebMCP dentro de Buki: qué otras partes de la experiencia podría consultar, coordinar o adaptar un agente además de reparar una parada.

Esta exploración puede incluir planificación, contexto de ubicación, preferencias, cambios durante la caminata, explicación de decisiones y coordinación con servicios externos. No se diseñarán ni implementarán esos tools durante este MVP; primero se validará que el recorrido principal tenga valor para la persona.

## 6. Criterios de éxito

El MVP se considera exitoso si una persona que no inspeccionó el código puede completar esta historia:

> Desde un celular, describe un plan para pasar la tarde caminando por una ciudad cubierta por el proveedor de mapas; recibe dos o tres paradas reales, entiende el orden, sigue la ruta en el mapa incrustado de Buki y puede reemplazar una parada cerrada sin rehacer todo el plan.

La primera demostración de esta historia se realizará en el centro de Santiago.

### Criterios observables

1. **Comprensión inmediata:** en los primeros segundos se entiende que Buki responde qué hacer ahora, dónde ir y cómo caminar entre lugares.
2. **Entrada natural:** el escenario principal se puede iniciar escribiendo una frase, sin completar un formulario largo.
3. **Realidad geográfica:** cada parada mostrada tiene identificador o enlace del proveedor de lugares; no se aceptan lugares inventados.
4. **Ruta válida:** el plan no supera el tiempo disponible ni la caminata máxima declarada por tramo.
5. **Estado verificable:** cada lugar debe indicar abierto, cerrado, desconocido o última consulta; nunca presentar una suposición como certeza.
6. **Reparación:** al marcar una parada como cerrada, el sistema conserva las restricciones y ofrece una alternativa o explica por qué no puede hacerlo.
7. **Uso móvil:** la historia completa funciona en una pantalla aproximada de 390×844 sin zoom horizontal ni botones inaccesibles.
8. **Continuidad:** el mapa permanece dentro de Buki y muestra la posición actual, el tramo activo, la siguiente parada y el tiempo estimado sin obligar a cambiar de aplicación.
9. **Agente y humano:** las mismas capacidades existen por WebMCP y mediante controles manuales; el agente no puede cambiar el plan sin que la persona vea el resultado.
10. **Costo controlado:** las consultas están limitadas por sesión y por día; no se realizan llamadas por cada tecla escrita.

## 7. Prueba de campo

La primera prueba real será en el centro de Santiago, con una persona caminando y un teléfono real. Se registrará:

- tiempo desde la petición hasta el primer plan;
- si la persona entiende cuál es la siguiente parada y puede seguir el mapa sin explicación externa ni cambiar de aplicación;
- diferencia entre distancia estimada y experiencia percibida;
- cantidad de correcciones manuales;
- comportamiento cuando un lugar está cerrado o no se puede verificar;
- consumo de APIs por sesión;
- si la persona usaría Buki nuevamente para decidir qué hacer ahora.

La prueba no buscará demostrar que Buki reemplaza Google Maps como plataforma cartográfica. Buscará demostrar que Buki reduce la fricción entre tener tiempo libre y comenzar una experiencia concreta, manteniendo mapa, contexto y siguiente acción en una sola pantalla.

## 8. Regla de parada

No se ampliará el MVP a reservas, noticias, recorridos que combinen varias ciudades ni múltiples proveedores hasta que la historia de una sola ciudad funcione de principio a fin en celular con datos reales y una reparación verificable. La primera validación de esa historia será en Santiago centro.

La ampliación de WebMCP se revisará después de esa validación, como una etapa de descubrimiento separada y no como una razón para aumentar el alcance actual.

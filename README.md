# Buki

Buki convierte “¿qué puedo hacer ahora?” en un plan caminable, realista y adaptable.

La primera validación está definida para una persona que explora el centro de Santiago de Chile desde su celular. El producto no está limitado a Santiago: puede operar en cualquier ciudad con cobertura y datos disponibles del proveedor de mapas. La persona escribe qué quiere hacer, cuánto tiempo tiene y cuánto está dispuesta a caminar; Buki propone lugares reales, muestra el recorrido dentro de la aplicación y puede reparar una parada si deja de estar disponible.

Documentos principales:

- [`BUKI_PRODUCT_CONTRACT.md`](./BUKI_PRODUCT_CONTRACT.md): promesa, usuario, límites y criterios de éxito.
- [`BUKI_BUILD_PLAN.md`](./BUKI_BUILD_PLAN.md): fases de construcción, arquitectura, pruebas y regla de parada.

Estado actual: Fase 3 implementada con integración opcional de Google Maps y WebMCP base. Buki tiene una experiencia mobile-first con fallback mock, geolocalización con consentimiento, búsqueda real de lugares, estado de apertura, ruta caminable e inspector visible de 11 herramientas; falta validar Maps con una clave restringida.

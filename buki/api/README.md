# Buki Vercel Functions

Estas funciones son la frontera server-side mínima de Buki. Se despliegan junto al
frontend en Vercel y están destinadas a proteger la clave del LLM y coordinar llamadas
que no deben ejecutarse en el navegador.

Google Maps se prepara para el frontend con una clave restringida por dominio. La
integración concreta del proveedor LLM queda separada de la interfaz para poder elegir
el proveedor cuando se disponga de su URL, modelo y formato de API.

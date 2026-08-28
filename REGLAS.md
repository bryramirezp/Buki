# Reglas oficiales — OpenAI WebMCP Challenge

Resumen operativo de las *Official Rules*. **Fuente de verdad: la página oficial de Devpost**
(`webmcp.devpost.com`) y las reglas completas. Si algo aquí contradice al original, gana el original.

- **Sponsor:** OpenAI OpCo, LLC · **Administrador:** Devpost, Inc.
- **Dudas:** support@devpost.com

---

## 1. Fechas (todas en Pacific Time)

| Hito | Cuándo |
|---|---|
| Registro y submissions abren | **25 ago 2026, 11:00 am** |
| **Deadline de submission** | **3 sep 2026, 1:00 pm** ← el único que importa |
| Judging | 4 sep 10:00 am → 21 sep 5:00 pm |
| Ganadores | ~23 sep, 2:00 pm |

> ⚠️ La landing de openai.com dice 12:00 pm para la apertura y las reglas dicen 11:00 am.
> Irrelevante para nosotros: **el deadline de cierre coincide en ambas (3 sep, 1:00 pm PT).**

> ⚠️ La app debe seguir **viva, gratis y sin restricciones** hasta que termine el judging
> (21 sep). No es solo entregar y olvidarse.

---

## 2. Elegibilidad

**Chile está permitido.** ✅

Excluidos por país/territorio: **Bielorrusia, Brasil, China, Hong Kong, Crimea, Cuba, Irán,
Corea del Norte, Rusia, Siria, Venezuela, Donetsk, Lugansk, y la provincia de Quebec**, más
cualquier lugar fuera de la lista de países soportados por la API de OpenAI
(`platform.openai.com/docs/supported-countries`).

También excluidos: empleados y agentes de OpenAI y Devpost, los jueces y sus empleadores, y
sus familiares o convivientes.

Se puede entrar como individuo, equipo u organización. Si es equipo, **un representante**
entra el submission en nombre de todos.

---

## 3. Qué hay que entregar

Los cinco elementos, todos obligatorios:

### 3.1 URL pública funcionando
Testeable por los jueces en **el navegador integrado de ChatGPT Desktop** o en **Chrome con
WebMCP activado**. Se puede hostear donde sea (ChatGPT Sites, Cloudflare, Vercel, Render,
Netlify…). Si la app requiere login, hay que **dar las credenciales en el formulario**.

### 3.2 Descripción de texto — cuatro preguntas fijas
Esto es prácticamente la rúbrica escrita como formulario:

1. **Por qué tu caso de uso encaja bien con WebMCP**
2. **Cómo crea una mejor experiencia de usuario**
3. **Qué pueden hacer las personas y sus agentes juntos que antes era difícil o imposible** ← *la tesis del challenge*
4. **Brevemente, cómo implementaste WebMCP**

### 3.3 Repositorio público
En GitHub, GitLab o Bitbucket. Debe contener:
- Todo el código fuente, assets e instrucciones para que el proyecto funcione
- **Licencia open source, detectable y visible en la sección "About"** del repo
- El patrón `document.modelContext.registerTool({ name, description, inputSchema, execute })`

### 3.4 Video de demostración
- **< 3 minutos.** Los jueces no están obligados a mirar más allá
- **Con audio**, cubriendo qué construiste y cómo usaste WebMCP
- Demo claro del proyecto funcionando
- **Público en YouTube**, link en el formulario
- **Sin marcas registradas ni música con copyright** de terceros

### 3.5 Todo en inglés
O con traducción al inglés del video, la descripción, las instrucciones de prueba y todo lo demás.

---

## 4. Cómo se juzga ← lo más importante

### Etapa 1 — pasa / no pasa
¿El proyecto **encaja razonablemente con el tema** y **aplica razonablemente las APIs/SDKs
requeridas**? Binario.

### Etapa 2 — cuatro criterios, **peso idéntico**

Texto original, porque los matices importan:

> **WebMCP Leverage** — *How thoroughly and skillfully does the project use WebMCP? Does the
> code reflect genuine effort and a working, non-trivial implementation?*

> **Execution** — *Does the project deliver a working or runnable project that has a complete,
> coherent product experience — not just a technical proof of concept?*

> **Potential Impact** — *Does the project make a credible, specific case for solving a real
> problem for a real audience — and does the solution actually address that problem based on
> what's demonstrated?*

> **Creativity & Ambition** — *How creative and novel is the concept and does the project
> differ from existing concepts?*

**Desempate:** si hay empate, gana quien tenga mejor puntaje en el primer criterio de la lista
(WebMCP Leverage). Si sigue el empate, se compara el siguiente, y así. Si empatan en todos,
los jueces votan.

### Tres cosas que la gente subestima

1. **Los jueces NO están obligados a probar tu app.** Las reglas dicen literalmente que pueden
   juzgar *"solely on the text description, images, and video provided in the Submission"*.
   → **El video y la descripción pesan tanto como el código.**

2. **Puede juzgarte una IA.** Las reglas admiten *"expert panels, peer review, automated
   AI-driven analysis, or any combination"*. → El README y la descripción tienen que ser
   legibles para un modelo, no solo para un humano.

3. **Los jueces pueden cambiar** antes o durante el judging, y pueden no estar listados
   públicamente.

### Los jueces anunciados

Sarah Drasner (Chrome, Google) · Andrew Galloni (Cloudflare) · Jude Gao (Vercel, Next.js core)
· Ilya Grigorik (Shopify) · **Alex Nahas (creador de MCP-B)** · Sean Roberts (Netlify) ·
**Justin Rushing (Browser Agent Lead, OpenAI)**

> Ojo con los dos en negrita: Nahas escribió el precursor de WebMCP y Rushing lidera agentes
> de navegador en OpenAI. **Van a notar si el uso de las tools es superficial.**

---

## 5. Requisitos del proyecto

**Qué construir:** una web app potenciada por WebMCP que imagine y explore el futuro de la web
abierta — donde humanos y agentes puedan interactuar, colaborar y crear juntos.

**Nuevo o existente:** vale extender un proyecto previo, pero:
- La extensión con WebMCP debe haber ocurrido **después del inicio del Submission Period**
- Hay que **documentar qué es trabajo previo y qué es nuevo**, con evidencia fechada
  (historial de commits con timestamps o equivalente)
- **Solo se evalúa el trabajo añadido durante el Submission Period**

> Para Buki, el historial deberá documentar claramente qué se reutiliza del prototipo anterior y qué se construye como producto nuevo durante el Submission Period.

**Múltiples submissions:** permitido, pero cada uno debe ser sustancialmente distinto.

**Propiedad intelectual:** el trabajo debe ser original y tuyo, sin violar derechos de terceros.
Se puede usar open source de terceros cumpliendo sus licencias, siempre que tu aporte
**construya encima** de esa funcionalidad.

**Integraciones de terceros:** si usas SDKs, APIs o datos ajenos, debes estar autorizado según
sus términos.

**Cada proyecto es elegible para un solo premio.**

---

## 6. Cómo activar WebMCP

- **ChatGPT Desktop** → navegador integrado. Soporta WebMCP por defecto.
  Requiere *Settings › Browser › Permissions › Enable site tools*.
  Modelos **Sol** o **Terra** (Luna lo tiene deshabilitado). No disponible en Enterprise ni Edu.
- **Chrome 149+** → `chrome://flags/#enable-webmcp-testing` → Enabled → Relaunch.
  (Local: Chrome 151 ✅ verificado funcionando.)

**Restricciones que muerden:**
- Exige **secure context** (HTTPS o localhost)
- ChatGPT **no descubre tools dentro de iframes**, y solo soporta la API imperativa en la
  página top-level
- Si el documento no está origin-isolated, WebMCP se apaga en silencio

---

## 7. Premios — top 10 submissions

| De | Qué |
|---|---|
| **OpenAI** | $3,000 USD en efectivo · spotlight en @OpenAIDevs · Codex Micro · swag (hasta 3 miembros) · ChatGPT Pro 1 año (hasta 3 miembros) |
| **Cloudflare** | $10,000 en créditos |
| **Vercel** | $300/mes en créditos + $50/mes de Gateway, por 12 meses (~$4,200) |
| **Render** | $300 en créditos |
| **Netlify** | $500 en efectivo |
| **Shopify** | $250 en gear Shopify Supply |
| **Google Chrome** | 3 meses de Google AI Ultra por miembro del equipo |

**Para cobrar:** verificación de identidad, formularios de ganador (W-8BEN para no residentes
de EE.UU.) en un plazo de **10 días hábiles**. Los impuestos y comisiones bancarias corren por
cuenta del ganador. Entrega dentro de 60 días tras recibir los formularios.

**Extra disponible:** $3,000 en créditos de Netlify, solicitables por participantes registrados
hasta el **1 sep 12:00 pm PT** vía `forms.gle/xw75XGUQzCXEiALc7`. No canjeables por efectivo;
hay que usarlos antes del 3 oct 2026.

---

## 8. Letra chica que conviene saber

- **Plugin de Devpost para ChatGPT Codex:** opcional, no requerido para entrar ni ganar. Es un
  ayudante con IA que **puede equivocarse** — las reglas oficiales y el sitio del hackathon
  mandan siempre por encima de lo que diga el plugin.
- **Después del deadline no se puede modificar** el submission (salvo que el sponsor lo permita
  para quitar material problemático). Antes del deadline sí se pueden guardar borradores.
- **Licencia de uso:** al entrar le das a OpenAI y Devpost licencia no exclusiva para juzgar,
  promocionar y mostrar tu proyecto, y para usar tu nombre e imagen en material promocional
  durante el evento y los 3 años siguientes. **La propiedad del código sigue siendo tuya.**
- **Disputas:** arbitraje individual bajo reglas de la AAA, ley del estado de Nueva York, sin
  demandas colectivas.
- El sponsor puede descalificar a discreción por manipulación, conflicto de interés, o conducta
  que considere inapropiada.

---

## 9. Checklist contra estas reglas

- [ ] Enviado en Devpost **antes del 3 sep, 1:00 pm PT** (no a las 12:50)
- [ ] URL pública, HTTPS, viva y gratis **hasta el 21 sep**
- [ ] Credenciales de prueba en el formulario, si hicieran falta
- [ ] Repo público con **licencia open source visible en el About**
- [ ] `document.modelContext.registerTool(...)` presente en el código
- [ ] Video < 3 min, público en YouTube, con audio, sin copyright
- [ ] Las 4 preguntas de la descripción respondidas — la tercera es la que decide
- [ ] Todo en inglés
- [ ] Trabajo original, sin datos de terceros ni de ningún empleador

# English Coach

App de escritorio para macOS que me entrena para pasar de inglés **B2+** a **inglés corporativo C1**,
atacando mis errores reales y preparándome para entrevistas (asistente ejecutivo en consultoras
como BCG, logística y comercio exterior).

- Electron + HTML/CSS/JavaScript puro (sin frameworks).
- **100 % offline**: sin internet, sin API keys, sin servidores.
- Interfaz en español; contenido de práctica en inglés.
- Todo mi progreso se guarda en un archivo JSON local.

![Dashboard](docs/screenshots/fase1-dashboard.png)

![Error Killer: al fallar se muestra la regla](docs/screenshots/fase1-error-killer-regla.png)

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto, navegación, Dashboard, **Error Killer** | ✅ Lista |
| 2 | Tiempos verbales, Registro (call center → oficina), Colocaciones | ✅ Lista |
| 3 | Vocabulario con repetición espaciada, Progreso | ✅ Lista |
| 4 | Constructor STAR, Simulador de entrevista | Pendiente |
| 5 | Husos horarios, empaquetado del `.app` | Pendiente |

## Cómo correr la app

Necesitás [Node.js](https://nodejs.org) 20 o superior (recomendado: la versión LTS).

```bash
npm install
npm start
```

Se abre la ventana de **English Coach**. Atajos útiles:

| Atajo | Acción |
|---|---|
| `⌘1` … `⌘9`, `⌘0` | Ir a cada módulo de la barra lateral |
| `1` `2` `3` `4` | Elegir una opción en los ejercicios |
| `↵` (Enter) | Comprobar / Continuar / Empezar sesión |
| `Esc` | Salir de la sesión |

## Cómo generar el `.app` de macOS

```bash
npm run dist       # crea dist/English Coach-<versión>-arm64.dmg y .zip (Apple Silicon)
npm run dist:dir   # solo la carpeta con el .app, sin instalador (más rápido)
```

Hay que correrlo **en una Mac** (desde Linux o Windows el paquete sale roto: no se puede firmar y
el `.zip` pierde los enlaces internos del framework). El resultado queda en `dist/`; para instalar,
abrí el `.dmg` y arrastrá **English Coach** a *Aplicaciones*.

Durante el build vas a ver `firma ad-hoc aplicada`: es una firma local gratuita
(`scripts/after-pack.js`) sin la cual los Mac con Apple Silicon dicen que la app "está dañada".
Como no es un certificado de Apple, la primera vez macOS la bloquea igual: hacé **clic derecho →
Abrir → Abrir** (o en *Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente*). Solo hace
falta una vez.

Si aun así macOS dice que la app "está dañada" (pasa a veces con apps descargadas o copiadas por
AirDrop), quitale la marca de cuarentena y volvé a firmarla:

```bash
xattr -cr "/Applications/English Coach.app"
codesign --force --deep --sign - "/Applications/English Coach.app"
```

## Dónde se guarda mi progreso

En `~/Library/Application Support/English Coach/progress.json`. Para hacer un respaldo, copiá ese
archivo; para empezar de cero, borralo (con la app cerrada).

## Cómo agregar ejercicios nuevos

Todo el contenido vive en archivos JSON dentro de [`content/`](content/). No hace falta tocar
código: editás el JSON, guardás y volvés a abrir la app.

- **En desarrollo** (`npm start`): editá los archivos de `content/` en esta carpeta.
- **En la app instalada**: los JSON están en
  `English Coach.app/Contents/Resources/content/` (clic derecho sobre la app → *Mostrar contenido
  del paquete*). Si actualizás la app, copiá antes tus cambios.

Antes de abrir la app, revisá que no haya errores de formato:

```bash
npm run validate-content
```

Te dice exactamente qué falta o qué está mal (una coma, un `id` repetido, una respuesta que no
coincide con ninguna opción…).

### `content/errors.json` — Error Killer

Cada error tiene su regla y su lista de ejercicios:

```json
{
  "id": "for-ago",
  "title": "for + ago",
  "wrong": "for three years ago",
  "right": "for three years",
  "rule": "«for» y «ago» nunca van juntos.",
  "explanation": "Explicación más larga que aparece cuando fallo.",
  "examples": [
    { "wrong": "I worked there for three years ago.", "right": "I worked there for three years." }
  ],
  "exercises": [ ... ]
}
```

Hay dos tipos de ejercicio:

**Opción múltiple (`mc`)** — `answer` tiene que ser *idéntica* a una de las `options`
(las opciones se mezclan solas cada vez):

```json
{
  "id": "for-ago-17",
  "type": "mc",
  "prompt": "I coordinated imports at Veinsa Motors ___ six months.",
  "options": ["for", "ago", "since", "for ... ago"],
  "answer": "for"
}
```

**Completar (`fill`)** — el `prompt` lleva `___` donde va la respuesta. `answers` es una lista con
todas las respuestas válidas (no importan mayúsculas ni el punto final). `hint` es opcional:

```json
{
  "id": "interested-17",
  "type": "fill",
  "prompt": "I'm ___ in the logistics coordinator role.",
  "hint": "interest",
  "answers": ["interested"]
}
```

Reglas para no romper nada:

1. Cada `id` de ejercicio tiene que ser **único** en todo el archivo (convención: `<error>-<número>`).
2. **No cambies el `id`** de un ejercicio que ya practicaste: el progreso se guarda por `id`.
3. Para un **error nuevo**, agregá un bloque más a la lista `errors` con su propio `id`.
4. Comillas dobles `"` siempre, y coma entre elementos (pero no después del último).

### `content/tenses.json` — Tiempos verbales

Mismo formato que `errors.json`, pero la lista se llama `topics` y cada tema no necesita
`wrong`/`right`. Temas actuales: `for-ago-since`, `past-vs-perfect`, `will-going-to`,
`would-routines`. Para agregar un ejercicio, sumalo a `exercises` del tema que corresponda.

### `content/register.json` — Registro (call center → oficina)

Las `categories` son las situaciones (disculpas, avisos, pedidos…). Cada par va en `pairs`:

```json
{
  "id": "reg-45",
  "category": "requests",
  "context": "Email a un proveedor",
  "callcenter": "Kindly provide the tracking number at the earliest.",
  "corporate": "Could you send me the tracking number?",
  "distractors": ["Please be so kind as to provide the tracking number.", "Send the tracking number."],
  "note": "Explicación corta que aparece al responder."
}
```

- `category` tiene que ser el `id` de una categoría existente.
- `distractors`: lo ideal son dos, uno todavía demasiado guionado y uno demasiado brusco.

### `content/collocations.json` — Colocaciones

Los `groups` son los verbos (`make`, `do`, `take`, `pay`, `gain`, `other`). Cada ítem:

```json
{
  "id": "col-make-16",
  "group": "make",
  "collocation": "make an exception",
  "es": "hacer una excepción",
  "trap": "do",
  "prompt": "Could you ___ an exception for this order?"
}
```

- La respuesta es la primera palabra de `collocation` (o poné `"answer"` si no lo es).
- `trap` es el error típico en español; siempre aparece como opción y en el feedback se muestra
  tachado (*do an exception → make an exception*).
- Si no ponés `options`, se completan con `defaultOptions` (make, do, take, pay, gain).
  **Ojo:** si alguno de esos verbos también sería correcto (por ejemplo *take a course* y
  *do a course*), poné `"options"` a mano con solo una respuesta válida.

### `content/vocab.json` — Vocabulario (flashcards)

Tres mazos (`business`, `achievement`, `social`). Cada tarjeta:

```json
{
  "id": "voc-biz-19",
  "term": "heads-up",
  "meaning": "aviso previo",
  "definition": "advance warning about something",
  "example": "Just a heads-up: the CEO lands at 6, not 4.",
  "note": "Opcional: un tip de uso o pronunciación."
}
```

En la pantalla de Vocabulario podés elegir la dirección: **inglés → español** (reconocer) o
**español → inglés** (producir, más difícil y más útil para hablar). Al ver la respuesta te
autoevaluás: `1` = no lo sabía, `2` = lo sabía. Espacio muestra la respuesta.

## Cómo funciona la repetición espaciada

| Resultado | Vuelve a aparecer en |
|---|---|
| Fallado | 1 día (y además al final de la sesión, como segundo intento) |
| 1.er acierto | 3 días |
| 2.º acierto | 7 días → ya cuenta como **dominado** |
| 3.er acierto y siguientes | 21 días |

Si fallás un ejercicio dominado, vuelve a empezar desde 1 día. Cuando ya viste todo y no hay
nada pendiente, el botón cambia a **Practicar igual**: arma una sesión con lo que tenés menos firme. Cada sesión toma primero los
pendientes de hoy y completa hasta 15 con ejercicios nuevos, priorizando los errores que más fallás.

El **error de la semana** del Dashboard es el que más fallaste en los últimos 7 días (si no
fallaste ninguno, rota uno distinto cada semana).

## Pantalla de Progreso

- **Ejercicios por día** (14, 30 o 90 días): pasá el mouse sobre una barra para ver el detalle, o
  abrí *Ver como tabla*.
- **Acierto por módulo**: histórico, con cuántas respuestas diste en cada uno.
- **Errores que todavía fallo**: los temas de todos los módulos con fallos en los últimos 30 días,
  del más fallado al menos fallado, cada uno con su regla y un botón para practicarlo.

## Estructura del proyecto

```
main.js                 Proceso principal: ventana, lectura/escritura de JSON
preload.js              Puente seguro entre la interfaz y el sistema de archivos
renderer/
  index.html, styles.css
  app.js                Navegación y registro de módulos
  lib/core.js           Lógica pura: fechas, repetición espaciada, racha (con tests)
  lib/drill.js          Motor de ejercicios compartido (sesión, feedback, resumen)
  lib/store.js          Progreso del usuario
  lib/ui.js             Ayudantes de interfaz e íconos
  modules/              Un archivo por módulo
content/                Ejercicios (JSON editables)
scripts/                Validador de contenido
tests/                  Tests (npm test)
```

## Desarrollo

```bash
npm test                 # tests de la lógica y del contenido
npm run validate-content # valida los JSON de content/
```

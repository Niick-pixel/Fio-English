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

## Los 10 módulos

| Módulo | Para qué |
|---|---|
| **Inicio** | Racha, ejercicios de hoy, repasos pendientes, error de la semana y progreso por módulo |
| **Error Killer** | Tus 10 errores documentados + «we → I», 171 ejercicios con repetición espaciada |
| **Tiempos verbales** | for/ago/since, Past Simple vs Present Perfect, will vs going to, would |
| **Registro** | 44 frases de call center → versión corporativa |
| **Colocaciones** | 68 combinaciones make/do/take/pay/gain y otras, con la trampa del español |
| **Vocabulario** | 40 flashcards en 3 mazos (agenda, verbos de logro, small talk) |
| **Constructor STAR** | Historias de entrevista con revisión automática |
| **Simulador** | 19 preguntas, cronómetro de 90 s, grabación y autoevaluación |
| **Husos horarios** | Proponer reuniones entre ciudades y convertir horas |
| **Progreso** | Gráfico por día, acierto por módulo y errores que todavía fallás |

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto, navegación, Dashboard, **Error Killer** | ✅ Lista |
| 2 | Tiempos verbales, Registro (call center → oficina), Colocaciones | ✅ Lista |
| 3 | Vocabulario con repetición espaciada, Progreso | ✅ Lista |
| 4 | Constructor STAR, Simulador de entrevista | ✅ Lista |
| 5 | Husos horarios, empaquetado del `.app` | ✅ Lista |

## Cómo instalar la app (recomendado)

No hace falta instalar Node ni compilar nada: GitHub compila la app en una Mac cada vez que se
actualiza `main` y la publica en [Releases](https://github.com/Niick-pixel/Fio-English/releases).

### Opción A — Una línea en Terminal (la más fácil)

1. Abrí **Terminal** (⌘ + espacio, escribí «Terminal», Enter).
2. Pegá esto y apretá Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/Niick-pixel/Fio-English/main/install.sh | bash
   ```

El script detecta si tu Mac es Apple Silicon o Intel, descarga la versión correcta, la copia a
**Aplicaciones** y la abre. Como se descarga desde Terminal y no desde el navegador, macOS no
muestra el aviso de «no se puede verificar el desarrollador». Para **actualizar**, corré la misma
línea otra vez: tu progreso no se toca.

### Opción B — Descargar el `.dmg`

1. Entrá a [Releases](https://github.com/Niick-pixel/Fio-English/releases) y descargá:
   - `English-Coach-…-arm64.dmg` si tu Mac tiene chip **M1, M2, M3 o M4** ( → *Acerca de esta Mac*
     dice «Chip Apple…»).
   - `English-Coach-…-x64.dmg` si dice **Intel**.
2. Abrí el `.dmg` y arrastrá **English Coach** a **Aplicaciones**.
3. La primera vez macOS la bloquea porque no está firmada con un certificado pago de Apple:
   - **macOS 15 Sequoia o más nuevo:** abrila una vez (aparece el aviso, tocá *Listo*). Andá a
     *Ajustes del Sistema → Privacidad y seguridad*, bajá hasta el final y tocá **Abrir igualmente**
     junto a «English Coach». Confirmá con tu contraseña.
   - **macOS 14 o anterior:** clic derecho sobre la app → *Abrir* → *Abrir*.
4. Si dice que la app «está dañada», abrí Terminal y corré:

   ```bash
   xattr -cr "/Applications/English Coach.app"
   ```

### Micrófono

En el Simulador, la primera vez que tocás **Grabar** macOS pide permiso para el micrófono: aceptá.
Si lo negaste: *Ajustes del Sistema → Privacidad y seguridad → Micrófono* → activá English Coach.

## Correrla desde el código (para modificarla)

Necesitás [Node.js](https://nodejs.org) 20 o superior (la versión LTS).

```bash
npm install
npm start
```

Atajos útiles:

| Atajo | Acción |
|---|---|
| `⌘1` … `⌘9`, `⌘0` | Ir a cada módulo de la barra lateral |
| `1` `2` `3` `4` | Elegir una opción en los ejercicios |
| `↵` (Enter) | Comprobar / Continuar / Empezar sesión |
| `Esc` | Salir de la sesión |

## Generar el `.app` en tu Mac (opcional)

Normalmente no hace falta (GitHub lo hace solo, ver arriba). Si querés compilarla vos:

```bash
npm install
npm run dist       # crea dist/English-Coach-<versión>-arm64.dmg y -x64.dmg (+ .zip)
npm run dist:dir   # solo la carpeta con el .app, sin instalador (más rápido)
```

Hay que correrlo **en una Mac**. Durante el build vas a ver `firma ad-hoc aplicada`: es una firma
local gratuita (`scripts/after-pack.js`) sin la cual las Mac con Apple Silicon dicen que la app
«está dañada». El ícono sale de `build/icon.png` (`npm run icon` lo regenera; necesita Python con
Pillow).

### Cómo se publica una versión nueva

El flujo [`.github/workflows/build-mac.yml`](.github/workflows/build-mac.yml) corre en cada push:
tests, compilación para Apple Silicon e Intel, verificación de la firma y una prueba de que la app
abre. En `main`, además crea o actualiza el Release `v<versión>` de `package.json`. Para publicar
una versión nueva: subí `version` en `package.json` y hacé push a `main`.

## Dónde se guarda mi progreso

En `~/Library/Application Support/English Coach/progress.json` (progreso, historias STAR y la lista
de grabaciones). Los audios del simulador están en la subcarpeta `recordings/` (archivos `.webm`). Para hacer un respaldo, copiá ese
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

### `content/interview.json` — Simulador de entrevista

Tres categorías (`about-me`, `behavioral`, `ea-situational`), cada una con su `checklist` de
autoevaluación. Para agregar una pregunta:

```json
{
  "id": "q-beh-07",
  "category": "behavioral",
  "text": "Tell me about a time you disagreed with your manager.",
  "tip": "Qué buscan, en español. Aparece en «¿Qué buscan con esta pregunta?»."
}
```

`timeLimitSec` cambia el cronómetro (90 por defecto) y `connectors` es la lista de conectores que
aparece en la autoevaluación.

### `content/star.json` — Constructor STAR

Los textos de ayuda de cada caja, los verbos de logro sugeridos, la cantidad de historias objetivo
(`targetStories`) y la historia de ejemplo. Las historias que escribís **no** van acá: se guardan
en tu `progress.json`.

### `content/timezones.json` — Husos horarios

Ciudades, regiones y roles para los escenarios. Para agregar una ciudad que use una regla
existente:

```json
{ "id": "toronto", "name": "Toronto", "country": "Canadá", "region": "us-east", "utcOffset": -5, "rule": "us", "abbr": ["EST", "EDT"] }
```

- `utcOffset`: horas respecto de UTC en **invierno** (pueden ser medias horas: `5.5`).
- `rule`: `"none"` (nunca cambia), `"eu"` (Europa) o `"us"` (EE. UU./Canadá).
- `abbr`: `[abreviatura de invierno, abreviatura de verano]`.
- `roles`: las personas de los escenarios (`singular` usa «está», `plural` usa «están»).

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

## Constructor STAR

Cuatro cajas (Situation, Task, Action, Result) con revisión en vivo:

- **«we» en Action** → advertencia roja, y cada «we» queda resaltado.
- **Result sin número** → te pide algo medible (%, tiempo, casos).
- **Menos de 80 palabras** → «Desarrollá más».
- **Errores de tu tabla** → subrayados en rojo dentro del texto (for…ago, interest, listen all,
  partners, at the system, to + -ing, different + singular, Understood…). Los verbos en presente
  dentro de la historia se marcan en naranja para que revises el tiempo verbal.

Cada historia se guarda sola mientras escribís. Podés asociarla a una pregunta del simulador
(aparece allí como ayuda) y usar **Modo repaso** para releerlas todas antes de una entrevista.

## Simulador de entrevista

**Pregunta al azar** (sale primero la que menos practicaste), cronómetro de 90 segundos y botón
**Grabar** (o `espacio`). Al empezar a grabar, el tip y tu historia STAR se pliegan para que
respondas de memoria. A los 90 segundos se corta solo. Después escuchás la grabación, marcás la
autoevaluación (`1`–`4`) y guardás (`↵`).

La primera vez, macOS pide permiso para usar el micrófono. Si lo negaste por error: *Ajustes del
Sistema → Privacidad y seguridad → Micrófono* → activá English Coach. Sin micrófono podés usar
**Solo cronómetro**.

## Husos horarios

Dos modos:

- **Proponer una reunión:** «Tu jefa está en Madrid, dos colegas en Nueva York y vos en San José…».
  Escribís una hora de Costa Rica; la app revisa que caiga entre 9:00 y 18:00 (hora local) de
  lunes a viernes para todos, y te muestra la tabla de conversión completa, la ventana válida, el
  porqué de cada diferencia y cómo proponerlo en un email en inglés.
- **Convertir una hora:** una hora de Costa Rica → la hora y el día en otra ciudad (Asia cambia la
  fecha).

Reglas del motor (`renderer/lib/tz.js`): Costa Rica UTC−6 todo el año; Europa en verano desde el
último domingo de marzo hasta el último de octubre; EE. UU. desde el segundo domingo de marzo
hasta el primero de noviembre; Asia sin cambios. El 40 % de los escenarios cae a propósito en las
semanas en que Europa ya cambió y EE. UU. todavía no. Los tests comparan el motor con la base de
datos oficial de husos horarios, cada 3 horas, de 2025 a 2028.

## Estructura del proyecto

```
main.js                 Proceso principal: ventana, JSON, grabaciones, permiso de micrófono
preload.js              Puente seguro entre la interfaz y el sistema de archivos
renderer/
  index.html, styles.css
  app.js                Navegación y registro de módulos
  lib/core.js           Lógica pura: fechas, repetición espaciada, racha (con tests)
  lib/drill.js          Motor de ejercicios compartido (sesión, feedback, resumen)
  lib/star-check.js     Validador de historias STAR (con tests)
  lib/tz.js             Motor de husos horarios (con tests)
  lib/store.js          Progreso del usuario
  lib/ui.js             Ayudantes de interfaz e íconos
  modules/              Un archivo por módulo
content/                Ejercicios (JSON editables)
build/icon.png          Ícono de la app
scripts/                Validador de contenido, firma ad-hoc, generador del ícono
tests/                  Tests (npm test)
```

## Desarrollo

```bash
npm test                 # tests de la lógica y del contenido
npm run validate-content # valida los JSON de content/
```

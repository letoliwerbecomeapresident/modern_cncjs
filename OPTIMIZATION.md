# Plan optymalizacji cncjs pod Raspberry Pi

Dokument opisuje konkretne zmiany do wprowadzenia, aby fork działał szybko i lekko na Raspberry Pi (cel: Pi 3B+ i nowsze). Każdy punkt zawiera **co**, **dlaczego**, **jak**, **szacowany zysk** i **priorytet** (P0 = zrób najpierw, P3 = opcjonalnie).

---

## Status realizacji (ostatnia aktualizacja: 2026-05-26, decyzje + P1.1 in progress)

> **Target deployment:** Raspberry Pi **Zero W (pierwsza generacja)** — ARMv6, single-core 1 GHz, **512 MB RAM**, microSD jako dysk. To skrajny target — każdy KB JS i każdy MB RAM ma podwójną wagę. Optymalizacje runtime (P3/P4) są nie opcjonalne, lecz konieczne. Build aplikacji zawsze na laptopie (Pi Zero W nie da rady — OOM + brak ARMv6 wsparcia w Node 18+ z oficjalnych buildów).

### ✅ Zrobione

- **P0.1** — `devtool: false` w `webpack.config.production.js` (źródło-mapy wyłączone w prod)
- **P0.2** — `ESLintPlugin` usunięty z `webpack.config.production.js` (lint pozostaje w `yarn lint` + pre-push)
- **P0.3** — `splitChunks` per-vendor (three, react, trendmicro, lodash, dayjs, i18next, misc) + `runtimeChunk: 'single'` + `TerserPlugin` (drop_console, 2 passes) + `CssMinimizerPlugin`. Dodane devDeps: `terser-webpack-plugin`, `css-minimizer-webpack-plugin`.
- **P0.4** — `CompressionPlugin` (gzip + brotli q=11) w webpack + `express-static-gzip` w `src/server/app.js` (preferencja `br` → `gz` → raw). Dodane: `compression-webpack-plugin` (dev), `express-static-gzip` (runtime).
- **P2.1** — `moment` → `dayjs` w 8 plikach + bootstrap z pluginami w `src/app/lib/dayjs.js` (`duration`, `isSameOrAfter`, `isSameOrBefore`, `localizedFormat`). `bundle-loader!moment/locale/*` zastąpione `import('dayjs/locale/${locale}.js')`. `ContextReplacementPlugin` ograniczony do locale z `build.config.languages`. `moment` + `bundle-loader` usunięte z deps.
- **P2.2** — `import _ from 'lodash'` cherry-pickowany w 12 plikach `src/app/**` na `import get from 'lodash/get'` itp. Plugin `babel-plugin-lodash` zostaje (`src/server/**` nadal go używa). **Bundle output bez zmian** — plugin już wcześniej cherry-pickował automatycznie. Korzyść: deterministyczność, audytowalność, gotowość pod usunięcie pluginu.
- **P1.1** — Lazy-load VisualizerPanel (ControlDeck) przez `LazyVisualizerPanel.jsx` z dynamic `import(/* webpackChunkName: "visualizer" */ './VisualizerPanel')`. React 15.6 — ręczny class wrapper. `webpack.config.production.js`: dodane `output.chunkFilename: '[name].[contenthash].bundle.js'` (async chunki dostają contenthash + są precompresowane brotli/gzip). Three.js (`vendor.three` 518 KB raw / 105 KB brotli) i kod Visualizer (`visualizer.<hash>.bundle.js` 199 KB raw / 45 KB brotli) **przesunięte z initial do async**.
- **P2.3** — `jimp` usunięty z deps (nieużywany).
- **P4.3** — Google Analytics wyłączone (`trackingId: ''` w `build.config.js` + guard w `src/app/index.jsx:104`).
- **P5.2** — `immutable: true` w `serveStatic` opcjach (`src/server/app.js`).
- **P6.1** — `webpack-bundle-analyzer` pod flagą `ANALYZE=1 yarn build` → raport `dist/cncjs/bundle-report.html`. Dodane devDep: `webpack-bundle-analyzer`.
- **Cleanup:** `serve-static` usunięty z obu `package.json` (zastąpiony przez `express-static-gzip`).

### 📊 Pomierzone wyniki

Baseline (przed P0):
- `main.bundle.js`: 2.5 MB raw / 651 KB gzip (jeden chunk)
- `main.css`: 379 KB raw

Po P0:
- 10 chunków JS rozdzielonych (main, runtime, 7× vendor) + 2 chunki CSS
- Initial load (first visit): **~542 KB brotli** (vs 651 KB gzip baseline) = **−17%**
- Second load (po zmianie w `main`, vendory z cache): **~89 KB brotli** = **−86%**
- `dist/cncjs/app/` zajmuje 8.2 MB (vs 6.5 MB) — koszt trzymania precompresowanych `.gz`/`.br` obok oryginałów

Po P2.1 (moment → dayjs):
- `vendor.moment` (83 KB raw) → `vendor.dayjs` (31 KB raw / 9.3 KB gzip / 8.1 KB brotli) — zawiera core + 4 plugins + 16 locales (en jest bazowy)
- Initial load (first visit): **485 KB brotli** (vs ~542 KB po P0) = dodatkowe −57 KB (−10%)
- `dist/cncjs/app/` 8.1 MB (vs 8.2 MB po P0)

Po P2.2 (lodash cherry-pick frontu):
- `vendor.lodash`: 45 KB raw / 14 KB gzip / 12 KB brotli — **bez zmian**
- Initial load 485 KB brotli — bez zmian
- `babel-plugin-lodash` już wcześniej robił automatyczne cherry-picki, więc po stronie KB zero. Pozostaje higiena: importy jawne, audyt przez `grep`, możliwość usunięcia plugin'u po analogicznym cherry-picku w `src/server/**` (out of scope).

Po P1.1 (lazy VisualizerPanel):
- **Initial brotli: 354 KB** (vs 485 KB po P2.2) = **−27%** (kumulatywnie vs baseline 651 KB gzip: **−46% w brotli, −32% w gzip**)
- Initial gzip: 446 KB
- Initial chunki (8 plików JS): runtime 1.9 KB / vendor.react 39 KB / vendor.dayjs 8.3 KB / vendor.lodash 12 KB / vendor.trendmicro 37 KB / vendor.i18next 12 KB / **vendor.misc 191 KB** / main 53 KB (wszystko brotli). `vendor.misc` to teraz największy ciężar — kandydat do podziału w przyszłości.
- Async (ładowane przy pierwszym mount VisualizerPanel): vendor.three 105 KB brotli + visualizer 45 KB brotli = **151 KB brotli odłożone z initial**
- Drugi load (cache vendorów): teoretycznie tylko `main` + `runtime` zmieniają hashe → ~55 KB brotli

### ⏭️ Do zrobienia w kolejności (rekomendacja dla Pi Zero W)

Priorytet ustawiony pod target Pi Zero W: najpierw to co odciąża transfer i parsowanie w przeglądarce (front), potem runtime Node.

1. ~~**P1.1** — Lazy-load VisualizerPanel (ControlDeck).~~ **Zrobione 2026-05-26** (−131 KB brotli z initial).
2. **Cleanup Workspace.jsx** (nowy) — `Workspace.jsx` renderuje już tylko `<ControlDeck />`, ale trzyma ~250 linii nieużywanej logiki widget management (widgetManager imports, primary/secondary containers, sortableGroup, updateWidgetsFor*, resizeDefaultContainer, pubsub publish). Higiena, mały zysk JS, otwiera drogę do P1.3.
3. **P1.3** — Kasacja klasycznych widgetów nieużywanych przez ControlDeck. Odblokowane. ControlDeck używa z `widgets/`: `Console`, `Connection`, `Visualizer`, `WidgetConfig`. Do kasacji (po weryfikacji że nikt inny nie importuje): **Autolevel, Axes, Custom, GCode, Grbl, Laser, Macro, Marlin, Probe, Smoothie, Spindle, TinyG, Tool, Webcam** + `WidgetManager/`, `PrimaryWidgets.jsx`, `SecondaryWidgets.jsx`, `DefaultWidgets.jsx`. Realnie 100–300 KB raw.
4. **P4.1 + P4.2** — Pi-side systemd unit + `NODE_OPTIONS=--max-old-space-size=256` (dla Zero W zamiast 512). Sekcja 4.2.
5. **P3.2 + P3.4** — Throttle eventów Socket.IO (10 Hz) + bufor konsoli (2000 linii). **Krytyczne dla Pi Zero W** — single-core ARMv6 nie wybacza spam'u rerenderów.
6. **P2.5** — Wyrzucenie xterm. Wymaga przepisania `widgets/Console/Terminal.jsx` (używanego przez ControlDeck.ConsolePanel) na lekki własny terminal lub usunięcie ConsolePanel.
7. **P5.1** — Service Worker (workbox). Drugi load <100 ms, offline mode.
8. **P4.6** — tmpfs dla `/var/log/cncjs/` i `/tmp` (oszczędność cykli zapisu microSD).
9. **P2.4** — Font Awesome subset / migracja na `react-icons`. −~1.5 MB z `dist/` (assety).
10. **P1.4** — Selektywne importy Three.js + bump `three` ~0.103 → >=0.150. Średnie ryzyko (forki w `src/app/lib/three/`, `CombinedCamera` do przepisania).
11. **P4.5** — Kasacja nieużywanych endpointów serwera (auth/users/events jeśli single-user warsztat). Dla Pi Zero W warta rozważenia.
12. **P2.6** — Audyt nakładających się stacków UI (bootstrap/react-bootstrap/styled-components/@trendmicro). Duży projekt.
13. **P3.1 / P3.3** — PureComponent audit, virtualizacja list (jeśli FilesPanel rośnie).
14. **P4.4** — HTTP/2 (jeśli front przez nginx).

### ✅ Decyzje (2026-05-26)

- **Pyt. 1** — ControlDeck **zastępuje** klasyczny Workspace (kierunek docelowy). Klasyczne widgety i logika widget management do kasacji. Odblokowuje P1.1, P1.3, P2.5.
- **Pyt. 2** — Zostawiamy **wszystkie 17 języków** w buildzie. P2.7 odpada. (i18n ładuje on-demand, więc initial load tego nie odczuwa.)
- **Pyt. 3** — xterm **do wyrzucenia**, ale wymaga przepisania `widgets/Console/Terminal.jsx` bo ControlDeck.ConsolePanel wciąż go opakowuje. Plan: P2.5 po cleanupie widgetów.
- **Pyt. 4** — Target: **Pi Zero W gen 1** (ARMv6, 512 MB RAM). Wszystkie optymalizacje P3/P4 są must-have, nie opcjonalne.
- **Pyt. 5** — Brak decyzji, ale przyjmujemy: UI oglądane z laptopa/tabletu przez LAN (Pi tylko serwuje). Jeśli to się zmieni (Chromium na Pi) — wszystkie front-optymalizacje stają się jeszcze krytyczniejsze.

### 🔧 Jak weryfikować że P0 nadal działa

```bash
yarn build
ls -lh dist/cncjs/app/*.js dist/cncjs/app/*.css | head -20
ls dist/cncjs/app/*.br | wc -l    # powinno być >0
ls dist/cncjs/app/*.gz | wc -l    # powinno być >0
gzip -c dist/cncjs/app/main.*.bundle.js | wc -c    # cel < 130000 bajtów
```

Diagnostyka per-chunk: `ANALYZE=1 yarn build` → otwórz `dist/cncjs/bundle-report.html`.

---

## 0. Punkt wyjścia: gdzie naprawdę jest obciążenie

Zanim cokolwiek zmieniamy — warto rozdzielić dwa różne "ciężary":

| Co | Gdzie wykonywane | Wpływ Twoich zmian frontowych |
|---|---|---|
| Bundle JS/CSS, Three.js, React | **Przeglądarka klienta** (laptop/tablet) | duży — to dyskutujemy w P0–P2 |
| Node.js (Express + Socket.IO + parsing G-code + serial I/O) | **Raspberry Pi** | minimalny — zmiany w UI tu nie ważą |

**Wniosek:** „lekkość na Pi" to dwa zadania:
1. Lżejszy/wolniejszy front → odciąża transfer z Pi i czas startu UI w przeglądarce
2. Lżejszy runtime Node → odciąża samo Pi (RAM, CPU)

Punkty P0–P4 dotyczą głównie #1. Sekcja **Runtime Node + Pi-specific** dotyczy #2.

### Aktualne liczby (build prod, master z Twoimi commitami)

| Plik | Raw | Po gzip |
|---|---|---|
| `main.bundle.js` | 2.5 MB | **651 KB** |
| `main.css` | 379 KB | ~50–70 KB |
| Mały async chunk (moment locales) | 9.3 KB | – |
| Fonty + SVG (Font Awesome + sterowniki) | ~2 MB | – |
| **Cały `dist/cncjs/app/`** | **6.5 MB** | – |

Docelowo: poniżej 1 MB initial JS gzip (po lazy-loadingu Visualizera i Settings), poniżej 100 KB CSS gzip.

---

## P0 — Tanie zwycięstwa w webpacku (1–2h, duży zysk)

### 0.1. Wyłącz source maps w produkcji

**Co:** `webpack.config.production.js:30` ma `devtool: 'cheap-module-source-map'`.
**Dlaczego:** Source-mapy są generowane razem z bundlem; spowalniają build i powiększają wynik. W prod są zbędne (chyba że celowo chcesz móc debugować live).
**Jak:** Ustaw `devtool: false` (lub `'hidden-source-map'` jeśli chcesz mapy do uploadu np. do Sentry, ale bez referencji w pliku JS).
**Zysk:** Krótszy build na Pi i lokalnie; nieco mniejszy `main.bundle.js` (10–20%).

### 0.2. Wyrzuć ESLint z buildu produkcyjnego

**Co:** `ESLintPlugin` jest aktywny w `webpack.config.production.js:138`.
**Dlaczego:** Lint to praca dewelopera, nie odpowiedzialność build pipeline'u prod. Nie wpływa na runtime, ale wydłuża build (na Pi to ważne, jeśli budujesz na nim).
**Jak:** Usuń `new ESLintPlugin({...})` z `plugins`. Lint i tak masz w `yarn lint` + pre-push hook.
**Zysk:** Build prod krótszy o 30–60s (zależnie od maszyny).

### 0.3. Włącz pełną optymalizację: splitChunks + runtimeChunk + minimizer

**Co:** Obecnie `optimization: { minimize: true }` — minimalny config.
**Dlaczego:** Brak code-splittingu = jeden gigantyczny `main.bundle.js`. Brak osobnego runtime chunk = przy każdej zmianie aplikacji unieważniasz cache całego vendora w przeglądarce.
**Jak:** W `webpack.config.production.js`:

```js
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      parallel: true,
      terserOptions: {
        compress: { drop_console: true, passes: 2 },
        format: { comments: false },
      },
      extractComments: false,
    }),
    new CssMinimizerPlugin(),
  ],
  runtimeChunk: 'single',
  splitChunks: {
    chunks: 'all',
    maxInitialRequests: 25,
    minSize: 20000,
    cacheGroups: {
      three: {
        test: /[\\/]node_modules[\\/]three[\\/]/,
        name: 'vendor.three',
        priority: 30,
      },
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|react-redux|redux|react-router-redux)[\\/]/,
        name: 'vendor.react',
        priority: 25,
      },
      trendmicro: {
        test: /[\\/]node_modules[\\/]@trendmicro[\\/]/,
        name: 'vendor.trendmicro',
        priority: 20,
      },
      lodash: {
        test: /[\\/]node_modules[\\/]lodash[\\/]/,
        name: 'vendor.lodash',
        priority: 20,
      },
      moment: {
        test: /[\\/]node_modules[\\/]moment[\\/]/,
        name: 'vendor.moment',
        priority: 20,
      },
      i18next: {
        test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
        name: 'vendor.i18next',
        priority: 20,
      },
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendor.misc',
        priority: 10,
      },
    },
  },
},
```

Dodaj devDependencies: `terser-webpack-plugin`, `css-minimizer-webpack-plugin` (yarn).

**Dlaczego per-paczka vendory:** Three.js, React i lodash zmieniają się rzadko — gdy klient raz pobierze `vendor.three.<hash>.js`, każda kolejna zmiana w Twoim kodzie nie unieważnia tej paczki. To dramatycznie skraca **drugi i kolejne** loady.

**Zysk:** Initial cache hit dla 70%+ kodu po pierwszej wizycie. Mniejszy bundle dzięki Terser w 2 przebiegach. `drop_console: true` usuwa `console.log` z prod.

### 0.4. Precompresja gzip + brotli

**Co:** Serwer ma `compression` middleware (kompresja on-the-fly), ale Pi marnuje CPU na gzipowanie statyków przy każdym requeście.
**Dlaczego:** Plik `.gz`/`.br` obok `.js` może być serwowany bezpośrednio — bez CPU.
**Jak:**
1. W `webpack.config.production.js` dodaj `CompressionPlugin` (gzip i brotli):
   ```js
   const CompressionPlugin = require('compression-webpack-plugin');

   plugins: [
     ...,
     new CompressionPlugin({ algorithm: 'gzip', test: /\.(js|css|html|svg)$/, threshold: 1024, minRatio: 0.8 }),
     new CompressionPlugin({ algorithm: 'brotliCompress', filename: '[path][base].br', test: /\.(js|css|html|svg)$/, compressionOptions: { level: 11 }, threshold: 1024, minRatio: 0.8 }),
   ],
   ```
2. Po stronie serwera: zamień `serveStatic(asset.path, ...)` na taką wersję, która serwuje precompressed pliki, jeśli istnieją (np. middleware `express-static-gzip`), albo zostaw `compression` middleware jako fallback.
   - **Najprościej:** dodaj `yarn add express-static-gzip` i w `src/server/app.js` użyj go zamiast `serveStatic` dla katalogów app (`asset.path`). Zachowuje `maxAge`.

**Zysk:** Zerowy CPU Pi na kompresji każdego requestu. Brotli ~15% mniej bajtów niż gzip — pierwszy load szybszy.

---

## P1 — Code-splitting i lazy load (4–6h, ogromny zysk)

### 1.1. Lazy-load Visualizera (Three.js)

**Co:** `Visualizer.jsx` ma 1523 linie i ciągnie pełne Three.js (~600 KB raw, ~150 KB gzip).
**Dlaczego:** Visualizer to dominujący ciężar bundla. Jeśli użytkownik najpierw widzi Connection/Files, można odłożyć ładowanie Three.js o sekundę.
**Jak:**
1. W `ControlDeck.jsx` zamień synchroniczny import `VisualizerPanel` na dynamiczny:
   ```js
   // Zamiast:
   import VisualizerPanel from './components/VisualizerPanel';

   // Daj wrapper, np. components/LazyVisualizerPanel.jsx:
   // (React 15.6 nie ma React.lazy — pisz ręcznie)
   class LazyVisualizerPanel extends React.Component {
     state = { Comp: null };
     componentDidMount() {
       import(/* webpackChunkName: "visualizer" */ './VisualizerPanel')
         .then(mod => this.setState({ Comp: mod.default }));
     }
     render() {
       const { Comp } = this.state;
       if (!Comp) return <div className={styles.panelPlaceholder}>Loading visualizer…</div>;
       return <Comp {...this.props} />;
     }
   }
   ```
2. Analogicznie zrób z klasycznym widgetem `widgets/Visualizer/` — jeśli wciąż jest importowany w `Workspace`, opakuj go tak samo.

**Zysk:** Initial JS spadnie o ~150–200 KB gzip. Pierwszy „interactive" o ~0.5–1 s szybszy na Pi WiFi.

### 1.2. Lazy-load Settings (cała sekcja konfigów)

**Co:** `src/app/containers/Settings/` to duży moduł (UserAccounts, Commands, Events, About…), używany rzadko.
**Dlaczego:** Większość użytkowników wchodzi tam raz w życiu.
**Jak:** W routerze (`App.jsx`/`index.jsx`) zamień `<Route component={Settings} />` na wrapper z `import()` jak w 1.1.

**Zysk:** Kolejne 50–100 KB gzip mniej w initial bundle.

### 1.3. Lazy-load klasycznych widgetów których ControlDeck **nie** używa

**Co:** Lista widgetów w `src/app/widgets/`: Autolevel, Axes, Connection, Console, Custom, GCode, Grbl, Laser, Macro, Marlin, Probe, Smoothie, Spindle, TinyG, Tool, Visualizer, Webcam.

ControlDeck dodaje własne panele: Axes, Connection, Console, Files, JobStatus, Jog, Laser, StatusMonitors, Visualizer. Klasyczne widgety **wciąż** są importowane w innych miejscach (`Workspace.jsx` etc).

**Dlaczego:** Jeśli chcesz długoterminowo trzymać tylko ControlDeck, klasyczne widgety stają się dead code w nowym UI — ale ponieważ są importowane, webpack je trzyma.

**Jak:**
- **Krótkoterminowo:** lazy-load `Workspace` (klasyczny widok) tym samym wzorcem co Settings.
- **Średnioterminowo:** zrób decyzję — czy ControlDeck zastępuje Workspace całkowicie? Jeśli tak, usuń `Workspace` z routera i całe `widgets/` które nie są używane przez ControlDeck.
- **Co kasować jeśli ControlDeck wystarczy:** Custom, Macro, Probe, Spindle, Tool, Webcam, Autolevel, GCode (klasyczny — ControlDeck ma `FilesPanel`/`JobStatusPanel`). Sterowniki Grbl/Marlin/Smoothie/TinyG są też klasycznymi widgetami — sprawdź czy ControlDeck wyświetla ich panele inaczej.

**Test:** zanim usuniesz, w `Workspace.jsx` zakomentuj import i odpal `yarn build` — webpack pokaże ostrzeżenie jeśli ktoś jeszcze odwołuje się do widgetu.

**Zysk:** Trudno oszacować bez czyszczenia konkretnych widgetów, ale realnie 100–300 KB raw mniej.

### 1.4. Selektywne importy Three.js (zamiast `import * as THREE`)

**Co:** W 13 plikach (`src/app/widgets/Visualizer/*.js`, `src/app/lib/three/*.js`) jest `import * as THREE from 'three'`.
**Dlaczego:** Three od r113+ wspiera ESM tree-shaking. Pełny import zmusza webpack do trzymania całego namespace — także loaderów których nie używasz.

Twoja wersja: `three ~0.103.0` — **stara, sprzed obsługi modułów ESM**. Tree-shaking nie zadziała bez bumpa.

**Jak (dwa kroki):**
1. **Bump three** do >= 0.150 (najlepiej najnowsza minor zgodna z React 15.6 — nie ma takiego ograniczenia po stronie Three, więc po prostu najnowsza). Test: czy `STLLoader`, `TrackballControls`, `CombinedCamera` w `src/app/lib/three/` są lokalnymi forkami → tak są, więc dostosujesz je do nowego API trójki (mała robota, głównie zmiany importów).
2. **Zamień importy:**
   ```js
   // przed:
   import * as THREE from 'three';
   const mesh = new THREE.Mesh(geo, mat);

   // po:
   import { Mesh, BufferGeometry, MeshBasicMaterial, Scene, ... } from 'three';
   const mesh = new Mesh(geo, mat);
   ```

**Zysk:** Po tym + lazy load Visualizera oczekiwany rozmiar Visualizer chunk: ~200 KB raw → ~60 KB gzip (z ~600 KB).

**Ryzyko:** średnie — `CombinedCamera` został usunięty z core Three lata temu. Musisz albo trzymać własną kopię, albo przerobić logikę kamery na `OrthographicCamera`/`PerspectiveCamera` + ręczne przełączanie. To kilka godzin pracy.

---

## P2 — Lżejsze zależności (1 dzień)

### 2.1. moment.js → date-fns lub dayjs

**Co:** `moment` (~250 KB raw, ~70 KB gzip) używany w 8 miejscach.
**Dlaczego:** Moment jest mutowalny, ciężki, lokale są problemem (już teraz ładujesz je bundle-loaderem — niezły hack). `date-fns` (tree-shake'owalny) lub `dayjs` (~7 KB) są dużo lżejsze.
**Jak:**
- Najprościej: `dayjs` — API niemal kompatybilne z moment, niewielka migracja.
- Lepiej długoterminowo: `date-fns` v3 — w pełni tree-shake'owalne, idiomatyczne.

Miejsca do zmiany:
- `src/app/index.jsx:4` (i logika ładowania locales linia 90 — usuń bundle-loader/moment-locale hack)
- `src/app/components/DatePicker/DateTimeRangePickerDropdown/index.jsx`
- `src/app/containers/Settings/*/TableRecords.jsx` (3 pliki)
- `src/app/containers/Settings/About/UpdateStatusContainer.jsx`
- `src/app/widgets/GCode/GCodeStats.jsx`
- `src/app/widgets/Visualizer/renderer.jsx`

**Zysk:** −60 KB gzip z bundla, +krótszy start (mniej kodu do parse'owania na Pi-przeglądarce — relevantne na słabych klientach typu Pi headless display).

### 2.2. Lodash — cherry-pick i upewnij się że babel-plugin-lodash robi swoje

**Co:** 12 plików ma `import _ from 'lodash'` — pełny import. Jest skonfigurowany `babel-plugin-lodash` w `babel.config.js:4`, który **powinien** to przepisywać na cherry-picks, ale jest fragile (nie radzi sobie z dynamicznymi dostępami typu `_['get']`).
**Dlaczego:** Cherry-pick (`import get from 'lodash/get'`) jest deterministyczny i nie zależy od plugin'u.
**Jak:**
- Plików jest 12, w większości używają 2–4 funkcji lodasha — można je przepisać ręcznie w godzinę.
- Sprawdź `src/app/lib/immutable-store.js` — może najwięcej tu lodasha.
- Wzorzec zmiany:
  ```js
  // przed:
  import _ from 'lodash';
  const x = _.get(obj, 'a.b');
  const y = _.map(arr, fn);

  // po:
  import get from 'lodash/get';
  import map from 'lodash/map';
  const x = get(obj, 'a.b');
  const y = map(arr, fn);
  ```

**Zysk:** Po dobrze zrobionym cherry-picku możesz usunąć `babel-plugin-lodash` (mniej pracy babela) i mieć przewidywalny bundle. Realnie 20–40 KB gzip mniej.

### 2.3. Usuń `jimp` z deps frontu

**Co:** `jimp ^0.10.3` w głównym `package.json:60` — **nie używany nigdzie w `src/app/`**.
**Dlaczego:** Jimp to ogromna biblioteka (~5 MB raw). Webpack ją wciąga jeśli gdzieś jest `require`/`import` — sprawdź czy nie zostaje w bundlu (możliwe że nie, jeśli nikt nie importuje, ale i tak warto wyczyścić).
**Jak:** `yarn remove jimp`. Jeśli build prod nadal działa — gotowe.

**Zysk:** Higiena. Jeśli jakimś cudem jimp jest w bundlu — gigantyczna oszczędność.

### 2.4. Font Awesome — subset zamiast pełnego pakietu

**Co:** `font-awesome 4.7.0` importowany w `src/app/styles/font-awesome.styl` i `vendor.styl`. Cały zestaw ikon = ~2 MB w fontach (`.woff2`, `.ttf`, `.eot`, `.svg`).
**Dlaczego:** Realnie używasz < 100 ikon z 600+.
**Jak (trzy opcje, malejący wysiłek):**
1. **Najlepiej:** Migracja na `react-icons` z dymem tree-shake'owym (każda ikona to oddzielny komponent). Nie ładujesz fontów w ogóle.
2. **Szybko:** `fontawesome-subset` (CLI) — generuje subset font-awesome tylko z używanymi ikonami. Wskazujesz listę nazw ikon (`['cog', 'play', 'pause', ...]`), narzędzie tworzy mniejsze pliki font.
3. **Najszybciej:** Inline SVG dla 5–10 najczęściej używanych ikon, reszta zostaje.

**Zysk:** −1.5 MB z `dist/` (assety, nie bundle JS). Pierwszy load ogromnie szybszy.

### 2.5. xterm 3.0.2 — zastanów się czy potrzebny

**Co:** `xterm 3.0.2` (stara wersja) używany **tylko** w `src/app/widgets/Console/Terminal.jsx` (klasyczny widget Console).
**Dlaczego:** Twój ControlDeck ma własny `ConsolePanel.jsx` (635 bajtów — pewnie wrapper). Jeśli ControlDeck.Console ma własny terminal albo nie używa xterm — możesz wywalić xterm.
**Jak:** Sprawdź czy `ConsolePanel.jsx` w ControlDeck używa `widgets/Console/Terminal` (xterm) czy ma własną prostą logikę console. Jeśli to drugie — i Workspace.jsx też jest planowany do usunięcia (1.3) — `yarn remove xterm`.

**Zysk:** ~100 KB raw, ~30 KB gzip.

### 2.6. Bootstrap 3.3.7 + react-bootstrap + styled-components + @trendmicro/react-* + normalize.css

**Co:** 5 nakładających się stacków UI/CSS naraz: stary Bootstrap 3, react-bootstrap (też trzyma Bootstrap), 22 paczki `@trendmicro/react-*`, styled-components, normalize.css.
**Dlaczego:** ControlDeck pewnie używa jednej–dwóch z nich. Reszta wisi przez klasyczne widgety/containery.
**Jak:** Mapping co używa czego — to projekt sam w sobie. Warto zrobić raz audyt:
```bash
grep -rln "from 'react-bootstrap'" src/app | wc -l
grep -rln "from 'styled-components'" src/app | wc -l
grep -rln "from '@trendmicro" src/app | wc -l
```
i zdecydować co utrzymujesz w nowym UI. To **najbardziej rozwojowe** zadanie z całej listy, ale długoterminowo największy zysk.

**Zysk:** Realnie 300–500 KB raw przy pełnym wyczyszczeniu. Ale wymaga rewriteu starych widgetów albo ich kasacji.

### 2.7. i18n — okroić liczbę języków w buildzie?

**Co:** `build.config.js` definiuje 17 języków. W `dist/cncjs/app/i18n/` lądują wszystkie.
**Dlaczego:** Jeśli celujesz w polski, angielski + 2–3 inne — reszta to dead weight w `dist/i18n/`.
**Jak:** W `build.config.js` ogranicz listę do np. `['en', 'pl']` (musisz dodać `pl` jeśli go nie ma).

**Zysk:** ~200 KB w `dist/` (assets, ładowane on-demand przez `i18next-http-backend`, więc to bardziej higiena niż boost initial load).

**Uwaga:** Sprawdź czy lista języków nie wpływa też na `moment` locale chunks (`webpack.config.production.js:131` używa `buildConfig.languages` w `ContextReplacementPlugin`). Zmniejszenie listy automatycznie obetnie też moment locales — sprawdź czy `pl` istnieje w moment.

---

## P3 — Runtime: React i Socket.IO (pomiar najpierw)

### 3.1. PureComponent / shouldComponentUpdate w hot ścieżkach

**Co:** React 15.6 — nie ma hooków, nie ma `React.memo`. Optymalizacja przez `extends PureComponent` lub własny `shouldComponentUpdate`.
**Dlaczego:** ControlDeck panele rerenderują przy każdym evencie Socket.IO (`controller:state`, `sender:status` lecą wiele razy na sekundę gdy maszyna pracuje). Jeśli panel rerenderuje pełną hierarchię — Pi-przeglądarka (np. tablet jako HMI) zacznie się dławić.
**Jak:**
- Audyt: w `ControlDeck.jsx` widzę `class ControlDeck extends PureComponent` — dobrze, masz to.
- Sprawdź panele (`AxesPanel`, `JogPanel`, `StatusMonitors`, `JobStatusPanel`) — czy wszystkie są `PureComponent`?
- Uważaj na **inline objecty/funkcje w propsach** — niwelują `PureComponent`:
  ```jsx
  // Anti-pattern:
  <AxesPanel config={{ a: 1 }} onClick={() => doX()} />
  // Lepiej:
  <AxesPanel config={this.axesConfig} onClick={this.handleClick} />
  ```

**Zysk:** Realnie 30–60% mniej rerenderów w panelach które dostają stabilne dane. Mierz w React DevTools Profiler (na Chrome desktop, nie na Pi).

### 3.2. Throttle eventów Socket.IO przed setState

**Co:** Eventy `controller:state` / `sender:status` mogą lecieć z częstotliwością 10+ Hz z serwera.
**Dlaczego:** Każdy event = `setState` = potencjalny rerender. Na Pi-przeglądarce (tablet) to widać.
**Jak:** Dodaj throttle na warstwie kontrolera (`app/lib/controller.js`):
```js
import throttle from 'lodash/throttle';

// Zamiast emitować bezpośrednio:
const emitState = throttle((state) => {
  pubsub.publish('controller:state', state);
}, 100); // 10 Hz cap
```

Albo na warstwie consumer'a (w `ControlDeck`):
```js
constructor() {
  super();
  this._setStateThrottled = throttle((patch) => this.setState(patch), 100);
}
```

**Zysk:** Niezawodne 60 FPS UI nawet na słabych tabletach.

### 3.3. react-tiny-virtual-list dla długich list (jeśli używasz infinite-tree)

**Co:** `react-tiny-virtual-list` + `infinite-tree` + `react-infinite-tree` w deps.
**Dlaczego:** Jeśli wyświetlasz listy plików/komend/eventów >100 elementów, brak wirtualizacji zatka rendering.
**Jak:** Sprawdź `FilesPanel.jsx` — jeśli renderuje listę plików, użyj `react-tiny-virtual-list`.

**Zysk:** Liniowo zależne od długości list.

### 3.4. Konsola Console — bufor + virtual scroll

**Co:** `ConsolePanel` ma autoscroll (Twój ostatni commit `6b3d94c9`). Bez ograniczenia bufora — przy długiej sesji terminala rośnie do MB tekstu w DOM.
**Dlaczego:** Pi-przeglądarka zamuli się przy >5000 linii.
**Jak:** Trim bufora do np. 2000 ostatnich linii, virtual scroll albo zwykły `slice` po stronie state.

---

## P4 — Serwer i Node runtime na Pi

### 4.1. NODE_OPTIONS dla małej pamięci

**Co:** Node domyślnie alokuje ~1.5 GB heap; Pi 3B+ ma 1 GB RAM.
**Jak:** W skrypcie startowym (systemd unit albo `package.json`):
```bash
NODE_OPTIONS="--max-old-space-size=512" cncjs ...
```
512 MB heap to bezpieczny limit dla Pi 3B+. Dla Pi 4 (2-8 GB) — niepotrzebne.

### 4.2. Systemd service + log rotation

**Co:** Zamiast `screen`/`tmux`/`pm2` — natywny systemd.
**Jak:** Plik `/etc/systemd/system/cncjs.service`:
```ini
[Unit]
Description=CNCjs
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/cncjs
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=512
ExecStart=/usr/bin/node /home/pi/cncjs/bin/cncjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```
Logi przez `journald` ma wbudowany rotation; nie zapchasz karty SD.

### 4.3. Disable analytics (Google Analytics 4)

**Co:** `react-ga4` + `TRACKING_ID: 'G-XH4RNS6QM9'` w `build.config.js`. Pi-instancja w stand-alone (warsztat bez internetu) i tak nie dotrze do GA, ale wisi w bundlu.
**Jak:** W `build.config.js` ustaw `analytics: { trackingId: '' }` (lub usuń import `react-ga4` z `index.jsx`). W Twoim forku nie potrzebujesz analityki.

**Zysk:** −15 KB gzip + brak prób fetch'a do Google z Pi (oszczędność na timeoutach przy offline).

### 4.4. HTTP/2 lub HTTP/1.1 keep-alive — sprawdź konfigurację

**Co:** `webappengine` (deps) prawdopodobnie używa Express HTTP/1.1.
**Dlaczego:** HTTP/2 multiplexuje requesty na jednym połączeniu — przy 10–30 plikach assetów (po split chunks) różnica jest realna.
**Jak:** Jeśli front-endujesz Pi przez nginx — łatwo (nginx → HTTP/2 → Pi:8000 HTTP/1.1). Jeśli Pi serwuje bezpośrednio — trzeba albo TLS + http2 (Express z trickami), albo zaakceptować HTTP/1.1 + keep-alive (jest default).

**Zysk:** Marginalny przy keep-alive; sensowny dopiero przy >20 plikach (czyli po split chunks).

### 4.5. Wyłącz nieużywane endpointy serwera

**Co:** `src/server/` ma routes do Settings/UserAccounts/Events. Jeśli używasz prosto (single user na warsztacie) — JWT, sessions, user management = balast.
**Dlaczego:** Mniej kodu w runtime → mniej RAM. Mniej ścieżek → mniej powierzchni ataku (Pi w warsztacie może być na publicznym WiFi).
**Jak:** To agresywne i może zepsuć funkcjonalność — zostaw na koniec. Najpierw zmierz `pmap $(pgrep node)` na Pi przed i po.

### 4.6. Pi-specific: tmpfs dla logów + tmp

**Co:** Karta SD znosi ~100k cykli zapisu. Logi cncjs lecą na dysk.
**Jak:** Zamontuj `/var/log/cncjs/` i `/tmp` jako tmpfs w `/etc/fstab`. Sesje (`session-file-store`) — pomyśl, przechowywane w pamięci czy w pliku.

---

## P5 — Sieć i caching klienta

### 5.1. Service Worker (offline + agresywny cache)

**Co:** Brak SW.
**Dlaczego:** Pi w warsztacie często bez stabilnego internetu — SW pozwala UI działać offline po pierwszym załadowaniu. Również: drugi load = instant (z cache).
**Jak:** `workbox-webpack-plugin` w `webpack.config.production.js`. Konfiguracja: cache-first dla `vendor.*.js` (hashowane), network-first dla `index.html`.

```js
const { GenerateSW } = require('workbox-webpack-plugin');

plugins: [
  ...,
  new GenerateSW({
    clientsClaim: true,
    skipWaiting: true,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  }),
],
```

W `index.hbs` zarejestruj SW. Pamiętaj o `/sw.js` route w serwerze (musi być serwowany z root, nie z `publicPath`).

**Ryzyko:** SW + i18next-http-backend wymagają uwagi (cache locales osobno).
**Zysk:** Drugie wejście = <100 ms. Offline = działa.

### 5.2. Cache-Control: `immutable` dla zhashowanych assetów

**Co:** Webpack emituje pliki z hashem w nazwie (`main.<hash>.bundle.js`). Cache lifetime ustawiony na rok (`maxAge` w `settings.production.js:14`). Brakuje `immutable`.
**Dlaczego:** Bez `immutable` przeglądarka i tak rewaliduje przy `Cmd+R` (304). Z `immutable` — pomija request.
**Jak:** Patrz `src/server/app.js:194-197`:
```js
app.use(route, serveStatic(asset.path, {
  maxAge: asset.maxAge,
  immutable: true, // dodaj
}));
```
Tylko dla katalogów z hashowanymi assetami (`/app/`), nie dla `index.html`.

**Zysk:** Mikrooszczędność na każdym refresh'u — sumarycznie ważne dla ux.

---

## P6 — Pomiary i sanity checks

### 6.1. Bundle analyzer

Dodaj `webpack-bundle-analyzer` jako devDep:
```bash
yarn add -D webpack-bundle-analyzer
```

W `webpack.config.production.js` warunkowo:
```js
if (process.env.ANALYZE) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
  module.exports.plugins.push(new BundleAnalyzerPlugin());
}
```

Odpalanie: `ANALYZE=1 yarn build`. To pokaże dokładnie co waży ile.

### 6.2. source-map-explorer

Alternatywa — bardziej szczegółowa, per-funkcja:
```bash
yarn add -D source-map-explorer
npx source-map-explorer dist/cncjs/app/main.*.bundle.js
```

### 6.3. Lighthouse na Pi

Otwórz UI z Pi w Chrome, zrób Lighthouse. Mierz:
- **TTI (Time to Interactive)** — cel < 3 s na LAN
- **LCP (Largest Contentful Paint)** — cel < 2 s
- **Total Blocking Time** — cel < 200 ms

Powtarzaj po każdej fali zmian — bez liczb robisz to na ślepo.

### 6.4. Pomiary Pi: `pmap`, `htop`, `iostat`

```bash
# RAM Node.js:
pmap -x $(pgrep -f cncjs) | tail -1
# CPU/RAM live:
htop -p $(pgrep -f cncjs)
# I/O karty SD (jeśli widzisz lag):
iostat -x 1
```

Zapisuj baseline przed zmianami.

---

## Kolejność rekomendowana

Jeśli masz pół weekendu — w tej kolejności, maksymalny zysk per godzina pracy:

1. **P0.1 + P0.2** (15 min): `devtool: false`, ESLint out → szybszy build.
2. **P0.3** (1h): splitChunks + TerserPlugin + drop_console → ~30% mniej initial JS, cache vendora.
3. **P0.4** (30 min): CompressionPlugin + express-static-gzip → CPU Pi odciążone.
4. **P1.1** (1–2h): Lazy Visualizer → −150 KB gzip z initial.
5. **P4.3** (10 min): Wyłącz GA → −15 KB + brak fetch'ów do internetu.
6. **P2.3** (5 min): `yarn remove jimp` → higiena.
7. **P6.1** (15 min): Bundle analyzer → mierz dalsze decyzje na liczbach.
8. **P4.1 + P4.2** (1h): Pi-side systemd + NODE_OPTIONS → stabilność na słabym Pi.
9. **P2.1** (3h): moment → date-fns → −60 KB gzip.
10. **P5.1** (3–4h): Service Worker → drugi load <100 ms.

Reszta (P1.3, P1.4, P2.4, P2.6) to większe projekty — rób je gdy masz dłuższy slot i zdecydowałeś że ControlDeck to docelowe UI.

---

## Czego **nie** robić

- **Nie rób upgrade'u React 15→18.** To wielodniowa migracja (hooki, contexty, lifecycles), wymusza upgrade `react-router`, `react-redux`, wszystkich `@trendmicro/*`. Nie warto dla optymalizacji — działający React 15.6 jest wystarczająco szybki.
- **Nie wymieniaj Stylus na Tailwind/CSS-in-JS.** Stylus z webpack już generuje minimalny CSS. Migracja to tygodnie.
- **Nie wprowadzaj TypeScript.** CLAUDE.md mówi „tylko JavaScript". TS nie wpływa na bundle size (transpile do JS).
- **Nie kompiluj UI na Pi.** Zawsze buduj na laptopie (`yarn build`), kopiuj `dist/` na Pi. Pi do buildu = wieczność i ryzyko OOM.

---

## Otwarte pytania do decyzji

> **Status:** Pyt. 1–4 odpowiedziane 2026-05-26 — patrz sekcja **„Decyzje" w nagłówku statusu**. Pyt. 5 otwarte ale niekrytyczne.

5. Czy UI jest oglądane z **laptopa/tabletu/telefonu** czy z displayu podłączonego do Pi (Chromium na Pi)? Drugie = front też obciąża Pi CPU, wszystkie optymalizacje frontu istotniejsze.

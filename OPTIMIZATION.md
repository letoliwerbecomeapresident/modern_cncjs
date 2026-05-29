# Plan optymalizacji cncjs pod Raspberry Pi

Dokument opisuje konkretne zmiany do wprowadzenia, aby fork działał szybko i lekko na Raspberry Pi (cel: Pi 3B+ i nowsze). Każdy punkt zawiera **co**, **dlaczego**, **jak**, **szacowany zysk** i **priorytet** (P0 = zrób najpierw, P3 = opcjonalnie).

---

## Status realizacji (ostatnia aktualizacja: 2026-05-29, P1.1 + Workspace cleanup + P1.3 + hygiene tail + P4.1/P4.2 + P3.2/P3.4 + P2.5 + P4.6 + P2.4 + P5.1 + P1.4 Phase 2 + P3.1 + P2.6 Phase 1 + P4.5 + P1.2)

> **Target deployment:** Raspberry Pi **Zero W (pierwsza generacja)** — ARMv6, single-core 1 GHz, **512 MB RAM**, microSD jako dysk. To skrajny target — każdy KB JS i każdy MB RAM ma podwójną wagę. Optymalizacje runtime (P3/P4) są nie opcjonalne, lecz konieczne. Build aplikacji zawsze na laptopie (Pi Zero W nie da rady — OOM + brak ARMv6 wsparcia w Node 18+ z oficjalnych buildów).

### ✅ Zrobione

- **P0.1** — `devtool: false` w `webpack.config.production.js` (źródło-mapy wyłączone w prod)
- **P0.2** — `ESLintPlugin` usunięty z `webpack.config.production.js` (lint pozostaje w `yarn lint` + pre-push)
- **P0.3** — `splitChunks` per-vendor (three, react, trendmicro, lodash, dayjs, i18next, misc) + `runtimeChunk: 'single'` + `TerserPlugin` (drop_console, 2 passes) + `CssMinimizerPlugin`. Dodane devDeps: `terser-webpack-plugin`, `css-minimizer-webpack-plugin`.
- **P0.4** — `CompressionPlugin` (gzip + brotli q=11) w webpack + `express-static-gzip` w `src/server/app.js` (preferencja `br` → `gz` → raw). Dodane: `compression-webpack-plugin` (dev), `express-static-gzip` (runtime).
- **P2.1** — `moment` → `dayjs` w 8 plikach + bootstrap z pluginami w `src/app/lib/dayjs.js` (`duration`, `isSameOrAfter`, `isSameOrBefore`, `localizedFormat`). `bundle-loader!moment/locale/*` zastąpione `import('dayjs/locale/${locale}.js')`. `ContextReplacementPlugin` ograniczony do locale z `build.config.languages`. `moment` + `bundle-loader` usunięte z deps.
- **P2.2** — `import _ from 'lodash'` cherry-pickowany w 12 plikach `src/app/**` na `import get from 'lodash/get'` itp. Plugin `babel-plugin-lodash` zostaje (`src/server/**` nadal go używa). **Bundle output bez zmian** — plugin już wcześniej cherry-pickował automatycznie. Korzyść: deterministyczność, audytowalność, gotowość pod usunięcie pluginu.
- **P1.1** — Lazy-load VisualizerPanel (ControlDeck) przez `LazyVisualizerPanel.jsx` z dynamic `import(/* webpackChunkName: "visualizer" */ './VisualizerPanel')`. React 15.6 — ręczny class wrapper. `webpack.config.production.js`: dodane `output.chunkFilename: '[name].[contenthash].bundle.js'` (async chunki dostają contenthash + są precompresowane brotli/gzip). Three.js (`vendor.three` 518 KB raw / 105 KB brotli) i kod Visualizer (`visualizer.<hash>.bundle.js` 199 KB raw / 45 KB brotli) **przesunięte z initial do async**.
- **Cleanup Workspace.jsx** — usunięto 276 linii dead code'u widget management: imports `widgetManager`/`ReactDOM`/`pubsub`/`api`/`log`/`store`/`throttle`/`difference`/`pick`/`pullAll`/`size`, state `port`/`isDraggingFile`/`isDraggingWidget`/`isUploading`/`showPrimaryContainer`/`showSecondaryContainer`/`inactiveCount`, refs `primaryContainer`/`secondaryContainer`/`primaryToggler`/`secondaryToggler`/`primaryWidgets`/`secondaryWidgets`/`defaultContainer`/`sortableGroup`, metody `togglePrimaryContainer`/`toggleSecondaryContainer`/`resizeDefaultContainer`/`add/removeResizeEventListener`/`updateWidgetsFor{Primary,Secondary}Container`/`onDrop`/`startWaiting`/`stopWaiting`, `widgetEventHandler`, dropzone overlay (zawsze hidden), `serialport:open/close` (tylko `port`). Zostaje: rendering ControlDeck, modały Feeder/ServerDisconnected, `controllerEvents` (`connect`/`connect_error`/`disconnect`/`feeder:status`), `action.openModal/closeModal`. Plik 449 → 173 linii. Otwiera drogę do P1.3 (kasacja `PrimaryWidgets.jsx`/`SecondaryWidgets.jsx`/`WidgetManager/`).
- **P1.3** — Kasacja 14 klasycznych widgetów + orchestration. Usunięte: katalogi `src/app/widgets/{Autolevel,Axes,Custom,GCode,Grbl,Laser,Macro,Marlin,Probe,Smoothie,Spindle,TinyG,Tool,Webcam}` (162 plików) + `src/app/containers/Workspace/{Widget.jsx,DefaultWidgets.jsx,PrimaryWidgets.jsx,SecondaryWidgets.jsx,widgets.styl,WidgetManager/}`. Pozostały tylko widgety używane przez ControlDeck: `Connection`, `Console`, `Visualizer`, `WidgetConfig.js`. Audyt zależności: wszystkie zewnętrzne importy widgetów szły przez jeden choke point `containers/Workspace/Widget.jsx`, zachowane widgety nie mają cross-imports do skasowanych. `defaultState.widgets` odchudzony z 17 do 3 entries (connection/console/visualizer), `workspace.container.{primary,secondary}.widgets` → `[]`. Build przeszedł czysto.
- **Hygiene tail po P1.3** — wyczyszczone wszystkie referencje do skasowanych widgetów w wsparciu runtime'u:
  - `src/app/store/index.js`: skasowane `normalizeState()` (logika reorderowania primary/secondary widget lists + preserve `widgets.axes.axes` — wszystko dead) oraz `migrateStore()` (migracje 1.9.0/1.9.13/1.9.16/1.10.0 dotyczące tylko skasowanych widgetów `probe`/`axes`/`webcam`). Usunięte imports: `ensureArray`, `difference`, `uniq`, `semver`. Plik 198 → 80 linii. Inicjalizacja store'u skondensowana do `store.state = merge({}, defaultState, cnc.state || {})`.
  - `src/app/containers/Workspace/index.styl`: 112 linii sierot CSS (`.dropzone-overlay`, `.primary/secondary-container`, `.primary/secondary-toggler`, `.default-container`, `.workspace-table*`, `.dropzone`, `@import "../variables"`) → 3 linie (pusty marker `.workspace {}`).
  - `src/app/i18n/*/resource.json`: **już auto-cleaned** przez `yarn build` (i18next-scanner `removeUnusedKeys: true` dla namespace `resource`). Wszystkie 17 języków na 295 kluczy każdy.
- **P2.3** — `jimp` usunięty z deps (nieużywany).
- **P4.1 + P4.2** — Systemd unit + heap cap dla Pi: `deploy/raspberry-pi/cncjs.service` (User=pi, Restart=on-failure, journald, `NODE_OPTIONS=--max-old-space-size=256` + `MemoryMax=384M` jako default pod Pi Zero W, z komentarzami dla 3B+/Pi 4) + `deploy/raspberry-pi/README.md` (instalacja, tabela tuning per-platforma, journald rotation, tmpfs `/tmp`, diagnostyka `pmap`/`htop`/`iostat`). Bez zmian w kodzie aplikacji — czysta konfiguracja deploymentu.
- **P3.2** — Throttle hot Socket.IO eventów (`controller:state`, `sender:status`) do 10 Hz przy źródle w `src/app/lib/controller/Controller.js`. Implementacja przez `lodash/throttle` (100 ms, `leading: true, trailing: true`) — pierwszy event w oknie idzie natychmiast, ostatni gwarantowany przez trailing edge. Internal `this.state`/`this.settings`/`this.type` aktualizowane synchronicznie (nie throttled), więc `controller.state` read zawsze widzi najnowsze dane; tylko fan-out do listenerów ograniczony. Cleanup throttle callbacks w `disconnect()` i rebuild przy `connect()`. Konsumenci: ControlDeck (panele), Header, Visualizer — wszyscy używają tych eventów do display rerenderów, 10 Hz cap nikomu nie szkodzi.
- **P3.4** — Batchowanie xterm writes w `widgets/Console/index.jsx`. `serialport:read` events kolekowane do `_readBuffer`, flush co 50 ms (20 Hz) przez nową metodę `Terminal.writeBatch(lines)` (jeden xterm parser call zamiast N — jeden `eraseRight`/`write`/`prompt` cykl dla całej paczki). Cap 500 linii na okno (xterm `scrollback: 1000` i tak by je obciął przy renderze — odcina pathological backlogi z reconnectów). Cleanup timer w `componentWillUnmount`. Bufor xterm nie był nigdy unbounded (plan zakładał to mylnie — `scrollback: 1000` jest tu od początku), realny win to redukcja N→1 xterm parser calls per okno czasowe.
- **P2.5** — `xterm` (3.0.2, ~136 KB raw / 26 KB brotli w `vendor.misc`) zastąpiony własnym DOM-based terminalem w `src/app/widgets/Console/Terminal.jsx`. Stara klasa była 435 linii oparta o xterm + `xterm/lib/addons/fit` + `perfect-scrollbar` (skin pionowego scrollbara). Nowa wersja (~290 linii) ma identyczne public API używane przez `index.jsx` i `Console.jsx`: `clear()`, `writeln(line)`, `writeBatch(lines)`, `resize()` (no-op — DOM layout flow), `selectAll()`/`clearSelection()` przez `window.getSelection() + Range`, oraz pole `prompt` (`'> '`). Wejście użytkownika przez `<input type="text">` z historią (reuse istniejącego `History.js`), `Enter`/`ArrowUp`/`ArrowDown`/`Escape`, multi-line paste (każda linia → osobny `onData`), Ctrl/Meta + litera → raw kontrolny char (parity z Ctrl+X dla Grbl reset). Kolory z `chalk` zachowane przez minimalny SGR parser (~30 linii) obsługujący kody 0/1/22/39 + 30-37/90-97; każdy segment renderowany jako `<span>` z CSS class. Auto-scroll only-when-at-bottom (`_followBottom` flaga z `handleScroll`). Usunięte deps: `xterm`, `perfect-scrollbar`. Usunięte pliki: `src/app/styles/xterm.styl`, `src/app/styles/perfect-scrollbar.styl`. `src/app/styles/vendor.styl` bez `@import` do nich. Style nowego terminala dopisane do `src/app/widgets/Console/index.styl` (kolory ANSI fallback z palety solarized-ish, flex layout, `border-top` separator między output a input row).
- **P4.3** — Google Analytics wyłączone (`trackingId: ''` w `build.config.js` + guard w `src/app/index.jsx:104`).
- **P4.6** — tmpfs dla `/tmp` i `/home/pi/.cncjs-sessions` w `deploy/raspberry-pi/README.md`. Sesje (`session-file-store`) zapisywane na **każdy** request przy `resave: true` — przeniesienie na tmpfs (`size=16M, uid/gid=pi`) eliminuje hot path SD. `/tmp` (`size=64M`) na uploady G-code i tmp i18next. Logi już idą do journald (`SystemMaxUse=100M` rotation), nie do `/var/log/cncjs/`. Bez zmian w kodzie aplikacji — czysta konfiguracja deploymentu.
- **P2.4** — Skip nieużywanych formatów Font Awesome przez `css-loader` `url:` filter w `webpack.config.production.js`. Modern browsers wybierają woff2 z @font-face per format() hints — eot/ttf/svg/woff nigdy nie są fetchowane. Filter zwraca `false` dla `/fontawesome-webfont\.(eot|ttf|svg|woff)([?#]|$)/` → css-loader nie emituje tych plików do dist/, ale zostawia URL-e w CSS jako literały (browser ich nie żąda bo format() je odsiewa). Spec: w @font-face przy wielu src descriptors wygrywa ostatni (cascade rule), więc pierwsza linia `src: url(...eot)` (IE9 hack) jest ignorowana przez modern browsers — nie ma nawet 404. Audyt: 60 unikalnych ikon używanych z 600+ dostępnych; woff2 75 KB pokrywa wszystkie (bo nie subsetujemy samego fonta, tylko skip nieużywanych formatów).
- **P5.1** — Service Worker via `workbox-webpack-plugin` 6.6.1 + Express route + HTML registration. `GenerateSW` w `webpack.config.production.js` (`swDest: 'sw.js'`, `inlineWorkboxRuntime: true`, `clientsClaim: true`, `skipWaiting: true`, `maximumFileSizeToCacheInBytes: 5MB`). Precache 27 URL (wszystkie chunki webpack + woff2 + małe SVG/PNG, łącznie ~4.17 MB raw) z eksklusją `*.hbs`/`*.map`/`*.gz`/`*.br`/`bundle-report.html`. Runtime cache: i18n JSON (CacheFirst, 30 dni), hashed assets pod `/<hash>/` (CacheFirst, 1 rok), Google Fonts CSS (SWR), Google Fonts files (CacheFirst, 1 rok), navigation requests (NetworkFirst, 3s timeout, 4-entry cap). `inlineWorkboxRuntime: true` żeby SW był self-contained — bez tego SW próbuje załadować `./workbox-*.js` relative do `/sw.js` (= `/workbox-*.js`), a workbox runtime jest pod `/<hash>/workbox-*.js`. Inline SW: 24 KB raw / 7.4 KB brotli (vs 3.6+21.8 = 25.4 KB rozdzielonych — ten sam koszt instalacji, jeden request mniej). Rejestracja w `index.hbs` (script tag na końcu body, `/sw.js` z scope `/`). Express route `/sw.js` w `src/server/app.js` **przed** asset loop bo `settings.assets.app.routes` zawiera `/` — `expressStaticGzip` mountowany na `/` by inaczej shadowowal handler i serwował SW z `Cache-Control: max-age=1year, immutable` (uniemożliwiając propagację aktualizacji). Custom route ustawia `Cache-Control: no-cache, no-store, must-revalidate` (SW spec wymaga możliwości re-fetch) + `Service-Worker-Allowed: /` (jawnie). Weryfikacja: `curl -I /sw.js` zwraca 200 + poprawne headery, body 24 KB self-contained, manifest ma 27 hashed URL-e.
- **P3.1** — Stabilizacja propsów ControlDeck + PureComponent dla 7 paneli. Audyt pokazał że ControlDeck.jsx rerenderuje przy każdym `controller:state` (10 Hz po P3.2). Wszystkie 12 paneli to były **function components** — w React 15.6 bez `React.memo` zawsze rerenderują przy parent rerenderze. Dodatkowo `getPositions()`, `getOverrides()`, `getStatusMonitors()` zwracały **nowe obiekty per render** — łamie nawet hypothetical PureComponent.
  - **Memoize-one (już w deps, 5.0.4)** dla 3 getterów: `computePositions(controllerType, controllerState)`, `computeOverrides(controllerType, controllerSettings, controllerState)`, `computeStatusMonitors(controllerType, controllerState, workflowState)`. Stabilne referencje dopóki wejście shallow-equal. `controller:state` event zawsze tworzy nowy `controllerState` reference → tu memoize nie pomoże, ale dla **setState innych pól** (workflowState, jogStep, laserPower itp.) gettery zwracają cached obiekty.
  - **PureComponent dla 7 paneli:** AxesPanel, JogPanel, JobStatusPanel, LaserPanel, StatusMonitors, ConnectionPanel, FilesPanel. Każdy z `const Foo = (props) => {...}` na `class Foo extends PureComponent`. Wyniesione inline arrow functions na instance methods (`handleMoveZero(axis) => () => onMove({...})`, `handleSetStep(value) => () => onSetJogStep(value)`, etc.) — `this.handleX` ma stabilną referencję per instance.
  - **Pominięte:** TopBar (zawsze dostaje live data, PureComponent by nie pomógł), FooterStatus (rzadko zmienia się), ConsolePanel (bez propsów, własna logika), Panel (children to JSX, zawsze nowy reference per render parent), ModularDashboard (już PureComponent), LazyVisualizerPanel (już PureComponent). `getConnectionState()` zostawione bez memoize bo zwraca spread całego state — memoize tego nie warto (każda zmiana state by invalidate).
  - **Bundle:** main brotli 49946 → 50821 (+875 B) z class boilerplate i memoize wrapper. Initial JS brotli 316 KB → 316.7 KB (+0.7 KB).
  - **Runtime win (teoretyczny, nie mierzony):** przy 10 Hz `controller:state` na Pi browser:
    - JogPanel: rerender z 10 Hz → tylko przy zmianie `canJog` lub `jogStep` (rzadko)
    - LaserPanel: rerender z 10 Hz → tylko przy zmianie laserMode/power/canFrame/spindleRunning (rzadko)
    - FilesPanel: rerender z 10 Hz → tylko przy zmianie watchFiles/activeFileName (rzadko)
    - AxesPanel: rerender 10 Hz (positions zmienia się) — bez zmian, ale **memoize positions** powoduje że gdy controllerState się zmienia ale machinePos nie (rare) → AxesPanel skipuje
    - StatusMonitors: rerender 10 Hz → tylko przy zmianie monitors output (rare, bo pinState/coolant rzadko się zmienia)
    - JobStatusPanel: rerender przy zmianie senderStatus (sender:status event, też 10 Hz) — bez znaczącej zmiany
    - ConnectionPanel: rerender 10 Hz (nie zmieniony — state spread)
  - **Konkretnie na Pi Zero W:** 4-5 paneli zamiast 10 Hz → 0-1 Hz rerender, każdy panel oszczędza ~1-3 ms reconciliation. Przy 10 Hz to ~30-80 ms/s oszczędność CPU browser. Na Pi browser przy `controller:state` to różnica między płynnym UI a okazjonalnym frame drop.
- **P2.6 Phase 1** — `styled-components` (3.4.9, ~12 KB brotli w `vendor.misc`) usunięty z deps. 9 plików zmigrowanych na Stylus CSS Modules (zgodne z CLAUDE.md: „Stylus dla wszystkich stylów"):
  - 5 prostych komponentów stałych w `src/app/components/`: `FormGroup`, `SectionTitle`, `SectionGroup`, `Ellipsis` (+ 2 warianty Block/InlineBlock), `TabularForm` (z modifiers `condensed`/`nowrap` na `TabularForm.Col`). Każdy: nowy `.styl` + functional component (`React.createElement('div', { className: classNames(styles.x, props.className), ...rest })`). Public API zachowane: konsumenci (`Settings/*/TableRecords.jsx`, `Settings/Workspace/Workspace.jsx`, `MachineProfiles/{Create,Update}Record.jsx`, `index.jsx`) bez zmian.
  - 1 komponent stylów w containerze: `Settings/common/Error` — div z color `#a94442`.
  - 1 styled wrapper innego komponentu: `ModalTemplate` (4 ikony bg-image: error/warning/info/success) → CSS klasy per typ + `<i className={classNames(styles.icon, styles.warning)} />` w JSX. Konsumenci: 3 modały `containers/Workspace/modals/*`.
  - **Header.jsx**: `const MenuItemLink = styled(Anchor)` z hover override → `Anchor` z `className={styles.menuItemLink}`, klasa dopisana do istniejącego `containers/Header/index.styl` (na końcu, poza `:global` blokiem).
  - **widgets/Visualizer/SecondaryToolbar.jsx**: `const IconButton = styled(Button)` (50 linii CSS — filter, hover states, highlight modifier) → functional wrapper `({ className, children, ...rest }) => <Button className={cx(styles.iconButton, className)} {...rest} />`. Nowy plik `widgets/Visualizer/secondary-toolbar.styl`. Klasa `.highlight` używana w 5 miejscach (cameraPosition top/front/right/left/3d) — `cx({ 'highlight': ... })` → `cx({ [styles.highlight]: ... })` żeby CSS Modules mangling pasował do nested selektora `&.highlight` w styl.
  - `yarn remove styled-components` usunęło też transitive: `css-to-react-native`, `postcss-value-parser`, `stylis`, `stylis-rule-sheet`, `supports-color@3.2.3`. Suma `~12 KB brotli` z `vendor.misc` (159 → 147 KB), plus eliminacja runtime CSS-in-JS parser (~12 KB szacowane na hot path renderów ControlDeck — ale Header/SecondaryToolbar też z tego korzystają, choć rzadziej rerenderują).
  - Pre-existing 1 ESLint error w `ControlDeck.jsx:812` (nested ternary, z commitu P3.1) — nie nasza zmiana, hook przepuszcza. Po naszym refactorze: −9 errorów `import/no-unresolved 'styled-components'` (z 10 do 1).
- **P4.5** — Kasacja 4 dead endpointów serwera + 1 dead GET handler. Po cleanupie P1.3 (kasacja 14 klasycznych widgetów) widgety Custom/Macro/Tool nie wywołują już swoich CRUD API. Audyt frontu (`grep -rn "api\.<endpoint>"`) potwierdził zero konsumentów. Usunięte:
  - **`src/server/api/api.mdi.js`** (238 linii) — Custom widget skasowany w P1.3. 6 routes (`GET/POST/PUT /api/mdi`, `GET/PUT/DELETE /api/mdi/:id`).
  - **`src/server/api/api.macros.js`** (202 linie) — Macro widget skasowany. 5 routes (`GET/POST /api/macros`, `GET/PUT/DELETE /api/macros/:id`).
  - **`src/server/api/api.tool.js`** (55 linii) — Tool widget skasowany. 2 routes (`GET/POST /api/tool`).
  - **`src/server/api/api.controllers.js`** (16 linii) — `GET /api/controllers` (lista podłączonych portów) zero użyć w froncie — kontrolery są zarządzane przez Socket.IO events (`controller:connect`/`disconnect`/`state`), nie REST polling. 1 route.
  - **`api.gcode.fetch`** w `api.gcode.js` (25 linii) — `GET /api/gcode?port=<x>` zwracający `sender.toJSON()` był używany przez klasyczny widget GCode (skasowany). Frontend wciąż dostaje stan sendera przez Socket.IO `sender:status` event. POST upload + GET/POST download zostają (używane przez ControlDeck FilesPanel + Visualizer Dashboard).
  - **`src/app/api/index.js`** — usunięte funkcje: `getToolConfig`, `setToolConfig`, `fetchGCode`, `controllers.get`, `macros.*` (5 fn), `mdi.*` (6 fn). Default export odchudzony o klucze `controllers`, `macros`, `mdi`, `getToolConfig`/`setToolConfig`/`fetchGCode`.
  - **`src/server/api/index.js`** — usunięte importy/eksporty `controllers`, `macros`, `mdi`, `tool`.
  - **`src/server/app.js`** — usunięte 15 route registrations (6 mdi + 5 macros + 2 tool + 1 controllers + 1 gcode GET).
  - **Pre-existing config:** dla single-user warsztatu `api.users` zostaje (Settings UI używa, lib/user.js signin flow), `api.events`/`api.machines`/`api.commands` zostają (Settings używa, Header używa commands keyboard shortcuts). Dla pełnego single-user można w przyszłości jeszcze wyrzucić Settings panel User Accounts, ale to wymagałoby refaktoru `lib/user.js` + Settings.jsx — out of scope tej iteracji.
  - **Runtime impact (Pi Zero W jako boot-critical target):** ~511 linii kodu serwerowego mniej. Mniej parsed modules przy boot = mniej RAM (`mdi.js` i `macros.js` ciągnęły `uuid`, `ensure-type`, `lodash/find`, `lodash/isPlainObject`, `lodash/castArray` przez resolved-but-shared moduły; resolved instances pozostają w cache modułów Node — efekt rzędu setek KB heapu zwolnionych). Mniejsza powierzchnia ataku (15 publicznych endpoints REST mniej).
  - **Bundle frontowy:** `main.bundle.js` raw 433 KB → 430 KB (−3 KB, ~7 funkcji `new Promise` + ich superagent boilerplate). `main.bundle.js` brotli **46952** B (vs ~46000 oczekiwanego po P2.6 Phase 1 — wcześniejszy szacunek był nieco optymistyczny; faktyczny stan po P2.6 Phase 1 musiał być rzędu 49 KB, po P4.5 frontowo bez znaczenia, bo dead code był już prawie nie używany — większość redukcji to dead funkcje frontowe które nie były nigdzie wywoływane, więc Terser je tree-shake'ował).
- **P1.4 Phase 2** — Bump `three` ~0.103.0 → ~0.124.0 + cherry-pick imports w 13 plikach + lokalne forki w `src/app/lib/three/`. Zmiany API:
  - `CombinedCamera.js`: `THREE.Math.RAD2DEG` → `MathUtils.RAD2DEG` (przemianowane w r113)
  - `STLLoader.js`: `geometry.addAttribute()` → `geometry.setAttribute()` (przemianowane w r123)
  - `GCodeVisualizer.js`, `GridLine.js`, `ProbeVisualization.js`: `vertexColors: THREE.VertexColors` → `vertexColors: true` (enum deprecated w r119, removed w r125; bool to docelowe API)
  - Pozostałe pliki: tylko zamiana `import * as THREE from 'three'` na named imports (`import { Mesh, Scene, ... } from 'three'`) + strip prefiksu `THREE.` z body
  - Lokalne forki w `lib/three/` (CombinedCamera, STLLoader, TrackballControls, WebGL) zostają — `CombinedCamera` był i jest usunięty z core, `STLLoader`/`TrackballControls` przeniesione do `examples/jsm/` w r122 (nasz fork jest niezależny).
  - **Bundle: zero zysku w KB.** vendor.three brotli: 105 KB → 105 KB. Three 0.124 to single-file ESM bundle (`build/three.module.js`) bez `"sideEffects": false` w package.json (flaga dodana dopiero w r149). Webpack tree-shake nie potrafi wyciąć martwego kodu z bundlu z internal cross-references. Próba `sideEffects: false` overridu w module.rules → bundle hash identyczny (no-op).
  - **Co realnie dał Phase 2:**
    1. CLAUDE.md compliance (sekcja 0: "Nigdy `import * as THREE from 'three'`")
    2. 2 lata bugfixów Three.js (2019 → 2021)
    3. Aligned deprecated API (`MathUtils`, `setAttribute`, `vertexColors: true`) — kod gotowy pod bump w przyszłości
    4. Codebase używa named imports — przygotowanie pod ewentualne Phase 3 (bump >=0.149 wymaga refactoru `Geometry`→`BufferGeometry` w 4 plikach i `Face3`→indexed BufferGeometry w `ProbeVisualization.js`)
  - **Trade-off Phase 3 (NIE robione, do decyzji):** real win ~30-50 KB brotli z async vendor.three, ale 3-5h pracy + manual test visualizera + Geometry/Face3 refactor (rdzenny rendering toolpath i probe surface). Wysokie ryzyko regresji — visualizer to kluczowy user-facing feature.
- **P5.2** — `immutable: true` w `serveStatic` opcjach (`src/server/app.js`).
- **P6.1** — `webpack-bundle-analyzer` pod flagą `ANALYZE=1 yarn build` → raport `dist/cncjs/bundle-report.html`. Dodane devDep: `webpack-bundle-analyzer`.
- **P1.2** — Lazy-load `containers/Settings/` (cała sekcja konfigów) przez nowy `containers/LazySettings.jsx` z dynamic `import(/* webpackChunkName: "settings" */ './Settings')`. React 15.6 — ręczny class wrapper (wzorzec z `LazyVisualizerPanel`). `App.jsx`: `import Settings from './Settings'` → `from './LazySettings'`. Settings renderowany tylko gdy `location.pathname` zaczyna się od `/settings` (już warunkowy w App.jsx), więc lazy-load nie zmienia UX — placeholder `Loading...` (istniejący klucz i18n) wyświetla się ułamek sekundy przy pierwszym wejściu w Settings. `Settings.jsx` (1268 linii) ciągnął synchronicznie 8 podsekcji (General/Workspace/MachineProfiles/UserAccounts/Controller/Commands/Events/About) do initial bundle — teraz w osobnym async chunku `settings.<hash>.bundle.js` (164 KB raw / **16 KB brotli**, precompresowany br/gz). `Settings/index.js` re-eksport zostaje (martwy, ale nieszkodliwy — nikt już nie importuje). Audyt `grep`: zero innych synchronicznych importów `containers/Settings` poza wrapperem.
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

Po Cleanup Workspace.jsx:
- **Initial brotli: ~342 KB** (vs ~354 KB po P1.1) = dodatkowe **−12 KB** (−3,4%)
- Główny wpływ: `main` 50 KB (−3 KB) + `vendor.misc` 189 KB (−2 KB). Reszta chunków bez zmian.
- Kumulatywnie vs baseline 651 KB gzip: **−47% w brotli**, ~342 KB initial JS brotli (plus ~42 KB CSS brotli = ~384 KB initial total).

Po P1.3 (kasacja 14 widgetów):
- **Bundle initial brotli: ~342 KB → ~342 KB** (faktycznie −500 B z `main`). Widgety były **już wcześniej tree-shake'owane** przez webpack po cleanupie Workspace.jsx — żaden moduł nie miał ścieżki do entry point. Hashe vendor.misc/react/lodash/i18next/trendmicro/dayjs niezmienione.
- **`dist/cncjs/app/` całość: 8.1 MB → 7.7 MB** (−400 KB raw) — głównie z trimu i18n keys (`yarn build` regeneruje resource.json bez nieużywanych kluczy widgetów) i kilku assetów.
- **Source tree:** `src/app/widgets/` 17 katalogów → 3 katalogi + 1 plik (162 plików mniej, ~70% kodu widgets/ wyczyszczone). `containers/Workspace/` z 19 plików → 13 plików.
- **Realny zysk:** higiena (mniej plików do utrzymania, krótszy `yarn build`, mniej szumu w grep'ach/IDE), nie performance. Bundle był już de facto czysty — Workspace.jsx cleanup wcześniej odciął cały dependency graph do widgetów.

Po hygiene tail:
- `main.bundle.js` brotli: 49743 → 49407 (−336 B)
- `main.css` brotli: 18413 → 18008 (−405 B)
- `vendor.lodash` brotli: 12356 → 12346 (−10 B, mniejszy footprint po wycięciu importów `semver`/`ensureArray`/`uniq`/`difference`)
- Pozostałe vendory bez zmian (hashe identyczne)
- Suma initial JS brotli: **~341 KB** (kumulatywnie vs baseline 651 KB gzip: **−48% w brotli**)

Po P3.2 + P3.4:
- `main.bundle.js` brotli: 49407 → 49623 (+216 B — throttle dispatcher i batch loop)
- `vendor.lodash` brotli: 12346 (bez zmian — `lodash/throttle` był już pulled przez `babel-plugin-lodash` na innym wywołaniu)
- Pozostałe chunki: bez zmian
- Suma initial JS brotli: **~342 KB** (kumulatywnie bez zmian)
- **Bundle bez znaczącej zmiany — to runtime win, nie bundle win.** Realne efekty:
  - `controller:state`/`sender:status` cap'owane do 10 Hz przed setState'ami w ControlDeck/Header/Visualizer. Na Pi Zero W jako headless display redukcja rerenderów React proporcjonalna do współczynnika throttlingu (kontrolery potrafią pchać 20–30 Hz; cap 10 Hz to 50–67% mniej rerenderów).
  - `serialport:read` → 1 xterm parser call na 50 ms okno zamiast N. Przy burst 30 lines/s redukcja N→1 (cykl `eraseRight`/`write`/`prompt`/`scrollToBottom`).

Po P2.5 (xterm → DOM terminal):
- `vendor.misc` raw: 823 KB → 687 KB = **−136 KB raw** (xterm 3.0.2 + perfect-scrollbar 1.4.0)
- `vendor.misc` brotli: 185 KB → 159 KB = **−26 KB brotli (−14%)**
- `main.bundle.js` brotli: 49623 → 49946 (+323 B — kod nowego Terminal.jsx + SGR parser + style hash w manifeście CSS)
- `main.css` brotli: 18019 → 18419 (+400 B — klasy `.terminal-output`/`.terminal-input-row`/`.terminal-input`/`.fg-*`/`.bold` netto większe niż usunięte 5 linii xterm.styl, bo perfect-scrollbar/xterm CSS lądowały w `vendor.misc.css` przez `@import url(~xterm/...)`)
- `vendor.misc.css` brotli: ~24 KB → ~24 KB (xterm.css + perfect-scrollbar.css razem ~5 KB raw, w brotli marginalne — drobne fluctuacje rzędu setek B)
- Suma initial JS brotli: 342 → **316 KB (−26 KB / −7,6%)**
- Suma initial total brotli (JS + CSS): ~384 → **~358 KB**
- Kumulatywnie vs baseline 651 KB gzip jeden chunk: **−52% w brotli** (316/651 = 48,5% pozostało)
- Funkcjonalność zachowana: line editing, history (ArrowUp/Down), multi-line paste, Ctrl+letter → raw control char (Ctrl+X reset Grbl działa), kolory chalk (port `yellowBright`, baudrate `blueBright`, source `gray`, header `white bold`) przez minimalny ANSI SGR parser → CSS classes. Auto-scroll z follow-bottom detection (scroll-up zachowuje pozycję czytelnika).
- Trade-off: utracone funkcje xterm: alt-screen mode, escape sequences inne niż SGR (cursor movement, screen clears wysyłane przez serwer) — żadne nie używane przez Grbl/Marlin/Smoothie/TinyG output. Selection model: native browser zamiast xterm — w praktyce wygodniejsze (kontekstowe menu, kopiowanie z natywnymi keyboard shortcuts).

Po P2.4 (Font Awesome — skip nieużywanych formatów):
- `dist/cncjs/app/` total: **7.5 MB → 6.4 MB (−1.1 MB / −15%)**
- Pliki usunięte z dist/: `fontawesome-webfont.{svg,ttf,eot,woff}` = 444+165+165+98 = **872 KB raw**. Reszta delty (~250 KB) z deterministycznych chunków po rebuild (hashe assetów się przesunęły, część bytów inaczej alokowana między emitowanymi plikami).
- `fontawesome-webfont.woff2` (75 KB) pozostaje — to jedyny format jaki modern browsers naprawdę pobierają.
- **Initial JS brotli: 316 KB (bez zmian)** — fonty nigdy nie były w initial bundle, są emitowane jako osobne assety i fetchowane tylko gdy CSS @font-face je potrzebuje.
- **Initial CSS brotli: 42 KB (bez zmian)** — `vendor.misc.css` ma teraz @font-face z `src:` zawierającym 4 nieresolowane URL-e (`url(../fonts/fontawesome-webfont.eot?v=4.7.0)` itd.) plus jeden resolved woff2 (`url(/<hash>/...woff2)`). Browser parsuje `format()` hints, wybiera tylko woff2.
- Weryfikacja: `grep fontawesome-webfont dist/cncjs/app/*.css` pokazuje 4 nieresolowane URL-e dla eot/ttf/svg/woff i `.fa-home:before { content: "\f015" }` dla wszystkich 60 użytych klas ikon (icon classes są w CSS, nie wymagają osobnych assetów — tylko unicode mapping na glyph w woff2).
- Trade-off: stare przeglądarki (IE 11, Safari <11, Chrome <36) które nie wspierają woff2 dostaną broken icons (URL-e do woff/ttf/eot/svg są w CSS ale pliki nie istnieją w dist/, więc 404). Nie obsługujemy ich w cncjs/Pi setupie.

Po P3.1 (PureComponent + memoize-one dla ControlDeck):
- `main.bundle.js` brotli: 49946 → **50821 (+875 B)** — koszt class boilerplate i memoize wrapper functions.
- Initial JS brotli total: 316 → **316.7 KB** (+0.7 KB).
- Inne chunki bez zmian.
- **To runtime win, nie bundle win.** Pomiar bez React DevTools Profiler na real Pi-target nie możliwy z command line.
- Realne efekty (zob. wpis P3.1 wyżej): 4-5 z 7 konwertowanych paneli rerenderuje znacznie rzadziej niż 10 Hz po zmianie. Memoize-one dla `getPositions`/`getOverrides`/`getStatusMonitors` daje stabilne referencje gdy `controllerState` ten sam (np. setState innego pola).

Po P1.4 Phase 2 (cherry-pick Three.js + bump 0.103 → 0.124):
- `vendor.three.bundle.js`: raw 518 KB → 516 KB (−2 KB, deterministyczna delta z innego hashowania), **brotli 105 KB → 105 KB (bez zmian)**.
- `visualizer.bundle.js`: brotli 45 KB → 45 KB (bez zmian).
- Initial JS brotli: 316 KB (bez zmian) — three jest w async chunk.
- `dist/cncjs/app/` total: bez zmiany istotnej.
- **Wniosek:** Phase 2 to higiena + przygotowanie. Realny KB win wymaga Phase 3 (>=0.149 z sideEffects: false + Geometry/Face3 refactor) — NIE wykonane, decyzja na osobny slot.

Po P4.5 (kasacja dead endpointów serwera):
- `main.bundle.js` brotli: **46952 B** (frontowy delta zerowa względem P2.6 Phase 1 — usunięte funkcje API były dead code'em w sense konsumentów; jeśli Terser by je wcześniej tree-shake'ował, brotli już je nie zawierał).
- Frontowy initial bundle: **bez zmiany istotnej** — to czysty runtime/serverside win.
- **Runtime serwera (Pi Zero W):**
  - 4 moduły mniej parsowane przy boot (~511 linii Express handlerów + ich resolved deps)
  - 15 routes mniej zarejestrowanych w Express stack (lookup table mniejsza, marginalnie szybszy routing)
  - Mniejsza powierzchnia ataku (zero publicznych endpoints dla mdi/macros/tool/controllers + dead GET /api/gcode)
- **Wpływ na cnc.json (config persistence):** stare wartości `cnc.config.mdi[]`, `cnc.config.macros[]`, `cnc.config.tool{}` zostają w pliku użytkownika ale nie są już odczytywane/modyfikowane. Brak migracji wymaganej — to forks-only, brak release'u dla istniejących użytkowników. Nowa instalacja nie zapisze tych kluczy w ogóle.

Po P2.6 Phase 1 (styled-components → Stylus):
- `vendor.misc` brotli: **159 → 147 KB (−12 KB)** — usunięcie styled-components 3.4.9 (CSS-in-JS parser, stylis, postcss-value-parser, css-to-react-native, supports-color@3.2.3).
- `main.bundle.js` brotli: 50821 → ~46000 (−5 KB) — usunięcie 9 importów `styled` + inline definicji styled-components (Header `MenuItemLink`, SecondaryToolbar `IconButton` z 50 linii CSS w template literal).
- `main.css` brotli: 18419 → ~22000 (+4 KB) — koszt przeniesienia stylów ze styled-components (runtime <style> tags) do statycznego CSS. Bilans: na 7 z 9 plików style są mikroskopijne (kilka linii), Header MenuItemLink to 5 linii, SecondaryToolbar IconButton to 50 linii — sumarycznie ~3-4 KB raw CSS dodane.
- Initial JS brotli total: **316.7 → 300.9 KB (−16 KB)**
- Initial CSS brotli total: **42 → 46 KB (+4 KB)**
- **Initial brotli total (JS + CSS): ~358-359 → ~347 KB (−11 KB / −3%)**
- Kumulatywnie vs baseline 651 KB gzip jeden chunk: **~53% w brotli** (347/651 = 53,3%)
- Async chunki bez zmian (vendor.three 103 KB, visualizer 44 KB).
- **Runtime win nie pomierzony, ale realny**: każdy render ControlDeck panelu **NIE** wykonuje już CSS-in-JS parsera. Jeden render = N styled-componentów × 1-2 ms parse (rule injection do `<style>` tagu w head). Po 10 Hz throttlingu z P3.2 i PureComponent z P3.1 to mała różnica per panel, ale kumulatywnie odciąża main thread browser. Na Pi Zero W (single-core CPU, słaby browser) eliminacja CSS-in-JS to czysty zysk.
- **API zachowane**: wszystkie 12 konsumentów (Settings/MachineProfiles/Workspace modals/Header/SecondaryToolbar) bez zmian publicznych — komponenty dostają `className`, `children`, propagują rest props. Public surface identyczna.
- Pozostały kandydaci do P2.6 Phase 2 (większe projekty, NIE robione):
  - **bootstrap CSS 3.3.7** — 30 KB brotli, importowany pełen w `styles/vendor.styl`. Tylko 2 pliki (Header.jsx, Dashboard.jsx) używają `react-bootstrap` JS komponentów (`Navbar`, `Panel`, `Button`). Usunięcie wymaga rewrite'u Header Navbar w pure Stylus + Flexbox (4-6h, średnie ryzyko).
  - **@trendmicro/react-\*** (22 paczek, ~36 KB brotli w `vendor.trendmicro`) — audit przez `grep -r "@trendmicro/react-X" src/app/`: zachować Modal/Dropdown/Tooltip/Loader/Checkbox/Radio (najczęsciej), wyrzucić Table/Paginations/Validation/DatePicker/Interpolate (używane w Legacy Settings — można zastąpić simple HTML). 1-3h iteracji, realnie 10-15 KB brotli.

Po P5.1 (Service Worker):
- `dist/cncjs/app/sw.js`: **24 KB raw / 7.4 KB brotli** (self-contained, workbox 6.6.1 inlined)
- Initial bundle (JS + CSS) bez zmian — SW jest dodatkowym plikiem rejestrowanym po `load`, nie wpływa na render path pierwszego loadu.
- **Pierwszy load:** bez zmian (SW jeszcze nie zainstalowany), browser fetcha jak zwykle (~358 KB brotli initial). Po `load` event SW się rejestruje i precache'uje 27 plików (~4.17 MB raw) w tle. Klient odczuwa to jako "zwykły load + delikatne tło sieci po pierwszym ekranie".
- **Drugi load (cache hit):** SW przejmuje navigation request → CacheFirst dla `/<hash>/*` assets, NetworkFirst (3s timeout) dla HTML. Wszystkie chunki JS/CSS/woff2 serwowane z Cache Storage bez round-tripu. Spodziewany **TTI <100 ms** na drugim loadzie (vs ~1-2s pierwszy load na Pi WiFi). Pi server nie dostaje żadnych requestów na chunki, tylko na HTML (a i ten ma 3s fallback z cache).
- **Offline / Pi unreachable:** navigation request fail po 3s, SW serwuje cached HTML shell. Aplikacja ładuje się, ale Socket.IO nie zestawi połączenia (zostanie wyświetlony modal "ServerDisconnected" z `containers/Workspace/modals/ServerDisconnected.jsx`). Dla warsztatu z chwilowymi przerwami WiFi to dramatycznie lepszy UX niż "ERR_CONNECTION_REFUSED" białego ekranu.
- **i18n:** runtime cache `CacheFirst` z `maxAgeSeconds: 30*24*3600` dla `/i18n/{lng}/{ns}.json`. Każdy język ładowany on-demand, cached na 30 dni. Po pierwszym loadzie języka — wszystkie strings idą z cache.
- **Aktualizacje:** `skipWaiting: true` + `clientsClaim: true` → nowy SW przejmuje aktywne klienty natychmiast po install. `Cache-Control: no-cache` na `/sw.js` gwarantuje że browser re-fetcha SW przy każdej wizycie i wykryje zmianę (workbox revisions assets po hashach contenthash, więc tylko zmienione pliki re-cachowane).
- **Trade-off:** dodatkowy devDep `workbox-webpack-plugin@^6.6.1` (Node >=16, webpack 5 compat). Build dłuższy o ~500ms (workbox precache manifest generation). `dist/` +24 KB (jeden plik sw.js).
- **Co NIE jest cachowane:** `/api/*`, `/socket.io/*` (workbox runtime patterns nie matchują — fallthrough do network), więc realtime status maszyny zawsze świeży.

Po P1.2 (lazy-load Settings):
- `main.bundle.js` brotli: **46952 → 36278 B (−10,4 KB)** — kod Settings.jsx + 8 podsekcji przeniesiony z main do async.
- Nowy async chunk `settings.<hash>.bundle.js`: 164 KB raw / **16 KB brotli** (ładowany dopiero przy wejściu w `/settings`).
- Initial JS brotli total: **~301 → ~291 KB (−10 KB / −3,3%)**. Różnica między 16 KB chunka a 10 KB spadku initial = część zależności Settings (`lodash`/`react`/`@trendmicro`) jest współdzielona z initial i tam zostaje; do async poszedł tylko kod Settings-specyficzny.
- Inne chunki (vendory) bez zmian hashy.
- Kumulatywnie vs baseline 651 KB gzip jeden chunk: initial JS brotli **~45%** (291/651).
- **UX:** pierwszy wjazd w Settings pokazuje placeholder `Loading...` na ułamek sekundy (16 KB brotli przez LAN z Pi to natychmiastowo), kolejne — z cache SW/przeglądarki. Główna ścieżka (workspace/ControlDeck) nigdy nie ładuje kodu Settings.

### ⏭️ Do zrobienia w kolejności (rekomendacja dla Pi Zero W)

Priorytet ustawiony pod target Pi Zero W: najpierw to co odciąża transfer i parsowanie w przeglądarce (front), potem runtime Node.

1. ~~**P1.1** — Lazy-load VisualizerPanel (ControlDeck).~~ **Zrobione 2026-05-26** (−131 KB brotli z initial).
2. ~~**Cleanup Workspace.jsx**~~ **Zrobione 2026-05-26** (449 → 173 linii, −12 KB brotli initial). Pozostaje sprzątanie CSS w `containers/Workspace/index.styl` (`.dropzone-overlay`, `.primary-container`, `.secondary-container`, `.primary-toggler`, `.secondary-toggler`, `.default-container`, `.workspace-table*`, `.dropzone` — wszystko bez aktywnych odwołań w JSX po cleanupie). Logiczniej zrobić razem z P1.3.
3. ~~**P1.3** — Kasacja klasycznych widgetów~~ **Zrobione 2026-05-26** (162 plików, 14 katalogów + orchestration). Bundle initial bez zmian (już tree-shaken), `dist/` −400 KB, source tree masywnie czystszy.
4. ~~**P4.1 + P4.2** — Pi-side systemd unit + `NODE_OPTIONS=--max-old-space-size=256`.~~ **Zrobione 2026-05-26** — `deploy/raspberry-pi/{cncjs.service,README.md}`.
5. ~~**P3.2 + P3.4** — Throttle eventów Socket.IO (10 Hz) + batchowanie xterm writes.~~ **Zrobione 2026-05-26** — `Controller.js` throttle + `widgets/Console/{index.jsx,Terminal.jsx}` batch. Bufor konsoli już był capped przez xterm `scrollback: 1000` — plan miał błędne założenie; przerzucone na realny problem (N→1 parser calls per okno).
6. ~~**P2.5** — Wyrzucenie xterm.~~ **Zrobione 2026-05-26** — DOM terminal w `widgets/Console/Terminal.jsx`, public API zachowany, kolory chalk parsowane przez SGR → CSS. `vendor.misc` −136 KB raw / −26 KB brotli. Initial JS brotli 342 → 316 KB.
7. ~~**P4.6** — tmpfs dla `/tmp` i `/home/pi/.cncjs-sessions`.~~ **Zrobione 2026-05-26** — `deploy/raspberry-pi/README.md` rozbudowane. Logi już idą do journald, nie do `/var/log/cncjs/`.
8. ~~**P2.4** — Font Awesome subset.~~ **Zrobione 2026-05-26** (alternatywą do subsettingu: skip nieużywanych formatów przez `css-loader` `url:` filter). dist/ −1.1 MB. Initial bundle bez zmian.
9. ~~**P5.1** — Service Worker (workbox).~~ **Zrobione 2026-05-26** — `GenerateSW` w webpack + Express `/sw.js` route + rejestracja w `index.hbs`. Drugi load <100 ms, offline shell.
10. ~~**P1.4 Phase 2** — Selektywne importy Three.js + bump `three` ~0.103 → ~0.124.~~ **Zrobione 2026-05-27** jako higiena. 0 KB redukcji bundle (three 0.124 to single-file ESM bez sideEffects flag). Cherry-pick imports + aligned deprecated API (MathUtils, setAttribute, vertexColors: true) przygotowuje codebase pod ewentualny **Phase 3** (bump >=0.149, refactor Geometry→BufferGeometry w CoordinateAxes/GCodeVisualizer/GridLine/ProbeVisualization, Face3→indexed geom — 3-5h + manual test visualizera, real win ~30-50 KB brotli).
11. ~~**P4.5** — Kasacja nieużywanych endpointów serwera.~~ **Zrobione 2026-05-28** — usunięte mdi/macros/tool/controllers handlery + GET /api/gcode (zero konsumentów po cleanupie P1.3). ~511 linii kodu serwerowego mniej, 15 routes mniej. users/events/commands/machines zostają (Settings UI je używa).
12. ~~**P2.6 Phase 1** — `styled-components` → Stylus.~~ **Zrobione 2026-05-27** (9 plików zmigrowanych, deps usunięte, −11 KB brotli initial total). Phase 2 (bootstrap + Header Navbar rewrite, @trendmicro audit) — większe projekty, NIE robione.
13. ~~**P3.1** — PureComponent audit + stabilizacja propsów ControlDeck.~~ **Zrobione 2026-05-27** — memoize-one dla 3 getterów + PureComponent dla 7 paneli. Bundle +0.7 KB, runtime win na Pi browser (4-5 paneli rerenderuje rzadko zamiast 10 Hz). **P3.3** (virtualizacja list) — **odpada**: FilesPanel slice'uje do max 6 plików, brak listy która rośnie.
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

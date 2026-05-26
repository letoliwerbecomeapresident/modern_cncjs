# CLAUDE.md

## Projekt: cncjs (fork)

Web-based UI dla kontrolerów CNC (Grbl, Marlin, Smoothieware, TinyG). Node/Express + Socket.IO + React.

**Fork:** `origin` → `letoliwerbecomeapresident/modern_cncjs`, `upstream` → `cncjs/cncjs`.
Fork istnieje aby zmodernizować UI i dodać funkcjonalność pod indywidualne potrzeby — nie planujemy zwykłego PR-owania do upstream'u. Synchronizacja z `upstream/master` opcjonalna, świadoma.

**Stack:**
- Frontend: React 15.6 (komponenty klasowe), Redux, React Router 4, Stylus, Three.js (visualizer)
- Backend: Node.js ≥18, Express 4, Socket.IO 2
- Build: Webpack 5, Babel 7, Yarn (zawsze yarn — nigdy npm)
- Test: Jest 30 (środowisko Node, timeout 10s)

**Komendy:**
```
yarn dev          # webpack-dev-server (8080) + cncjs (8000), concurrent
yarn build        # build produkcyjny
yarn lint         # eslint + stylint + i18nlint
yarn eslint       # tylko ESLint (src/**/*.js, src/app/**/*.jsx, scripts/**/*.js)
yarn test         # Jest z coverage (server-only)
```

## Struktura

- `src/app/` — React frontend
  - `containers/Workspace/ControlDeck/` — **nowy modern UI** (dodany w forku, 2400+ linii stylów, modularny dashboard z panelami: Axes, Connection, Console, Files, JobStatus, Jog, Laser, StatusMonitors, Visualizer)
  - `styles/modern-ui.styl` — globalne style modern UI forka
  - `widgets/` — klasyczne widgety (Axes, Console, Visualizer, kontrolery)
  - `i18n/` — 17 języków, klucz `resource.json`
- `src/server/` — Express, kontrolery CNC w `controllers/{Grbl,Marlin,Smoothie,TinyG}/`
- `src/lib/` — wspólna logika, narzędzia 3D
- `grbl-simulator/` — symulator Grbl używany w testach
- `src/electron-app/` — wrapper Electron

Webpack alias: `@app` → `src/app`.

## Konwencje techniczne

- **Tylko JavaScript** — brak TypeScript, brak `.ts`/`.tsx`.
- **Stylus** dla wszystkich stylów (brak CSS modules, brak Sass).
- **i18next** dla wszystkich stringów user-facing (frontend i serwer).
- ESLint extends `eslint-config-trendmicro`.
- Komponenty React: klasowe (React 15.6, brak hooków).
- Testy: `__tests__/` obok testowanego kodu, plik `*.test.js`. Coverage tylko dla `src/server/**`.
- Jest `testMatch`: `src/server/**/__tests__/**/*.test.js` + `grbl-simulator/__tests__/**/*.test.js`.

## Konwencje commitów

Konwencjonalne commity (`<type>(<scope>): <opis>`). Najczęstsze typy: `feat`, `fix`, `chore`, `refactor`, `docs`, `build`, `ci`, `test`.

**Scope'y używane w projekcie:**
- Kontrolery: `(Grbl)`, `(Marlin)`, `(TinyG)`, `(Smoothie)`, `(grbl-simulator)`
- UI: `(widgets/Axes)`, `(widgets/*)`, `(app)`
- i18n: `(l10n)`, `(i18n)`
- Zależności: `(deps)`, `(deps-dev)`
- Release: `(release)`

**PR reference:** gdy commit pochodzi z mergowanego PR — dopisz `(#NUMER)` na końcu opisu. Dla zwykłych commitów lokalnych w forku — pomiń.

Przykłady:
```
feat(widgets/Axes): replace GridSystem with flexbox in MDI (#955)
fix(grbl): regression in Grbl-Mega connection handling
chore(deps): bump @babel/runtime from 7.20.13 to 7.27.6
```

## i18n — gdy dotykasz UI

1. Dodaj klucz do `src/app/i18n/en/resource.json`.
2. `yarn i18nlint` waliduje JSON (uruchamiane przez `yarn lint`).
3. Pozostałe języki — można zostawić puste dla późniejszego tłumaczenia, ale niech struktura kluczy będzie spójna.

## Pakiety

- **Tylko `yarn`** (jest `yarn.lock`, brak `package-lock.json`).
- `package.json` i `src/package.json` aktualizowane razem przez `node scripts/package-sync.js`.
- Changesets dla wersjonowania (`.changeset/`, `yarn ci-version`, `yarn ci-publish`).

## Pre-push hook

`pre-push` uruchamia `eslint-debug`. Jeśli ESLint nie przechodzi — popraw, nie omijaj.

---

## Wytyczne dla agenta

**Tradeoff:** te wytyczne są ostrożniejsze niż domyślne — dla trywialnych zadań stosuj zdrowy rozsądek.

### 1. Myśl zanim kodujesz

- Wypowiedz swoje założenia. Jeśli niepewny — pytaj.
- Jeśli istnieje kilka interpretacji — przedstaw je, nie wybieraj po cichu.
- Jeśli istnieje prostsze podejście — powiedz. Push back kiedy uzasadnione.
- Jeśli coś jest niejasne — zatrzymaj się, nazwij to, zapytaj.

### 2. Prostota najpierw

- Minimum kodu rozwiązujący problem. Nic spekulacyjnego.
- Brak funkcji ponad to, o co poproszono.
- Brak abstrakcji dla jednorazowego kodu.
- Brak „elastyczności" o którą nie proszono.
- Brak obsługi błędów dla scenariuszy które nie mogą się zdarzyć.
- Jeśli napiszesz 200 linii a wystarczy 50 — przepisz.

### 3. Chirurgiczne zmiany

- Dotykaj tylko tego co musisz. Czyść tylko swój własny bałagan.
- Nie „ulepszaj" sąsiedniego kodu, komentarzy ani formatowania.
- Nie refaktoryzuj rzeczy które nie są zepsute.
- Trzymaj istniejący styl, nawet jeśli osobiście wolałbyś inaczej.
- Jeśli zauważysz niezwiązany dead code — wspomnij, nie usuwaj.

Test: każda zmieniona linia powinna prowadzić wprost do prośby użytkownika.

### 4. Cel-driven execution

Zamień zadania w weryfikowalne cele:
- „Dodaj walidację" → „Napisz testy dla nieprawidłowych inputów, przejdź je".
- „Napraw bug" → „Napisz test reprodukujący, przejdź go".
- „Refaktoryzuj X" → „Upewnij się że testy przechodzą przed i po".

Dla zadań wieloetapowych — krótki plan z krokami i kryteriami weryfikacji.

### 5. Język komunikacji

Domyślnie po polsku (zgodnie z ustawieniem użytkownika). Identyfikatory w kodzie i wiadomości commitów — po angielsku.

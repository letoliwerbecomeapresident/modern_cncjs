---
name: cncjs-patterns
description: Szczegóły architektury, których nie ma w CLAUDE.md — układ kontrolerów, line parsery, workflow i18n, organizacja testów
---

# Wzorce architektoniczne cncjs

CLAUDE.md zawiera reguły codzienne (commity, lint, struktura katalogów). Ten plik trzyma szczegóły do których wraca się rzadziej, ale są ważne przy konkretnych zadaniach.

## Kontrolery CNC — anatomia

Każdy z 4 wspieranych kontrolerów (Grbl, Marlin, Smoothie, TinyG) ma równoległą strukturę:

```
src/server/controllers/{Controller}/
├── {Controller}Controller.js        # główna klasa kontrolera, stan połączenia, kolejka
├── {Controller}Runner.js            # parser strumienia odpowiedzi, emituje eventy
├── {Controller}LineParser.js        # router linii do konkretnych parserów wyników
├── {Controller}LineParserResult*.js # parsery konkretnych odpowiedzi (Ok, Status, Settings, ...)
└── __tests__/
    └── {Controller}Runner.test.js

src/app/widgets/{Controller}/
├── index.js                         # widget React (klasowy)
├── constants.js
└── ...
```

Zmiany w kontrolerze często wymagają edycji **i** server-side (`src/server/controllers/X/`) **i** widgetu (`src/app/widgets/X/`) — trzymaj ten sam scope commita.

### Najczęściej modyfikowane pliki (z historii git)

1. `src/server/controllers/Grbl/GrblController.js`
2. `src/server/controllers/Marlin/MarlinController.js`
3. `src/server/controllers/TinyG/TinyGController.js`
4. `src/server/controllers/Smoothie/SmoothieController.js`

## Workflow i18n

Wspierane języki (17): `en`, `cs`, `de`, `es`, `fr`, `hu`, `it`, `ja`, `nb`, `nl`, `pt`, `pt-br`, `ru`, `tr`, `uk`, `zh-cn`, `zh-tw`.

1. Tekst w komponencie:
   ```jsx
   import { Trans } from 'react-i18next';
   <Trans i18nKey="widget.axes.jogSpeed">Jog Speed</Trans>
   ```
2. Klucz do `src/app/i18n/en/resource.json` (źródło prawdy).
3. `yarn i18nlint` — sprawdza JSON wszystkich języków.
4. Skanowanie: `i18next-scanner` (configi: `i18next-scanner.app.config.js`, `i18next-scanner.server.config.js`).

Pliki i18n często aktualizowane są w jednym commicie batch — to OK i utrwalona praktyka.

## Testy

Jest 30, środowisko Node, timeout 10s, coverage zbierany tylko dla `src/server/**`.

- Lokalizacja: `__tests__/` obok testowanego kodu, plik `*.test.js`.
- Test match (z `package.json`):
  - `<rootDir>/src/server/**/__tests__/**/*.test.js`
  - `<rootDir>/grbl-simulator/__tests__/**/*.test.js`
- Setup file: `jest-setup.js` (obecnie pusty).
- Transform: `babel-jest` z `@babel/preset-env` (target `node: current`).
- Migracja `tap` → `Jest` została już dawno wykonana — wszystkie testy w składni Jest.

## Build

- `yarn build` → `scripts/build-prod.sh` (produkcja)
- `yarn build-dev` → `scripts/build-dev.sh` (development)
- `yarn dev` = `build-dev` + concurrent (`webpack serve` na 8080 + cncjs na 8000)
- Electron build per platforma: `yarn build:macos`, `build:linux`, `build:windows` (i warianty arch). Output trafia do `output/`.

## Changesets / release

- `.changeset/*.md` — kolejka zmian do release'u.
- `yarn ci-version` → konsumuje changesety, bumpuje wersję w `package.json` + `src/package.json`, aktualizuje `yarn.lock`.
- `yarn ci-publish` → build + publish.
- Wersja synchronizowana w obu `package.json` przez `scripts/package-sync.js`.

## ControlDeck (modern UI tego forka)

Nowy modularny dashboard wprowadzony w forku — `src/app/containers/Workspace/ControlDeck/`. Składa się z:

- `ControlDeck.jsx` — root (~1000 linii)
- `components/ModularDashboard.jsx` — siatka panelów
- Panele: `AxesPanel`, `ConnectionPanel`, `ConsolePanel`, `FilesPanel`, `FooterStatus`, `JobStatusPanel`, `JogPanel`, `LaserPanel`, `StatusMonitors`, `TopBar`, `VisualizerPanel`, `SideNav`
- `control-deck.styl` (~2360 linii) — całość stylów
- `lib/formatters.js` — formatery wartości

Klasyczne `widgets/*` nadal istnieją równolegle — ControlDeck je w wielu miejscach zastępuje / opakowuje. Zmieniając zachowanie panelu w nowym UI sprawdź czy nie trzeba też dotknąć starego widgeta.

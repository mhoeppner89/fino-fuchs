# Fino schreibt

Fino schreibt ist eine statische, deutschsprachige Schreiblern-App für kurze Übungen mit Finger, Touch-Stift oder Apple Pencil. Sie läuft vollständig im Browser und kann direkt über GitHub Pages veröffentlicht werden.

## Enthaltene Funktionen

- sechs Bereiche: **Linien**, **Formen**, **Zahlen**, **Buchstaben**, **Mein Name** und **Bunte Mischung**
- drei Hilfestufen: **Leicht**, **Mittel** und **Knifflig**
- 20 kontrolliert zufällig ausgewählte Aufgaben pro Runde
- automatischer Wechsel zur nächsten Aufgabe, sobald alle nötigen Striche erkannt sind
- 56 Zeichenvorlagen: neun Linien, acht Formen, zehn Zahlen und 29 Großbuchstaben einschließlich Ä, Ö und Ü
- Fino läuft die Schreibspur als Start-Hilfe ab, ohne sie vorzuzeichnen; beim Absetzen springt er zum nächsten Strich
- lokale, bewusst großzügige Auswertung von Form, Abdeckung, Startpunkt, Richtung und Strichlänge
- freundliche Wiederholungen ohne sichtbare Fehlerpunkte oder Ranglisten
- Hinweise als gut lesbarer Text; die Sprachfunktion ist derzeit ausgeschaltet
- responsive Darstellung für Telefone, Tablets sowie Hoch- und Querformat
- Pointer-Events für Finger, Maus und Stift; Touch-Gesten sind auf der Zeichenfläche deaktiviert
- einfache Unterdrückung versehentlicher Handballen-Touches, sobald ein Stift erkannt wurde
- installierbare Progressive Web App mit Offline-Betrieb
- keine Konten, Werbung, Analyse-Skripte oder Datenübertragung
- keine dauerhafte Speicherung von Name, Auswahl oder Leistung

## Direkt starten

Die App benötigt keinen Build-Schritt. Wegen JavaScript-Modulen und Offline-Funktionen sollte sie über einen kleinen lokalen Webserver geöffnet werden.

```bash
cd fuchsschrift
python3 -m http.server 4173
```

Danach im Browser öffnen:

```text
http://localhost:4173
```

Alternativ:

```bash
npm run serve
```

## Auf GitHub Pages veröffentlichen

1. Ein neues GitHub-Repository anlegen.
2. **Den Inhalt dieses Ordners** in das Stammverzeichnis des Repositorys hochladen.
3. GitHub Pages für den Hauptbranch und das Stammverzeichnis aktivieren.
4. Die von GitHub angezeigte Pages-Adresse öffnen.

Alle Pfade sind relativ. Die App funktioniert daher auch unter einer Projektadresse wie `name.github.io/fuchsschrift/`.

Auf dem iPad kann die Seite anschließend in Safari über das Teilen-Menü zum Home-Bildschirm hinzugefügt werden. Nach dem ersten vollständigen Laden ist die App auch offline verfügbar.

## Datenschutz und Speicherung

Fino schreibt verwendet weder `localStorage` noch IndexedDB. Der eingegebene Name und die aktuelle Runde liegen nur im Arbeitsspeicher der geöffneten Seite und verschwinden beim Neuladen.

Der Service Worker speichert ausschließlich die statischen App-Dateien, damit die App offline startet. Handzeichnungen, Namen und Ergebnisse werden nicht in diesen Cache geschrieben und nicht übertragen.

## Sprache

Die Sprachfunktion ist derzeit ausgeschaltet. Alle Hinweise stehen deshalb direkt auf dem Bildschirm. Eigene, aufgenommene Audiodateien können später ergänzt werden, ohne dass dafür ein Online-Dienst nötig ist.

## Inhalt anpassen

Die Übungsvorlagen und die Sitzungslogik stehen in:

```text
js/curriculum.js
```

Wichtige Bereiche:

- `lineTasks`: Linien und ihre Schreibspuren
- `shapeTasks`: Formen
- `digitStrokes`: Zahlen 0–9
- `letterStrokes`: Großbuchstaben und Umlaute
- `buildSession()`: kontrollierte Zufallsauswahl und Reihenfolge
- `assistancePlans`: Hilfestufen innerhalb einer Runde

Die Zeichenauswertung und Canvas-Eingabe stehen in:

```text
js/drawing.js
```

Oberfläche und Navigation stehen in:

```text
js/app.js
```

## Tests

### Logik- und Auswertungstests

```bash
npm test
```

Diese Tests benötigen keine zusätzlichen Pakete.

### Browser-Smoke-Test

```bash
python3 tests/browser_smoke.py
```

Dafür wird Playwright mit Chromium benötigt. Der Test prüft Telefon- und Tablet-Layouts, Hoch- und Querformat, Fehlversuche, eine vollständige Runde, Stifteingabe und Offline-Start. Screenshots werden bei der Ausführung in `test-artifacts/` erzeugt.

## Projektstruktur

```text
fuchsschrift/
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
├── js/
│   ├── app.js
│   ├── curriculum.js
│   └── drawing.js
├── assets/
│   ├── fox-face.svg
│   ├── fox-mentor.svg
│   └── icons/
├── tests/
│   ├── curriculum.test.js
│   ├── drawing.test.js
│   └── browser_smoke.py
├── QA.md
├── LICENSE
└── package.json
```

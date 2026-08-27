# Testversion (Tester-Build)

Diese Ordner enthält einen **statischen Schnappschuss** der App für Tester.

Live unter: https://mhoeppner89.github.io/fino-fuchs/testversion/

## Was hier liegt

Nur die Laufzeit-Dateien – die App läuft komplett ohne Build-Schritt:

- `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`
- `js/` – alle App-Module
- `assets/` – Icons, Fino-Grafiken und die Vorlagen-Masken

Die Testversion ist **vom Hauptstand getrennt**: Die Haupt-URL
(`/fino-fuchs/`) bleibt auf dem zuletzt veröffentlichten Stand, während diese
Testversion den aktuellen Entwicklungsstand der Tester bekommt.

## Neuen Stand als Testversion ausliefern

Nach Änderungen am Projekt den Schnappschuss neu erzeugen und pushen:

```bash
cd ..  # Projektwurzel
rm -rf testversion && mkdir -p testversion/js testversion/assets
cp index.html styles.css manifest.webmanifest sw.js testversion/
cp js/*.js testversion/js/
cp -R assets/. testversion/assets/
git add testversion
git commit -m "Refresh testversion snapshot (vX.Y.Z)"
git push origin main
```

Wichtig: `rm -rf testversion` vor dem Neukopieren, damit gelöschte Dateien
auch aus dem Snapshot verschwinden.

## Testmodus

Mit `?test` im URL erscheint im Hauptmenü die Karte „Alle Symbole“ – sie
läuft alle 68 Buchstaben und Zahlen einmal durch (Review-Modus). Für Tester
normal nicht sichtbar.

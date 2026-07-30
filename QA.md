# QA-Bericht

Stand: 30. Juli 2026

## Automatisierte Logiktests

Ergebnis: **18 von 18 Tests bestanden**.

Geprüft wurden:

- genau 100 eindeutige Übungen pro Bereich, einschließlich der aus dem Namen erzeugten Übungen
- Sitzungen mit exakt 20 Aufgaben in allen sechs Bereichen
- kontrollierte Zufallsauswahl ohne direkte Wiederholung
- zufällige 20er-Runden ohne Wiederholung
- Normalisierung deutscher Namen und Akzente
- Zusammensetzung einer vollständigen Namensvorlage
- exakte und kindlich ungenaue Linien
- Zurückweisung eines langen, unpassenden Gekritzels
- leere Eingabe und passende Rückmeldung
- getrennte Erkennung der Schreibrichtung
- vollständiges Kreuz in einem statt in zwei Strichen
- wiederholte Zahl bleibt offen, bis jede Kopie gezeichnet wurde
- Fino-Hilfe auf der gepunkteten Spur und Sprung zwischen getrennten Strichen

Die Bänke und Runden werden deterministisch geprüft: Alle 100er-Bänke haben eindeutige Kennungen und Zeichenspuren; jede Runde enthält 20 verschiedene Aufgaben.

## Browser-Smoke-Test

Der lokale Playwright-Canvas-Check startet die App, lädt alle App-Dateien und zeigt die erste Schreibaufgabe ohne JavaScript- oder Konsolenfehler. Der ausführlichere Python-Smoke-Test unten kann vor einer Veröffentlichung erneut ausgeführt werden.

Getestete Ansichten:

| Ansicht | Größe | Ergebnis |
|---|---:|---|
| Telefon, Hochformat | 390 × 844 | bestanden |
| Großes Telefon, Hochformat | 430 × 932 | bestanden |
| Telefon, Querformat | 844 × 390 | bestanden |
| Tablet, Hochformat | 1024 × 1366 | bestanden |

Geprüfte Abläufe:

- Startseite mit allen sechs Auswahlkarten
- Auswahl von Buchstabengruppe und Hilfestufe
- Start einer 20-Aufgaben-Runde ohne Zeitlimit
- Fehlversuch mit hilfreicher deutscher Rückmeldung
- vollständige Runde mit 20 Aufgaben und Abschlussbildschirm
- Namensübung mit „Käthe“ einschließlich Umlaut
- Zeichenfläche ohne horizontales Überlaufen in allen Ansichten
- vertrauenswürdige Browser-Pointer-Events mit `pointerType: pen`
- automatische lokale Auswertung nach dem letzten benötigten Strich
- Service-Worker-Kontrolle und vollständiger Offline-Neustart
- alle App-Dateien ohne fehlende Ressourcen

## Manuelle Sichtprüfung

Geprüft wurden:

- klare visuelle Hierarchie
- ausreichende Größe der Bedienelemente
- freie, nicht durch UI verdeckte Zeichenfläche
- lesbare Kontraste
- passende Anordnung in Hoch- und Querformat
- dezente Animationen sowie Unterstützung für reduzierte Bewegung
- konsistente Fuchsfigur auf Start-, Übungs- und Abschlussbildschirm

## Gerätespezifischer Hinweis

Die automatisierten Tests senden echte Browser-Stift-Pointer-Events. Physische Eigenschaften eines konkreten Apple-Pencil-/iPad-Modells, insbesondere Betriebssystem-Latenz und Handballenerkennung, lassen sich in einer Container-Umgebung nicht messen. Die App verwendet dafür die standardisierten Pointer Events, Pointer Capture, koaleszierte Ereignisse und eine kurze Touch-Sperre nach erkanntem Stifteingang.

Zum Abschluss der Veröffentlichung empfiehlt sich ein kurzer Hardware-Smoke-Test auf dem vorgesehenen iPad: eine Linie mit Pencil zeichnen, die Handfläche auflegen, ins Querformat drehen und die App einmal aus dem Home-Bildschirm offline öffnen.

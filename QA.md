# QA-Bericht

Stand: 8. August 2026

## Automatisierte Logiktests

Ergebnis: **93 von 93 Tests bestanden**.

Geprüft wurden:

- genau 100 eindeutige Übungen für Linien, Zahlen, Buchstaben, Namen, Labyrinthe, Funkelpunkte und Mischung
- 36 unterschiedliche Formen und kleine Bilder ohne künstliche Spiegel- oder Größenkopien
- Sitzungen mit exakt 10 Aufgaben in allen acht Bereichen
- kontrollierte Zufallsauswahl ohne direkte Wiederholung
- zufällige 10er-Runden ohne Wiederholung
- Normalisierung deutscher Namen und Akzente
- Zusammensetzung einer vollständigen Namensvorlage
- exakte und kindlich ungenaue Linien
- Zurückweisung eines langen, unpassenden Gekritzels
- leere Eingabe und passende Rückmeldung
- getrennte Erkennung der Schreibrichtung
- vollständiges Kreuz in einem statt in zwei Strichen
- wiederholte Zahl bleibt offen, bis jede Kopie gezeichnet wurde
- eigene Zahlen- und Buchstabenauswahl erzeugt immer eine vollständige 10er-Runde
- verschiedene, aufeinanderfolgende Stiftstriche erhalten unterschiedliche Farben
- Groß- und Kleinbuchstaben sind im 100er-Buchstabenbereich enthalten
- leichte Zahlen- und Buchstabenrunden zeigen genau ein Symbol pro Aufgabe
- jede sichtbare Kopie in einem Mehrfach-Symbol muss unabhängig vollständig sein
- Fino zeigt nach geteilten Stiften den ersten noch offenen Startpunkt
- Fino-Hilfe auf der Vorlage und Sprung zwischen getrennten Strichen
- alle 100 Labyrinthe sind auf Telefon und Tablet lösbar; Wände können nicht übersprungen werden
- alle 100 Funkelpunkte-Wege bleiben auf dem Bildschirm, kreuzen sich nicht und erkennen alte Linien zuverlässig
- Kreis und Viereck bleiben physisch rund beziehungsweise quadratisch; ähnliche Formen werden nicht verwechselt
- Buchstaben, Zahlen, Formen und vorhandene Tinte behalten bei einer Drehung gemeinsam ihre Proportionen
- alle 62 Buchstaben und Ziffern folgen der Bildvorlage mit höchstens 5,4 Quellpixeln Abstand; kein Fino-Laufweg biegt an einer Kreuzung falsch ab oder kehrt abrupt um
- vollständige Verwechslungsmatrizen weisen jede andere Ziffer, jeden anderen Groß- und Kleinbuchstaben sowie jedes andere Bild zurück
- kindlich zusammenhängende Varianten mit Verschiebung, leichter Drehung, Größenänderung und Handzittern bestehen auf vier Bildschirmformaten
- App-Version, Theme-Farben, PWA-Icons, lokale Abhängigkeiten und Offline-Dateiliste sind untereinander konsistent

Die Bänke und Runden werden deterministisch geprüft: Alle 100er-Bänke haben eindeutige Kennungen und Geometrien; jede normale Runde enthält 10 verschiedene Aufgaben.

## Browser-Smoke-Test

Der zuletzt erfolgreich aufgezeichnete lokale Canvas-Check startet die App, lädt alle App-Dateien und zeigt die erste Schreibaufgabe ohne JavaScript- oder Konsolenfehler. Die beiden Screenshots und Zustandsdateien liegen in `qa-mobile-release/client-smoke/`. Ein erneuter abschließender Browserlauf war am 8. August wegen des Codex-Nutzungslimits nicht verfügbar; er wurde nicht durch eine andere Browseroberfläche umgangen. Die Browserdateien selbst, alle 93 Logik- und Release-Prüfungen sowie die JavaScript-Syntaxprüfung sind aktuell grün.

Getestete Ansichten:

| Ansicht | Größe | Ergebnis |
|---|---:|---|
| Telefon, Hochformat | 390 × 844 | letzter Browserlauf bestanden |
| Großes Telefon, Hochformat | 430 × 932 | letzter Browserlauf bestanden |
| Telefon, Querformat | 844 × 390 | letzter Browserlauf bestanden |
| Tablet, Hochformat | 1024 × 1366 | letzter Browserlauf bestanden |

Geprüfte Abläufe:

- Startseite mit allen acht Auswahlkarten
- Auswahl von Buchstabengruppe und Hilfestufe
- Start einer 10-Aufgaben-Runde ohne Zeitlimit
- Fehlversuch mit hilfreicher deutscher Rückmeldung
- vollständige Runde mit 10 Aufgaben und Abschlussbildschirm
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

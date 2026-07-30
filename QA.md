# QA-Bericht

Stand: 30. Juli 2026

## Automatisierte Logiktests

Ergebnis: **11 von 11 Tests bestanden**.

Geprüft wurden:

- Vollständigkeit der 56 Vorlagen
- Sitzungen mit exakt sieben Aufgaben in allen sechs Bereichen
- kontrollierte Zufallsauswahl ohne direkte Wiederholung
- Höchstgrenze von zwei Wiederholungen derselben Aufgabe pro Runde
- Interleaving bei kleinen Auswahlmengen, etwa 1–3 oder einem einbuchstabigen Namen
- Normalisierung deutscher Namen und Akzente
- Zusammensetzung einer vollständigen Namensvorlage
- exakte und kindlich ungenaue Linien
- Zurückweisung eines langen, unpassenden Gekritzels
- leere Eingabe und passende Rückmeldung
- getrennte Erkennung der Schreibrichtung

Zusätzlich wurden **10.800 deterministische Sitzungen** über Kategorien, Hilfestufen, Unterauswahlen und Namen erzeugt. Dabei trat keine direkte Wiederholung und keine Überschreitung der Wiederholungsgrenze auf.

## Browser-Smoke-Test

Ergebnis: **bestanden, keine JavaScript- oder Konsolenfehler**.

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
- Start einer fünfminütigen Runde
- Fehlversuch mit hilfreicher deutscher Rückmeldung
- vollständige Runde mit sieben Aufgaben und Abschlussbildschirm
- Namensübung mit „Käthe“ einschließlich Umlaut
- Zeichenfläche ohne horizontales Überlaufen in allen Ansichten
- vertrauenswürdige Browser-Pointer-Events mit `pointerType: pen`
- Aktivierung des Fertig-Buttons nach Stifteingabe
- erfolgreiche lokale Auswertung einer Stiftspur
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

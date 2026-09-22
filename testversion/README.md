# Testversion v1.3.50

Aktueller statischer Schnappschuss der Laufzeitdateien.

[Online-Test mit Symbolübersicht](https://mhoeppner89.github.io/fino-fuchs/testversion/?test)

[Evaluator-Kalibrierer](https://mhoeppner89.github.io/fino-fuchs/testversion/calibration.html)

Im Menü **Alle Symbole** auswählen, die Schwierigkeit festlegen und
**Los geht’s!** drücken. Die feste Reihenfolge enthält 69 Aufgaben:
Großbuchstaben mit Umlauten und ß, Kleinbuchstaben mit Umlauten, Ziffern 0–9. Mit den Pfeilen oben vor- und zurückblättern; Zeichnen
ist dafür nicht erforderlich. Die gewählte Schwierigkeit gilt für alle Aufgaben.

Der Parameter `?test` blendet die Symbolübersicht und Diagnosefunktionen ein.
Ohne diesen Parameter erscheint das normale Menü.

Der Kalibrierer nimmt fünf isolierte Versuche je Strich und optional fünf
Gesamtzeichen je Ziel auf. Jede Rohspur erhält ein Ja/Nein-Label, einfache
Geometriemerkmale und den Zielkatalog. Die Daten bleiben lokal im Browser und
können als JSON exportiert werden.
Zum Durchsehen der 66 Formen und Bilder im Kalibrierer **Nur Formen** und
**Gesamtzeichen** auswählen.

Zum Aktualisieren die Laufzeitdateien `index.html`, `styles.css`,
`manifest.webmanifest`, `sw.js`, `js/` und `assets/` aus der Projektwurzel
hierher kopieren. Diese README behalten und veraltete Laufzeitdateien entfernen.
GitHub Pages veröffentlicht nach dem Push beide Verzeichnisse aus `main`.
Die Service-Worker-Caches sind nach App-Pfad getrennt.

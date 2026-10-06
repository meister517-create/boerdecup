# 40. Soester Börde-Cup – Web-App 

Frontend (Spielplan, Teams, Tabelle, Essen & Getränke, Thekengold) und Orga-Bereich.
Gehostet über GitHub Pages, Daten und Login über Firebase (kostenlos).

Dateien: `index.html`, `app.js`, `config.js`, `logo.png`, `firestore.rules`, `README.md`

---

## Schritt 1: Firebase einrichten (ca. 10 Minuten)

1. Öffne https://console.firebase.google.com und melde dich mit einem Google-Konto an.
2. **Projekt erstellen**, z. B. „boerdecup“. Google Analytics kannst du ausschalten.
3. **Login anlegen:** Links unter *Build* → **Authentication** → *Jetzt starten*.
   - Anbieter **E-Mail/Passwort** aktivieren und speichern.
   - Reiter **Nutzer** → *Nutzer hinzufügen*:
     - E-Mail: `soesterhc@soester-boerdecup.de`
     - Passwort: `shc1996!$`
   - Im Orga-Bereich meldest du dich später einfach mit `soesterhc` und dem Passwort an.
4. **Datenbank anlegen:** *Build* → **Firestore Database** → *Datenbank erstellen*.
   - Standort: **europe-west3 (Frankfurt)**
   - Modus: **Produktionsmodus**
   - Danach Reiter **Regeln**: den kompletten Inhalt der Datei `firestore.rules` einfügen und **Veröffentlichen**.
5. **Web-App registrieren:** Projektübersicht (Zahnrad → *Projekteinstellungen*) → unten *Meine Apps* → Symbol **</>** (Web).
   - Name z. B. „boerdecup-web“, Hosting **nicht** anhaken → *App registrieren*.
   - Du siehst einen Block `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
   - Kopiere diese Werte in die Datei **`config.js`** (jeweils die Platzhalter ersetzen).

> Der `apiKey` darf öffentlich sichtbar sein, das ist bei Firebase normal. Geschützt wird über die Regeln aus Schritt 4: Lesen darf jeder, schreiben nur der Orga-Login.

## Schritt 2: Auf GitHub veröffentlichen

1. Auf GitHub **New repository**, Name z. B. `boerdecup`, Sichtbarkeit **Public**.
2. Im neuen Repository **Add file → Upload files**, alle Dateien hineinziehen (mit der ausgefüllten `config.js`) → **Commit changes**.
3. **Settings → Pages**: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.
4. Nach 1–2 Minuten ist die Seite erreichbar unter
   `https://DEIN-GITHUB-NAME.github.io/boerdecup/`

## Schritt 3: Startdaten anlegen

1. Seite öffnen, ganz unten auf **Orga-Bereich** tippen (oder Adresse mit `#orga` am Ende aufrufen).
2. Mit `soesterhc` und Passwort anmelden.
3. **Startdaten anlegen** tippen. Danach sind 16 Beispielteams, der Spielplan für Samstag und Sonntag und eine Beispielkarte da.
4. Teams umbenennen, Logos hochladen, Preise anpassen, **Veröffentlichen**. Fertig.

## Optional: eigene Domain soester-boerdecup.de

1. GitHub: **Settings → Pages → Custom domain** → `soester-boerdecup.de` eintragen → Save.
2. Beim Domain-Anbieter (DNS-Einstellungen) eintragen:
   - Vier **A-Records** für `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - **CNAME** für `www`: `DEIN-GITHUB-NAME.github.io`
3. Wenn GitHub die Domain bestätigt hat: **Enforce HTTPS** anhaken.
   DNS-Änderungen können einige Stunden dauern, also nicht erst am Turniertag machen.

---

## Gut zu wissen

- **Live:** Ergebnisse, Thekengold-Buchungen und Logos erscheinen bei allen Zuschauern sofort, ohne Neuladen.
- **Mehrere Helfer:** Alle können sich gleichzeitig mit `soesterhc` anmelden (z. B. Theke und Turnierleitung). Spielplan-Änderungen überschreiben sich nur, wenn zwei Personen gleichzeitig dasselbe bearbeiten. Thekengold-Buchungen kommen sich nie in die Quere.
- **Passwort ändern:** in Firebase unter Authentication → Nutzer. Der Code muss dafür nicht angepasst werden.
- **Kosten:** Der kostenlose Firebase-Tarif erlaubt 50.000 Lesezugriffe pro Tag. Jede Änderung zählt einmal pro gerade geöffnetem Handy. Bei z. B. 150 offenen Handys und 300 Änderungen an einem Tag wird es knapp. Wer sicher gehen will, stellt auf den Tarif *Blaze* um und setzt eine Budget-Warnung von z. B. 5 €. Die tatsächlichen Kosten liegen dann im Cent-Bereich.
- **Sicherheit:** Das Passwort steht nirgends im Code. Ohne Firebase-Login kann niemand Daten ändern.

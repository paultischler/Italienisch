/* Berlin-Sommer · Urlaubsplaner
   Alles läuft lokal im Browser, gespeichert wird im localStorage. */

/* ============================================================
   1. Grunddaten
   ============================================================ */

const TRIP = { start: '2026-08-02', end: '2026-08-16' };

const PEOPLE = [
  { id: 'maria', name: 'Maria', emoji: '🌻', color: '#e8467c', role: 'Mama' },
  { id: 'paul',  name: 'Paul',  emoji: '👨', color: '#2f7ce0', role: 'ich' },
  { id: 'felix', name: 'Felix', emoji: '👱‍♂️', color: '#12b28a', role: '16 Jahre' },
  { id: 'emmi',  name: 'Emmi',  emoji: '🦄', color: '#f4a020', role: '10 Jahre' },
];

const CATS = [
  { id: 'alle',    label: '✨ Alles' },
  { id: 'kultur',  label: '🖼️ Kultur' },
  { id: 'wasser',  label: '🏊 Wasser' },
  { id: 'kino',    label: '🎬 Kino' },
  { id: 'familie', label: '👨‍👩‍👧 Familie' },
  { id: 'ausflug', label: '🚆 Ausflug' },
  { id: 'fest',    label: '🎉 Feiern' },
  { id: 'action',  label: '🎈 Action' },
];

const SLOTS = [
  { id: 'tag', label: 'Ganzer<br>Tag', short: 'Ganzer Tag', em: '🗓️', time: '10:00' },
  { id: 'vm',  label: 'Vor&shy;mittag',  short: 'Vormittag',  em: '☀️', time: '10:00' },
  { id: 'nm',  label: 'Nach&shy;mittag', short: 'Nachmittag', em: '🌤️', time: '14:30' },
  { id: 'ab',  label: 'Abend', short: 'Abend', em: '🌙', time: '19:00' },
];

/* ============================================================
   2. Die Ideen
   ============================================================ */

const IDEAS = [
  {
    id: 'ballon', emoji: '🎈', cat: 'action', pics: ['ballon'],
    title: 'Mit dem Weltballon aufsteigen',
    sub: 'Zimmerstraße 100 (Ecke Wilhelmstraße), Mitte',
    tags: ['15 Min oben', '150 m hoch', { t: 'nur bei ruhigem Wetter', k: 'warn' }],
    info: 'Der Fesselballon „Die Welt“ zieht euch an einem Seil auf 150 Meter – von oben seht ihr Reichstag, Brandenburger Tor, Fernsehturm und den Potsdamer Platz. Der Ballon startet alle 20 Minuten, im Sommer täglich ab 10 Uhr bis mindestens 17 Uhr. Preise ca. 30 € für Erwachsene, ca. 15 € für Kinder von 3 bis 10 Jahren (bitte tagesaktuell prüfen, es gibt Familientickets). Wichtig: Er fährt nur bei ruhigem Wetter – morgens unter 030 2327 7500 anrufen. Die Tickets sind Gutscheine ohne festes Datum und lange gültig, ihr könnt also spontan hin.',
    url: 'https://air-service-berlin.de/produkt/weltballon/',
  },
  {
    id: 'lapelyte', emoji: '🧱', cat: 'kultur', pics: ['lapelyte-1', 'hbf'],
    title: 'Lina Lapelytė im Hamburger Bahnhof',
    sub: '„We Make Years Out of Hours“ · Invalidenstraße 50–51',
    tags: ['bis 10.1.2027', { t: 'unter 18 frei', k: 'good' }, '400.000 Holzwürfel'],
    info: 'Das ist die Ausstellung mit dem komplizierten Namen: <b>Lina Lapelytė – „We Make Years Out of Hours“</b> (CHANEL Commission, 1.5.2026 – 10.1.2027). Die litauische Künstlerin verwandelt die große historische Halle in eine Landschaft aus <b>400.000 Holzwürfeln</b>, die von Performer:innen <b>und Besucher:innen</b> immer wieder umgebaut wird – dazu kollektiver Gesang aus kurzen Gedichtzeilen über Gemeinschaft, Liebe und Hoffnung.<br><br>Also eine Ausstellung zum Mitmachen und Anfassen – das dürfte für Emmi genauso funktionieren wie für die Großen.<br><br>Im selben Haus laufen außerdem <b>Shilpa Gupta – „What Still Holds“</b> (bis 3.1.2027), <b>Giulia Andreani – „Sabotage“</b> und <b>Saâdane Afif – „Five Preludes“</b> (beide nur noch bis 13.9.) sowie <b>„Tausendmal Berlin“</b> aus der Sammlung. Bei den Staatlichen Museen ist der Eintritt für alle unter 18 frei – Felix und Emmi kommen also umsonst rein.',
    url: 'https://www.smb.museum/ausstellungen/detail/chanel-commission-lina-lapelyte/',
  },
  {
    id: 'dhm', emoji: '🏛️', cat: 'kultur', pics: ['dhm'],
    title: 'Deutsches Historisches Museum — für Felix',
    sub: 'Pei-Bau, Unter den Linden 2 · täglich 10–18 Uhr',
    tags: ['für Geschichts-Fans', { t: '13.8. Eintritt frei', k: 'good' }, 'drinnen'],
    info: 'Wenn Felix Geschichte mag, ist das der Ort. <b>Achtung:</b> Die große Dauerausstellung im Zeughaus ist wegen Umbau geschlossen – gezeigt wird im <b>Pei-Bau</b> nebenan, täglich 10–18 Uhr.<br><br>Aktuell laufen:<br>• <b>„Objekte. Geschichte. Geschichten. Blick in die Sammlung“</b> (bis 31.10.2027) – die Highlights der Sammlung.<br>• <b>„Natur und deutsche Geschichte. Glaube – Biologie – Macht“</b> (bis 18.10.2026).<br><br><b>Tipp:</b> Am <b>Donnerstag, 13. August</b> ist der Eintritt frei, und es gibt kostenlose Themenführungen – unter anderem „Grenzen, Gewalt, Geschichte“ zum 65. Jahrestag des Mauerbaus (12 Uhr auf Englisch, 14 und 16 Uhr auf Deutsch). Das wäre genau der Tag dafür.',
    url: 'https://www.dhm.de/ausstellungen/unsere-ausstellungen/',
  },
  {
    id: 'fotografiska', emoji: '📸', cat: 'kultur', pics: ['fotografiska'],
    title: 'Fotografiska Berlin',
    sub: 'Oranienburger Straße 54, Mitte · täglich 10–23 Uhr',
    tags: [{ t: 'zwei Ausstellungen enden am 11.8.', k: 'warn' }, 'bis 23 Uhr offen', 'drinnen'],
    info: 'Vier Ausstellungen parallel im alten Kunsthaus Tacheles:<br><br>• <b>Anton Corbijn – „Corbijn, Anton“</b> (bis 20.9.) – der Fotograf von Depeche Mode, U2 und Joy Division. Wahrscheinlich das, was Felix am meisten abholt.<br>• <b>Bruce Gilden – „Why These?“</b> (bis 23.8.) – knallharte Straßenporträts.<br>• <b>The Anonymous Project / Lee Shulman – „No Place Like Home“</b> (bis 1.11.) – gefundene Familiendias aus den 50ern/60ern, sehr warm und für alle verständlich.<br>• <b>Bob Jones – „587 Blitze“</b> und <b>Dagmar Schürrer – „Undula“</b> – <b>nur noch bis 11.8.</b><br><br>Bis 23 Uhr geöffnet – geht also auch als Abendprogramm.',
    url: 'https://berlin.fotografiska.com/de/ausstellungen',
  },
  {
    id: 'coberlin', emoji: '🌀', cat: 'kultur', pics: ['coberlin'],
    title: 'C/O Berlin im Amerika Haus',
    sub: 'Hardenbergstraße 22–24, Charlottenburg · täglich 11–20 Uhr',
    tags: ['bis 2.9.', 'drinnen', 'zwei Ausstellungen'],
    info: 'Aktuell laufen dort zwei Ausstellungen, beide bis 2.9.:<br><br>• <b>„The Lure of the Image – Wie Bilder im Netz verlocken“</b>: wie Bilder online funktionieren, wie sie ziehen und manipulieren. Genau das Thema, über das man mit 10 und 16 sehr gut streiten kann.<br>• <b>Walter Schels – „16° Fische“</b>, eine Retrospektive des großen Porträtfotografen.<br><br>C/O Berlin feiert dieses Jahr 25-jähriges Bestehen – deshalb gibt es im August ein besonderes Programm (siehe die MUBI Summer Night am 8./9.8.).',
    url: 'https://co-berlin.org/de/programm/ausstellungen',
  },
  {
    id: 'mubinight', emoji: '🎪', cat: 'fest', pics: ['kino'], from: '2026-08-08', to: '2026-08-09',
    title: 'MUBI Summer Night bei C/O Berlin',
    sub: 'Sa 8. & So 9. August · Amerika Haus',
    tags: [{ t: 'Eintritt frei', k: 'good' }, 'Open Air', 'am 8./9.8.'],
    info: 'Zwei Abende Open-Air-Kino, DJ, Drinks und <b>freier Eintritt</b> im Hof des Amerika Hauses – das Sommerfest zum 25. Geburtstag von C/O Berlin. Am Samstag, 8.8., läuft im Open-Air-Kino „We\'re All Going to the World\'s Fair“.<br><br>Fällt genau auf Carlas Geburtstagswochenende und passt zu MUBI GO. Zeiten vorher auf der C/O-Seite prüfen, das kann voll werden.',
    url: 'https://co-berlin.org/de/programm/kalender',
  },
  {
    id: 'mubigo', emoji: '🎬', cat: 'kino', pics: ['mubigo'],
    title: 'Kino mit MUBI GO — Felix & Paul',
    sub: 'jede Woche ein Film, in Berliner Kinos',
    tags: ['1 Ticket pro Woche', 'Felix & Paul', 'drinnen'],
    info: 'Mit dem MUBI-Abo gibt es über <b>MUBI GO</b> pro Woche ein kostenloses Kinoticket für den „Film der Woche“ – in Berlin unter anderem in den Yorck-Kinos. Ablauf: in der MUBI-App einloggen, Kino auswählen, Gutschein erzeugen und an der Kinokasse vorzeigen.<br><br>Achtung: Man kann damit <b>nicht</b> vorab reservieren – es gilt, solange Plätze frei sind. Also lieber früh da sein. In zwei Wochen sind das zwei Filme: einmal in der ersten, einmal in der zweiten Urlaubswoche.',
    url: 'https://mubi.com/de/de/go',
  },
  {
    id: 'volksbad', emoji: '🏊', cat: 'wasser', pics: ['volksbad'], from: '2026-08-07',
    title: 'Volksbad vor der Volksbühne',
    sub: 'Rosa-Luxemburg-Platz · ab 7. August',
    tags: [{ t: 'kostenlos', k: 'good' }, 'ab 7.8.', '25-Meter-Becken'],
    info: 'Das ist das Schwimmbecken vor dem Theater: Vom <b>7. August bis 1. Oktober</b> wird der Platz vor der Volksbühne zum „Volksbad“ – ein <b>25-Meter-Becken mitten in Mitte</b>, kostenlos für alle, dazu Pommesbude und Programm.<br><br>Öffnungszeiten: Di, Mi, Fr, Sa 12–20 Uhr, Do 13–21 Uhr. Montags, sonntags und feiertags kein Badebetrieb.<br><br><b>Wichtig:</b> Vorher im Online-Shop der Volksbühne ein kostenloses Zeitfenster-Ticket (gilt 2 Stunden) buchen. Es gibt auch Schwimmkurse für Kinder.',
    url: 'https://www.volksbuehne-berlin.de/produktionen/volksbad/',
  },
  {
    id: 'strandbad', emoji: '🏖️', cat: 'wasser', pics: ['strandbad'],
    title: 'Strandbad Weißensee',
    sub: 'Berliner Allee 155, Pankow · täglich 10–20 Uhr',
    tags: ['Familienkarte 23 €', 'Sandstrand', { t: 'bei Regen zu', k: 'warn' }],
    info: 'Das Freibad am Weißen See: Sandstrand, Liegewiese, Strandbar, im Juni–August täglich 10–20 Uhr geöffnet.<br><br>Preise: 9,50 € Erwachsene, 4 € Kinder bis 12 Jahre (also für Emmi), 6 € ermäßigt (Schüler:innen – für Felix), <b>Familienkarte 23 €</b>, ab 17/18 Uhr Feierabendtarif 6 €. Bezahlt wird nur elektronisch, also Karte mitnehmen. Bei schlechtem Wetter bleibt das Bad zu.<br><br>Lässt sich super mit der Freilichtbühne gleich nebenan verbinden: nachmittags baden, abends Film.',
    url: 'https://www.strandbadweissensee.de/',
  },
  {
    id: 'freilicht', emoji: '🎪', cat: 'kino', pics: ['freilicht'],
    title: 'Freilichtbühne Weißensee',
    sub: 'Große Seestraße 10 · Open-Air-Kino & Konzerte',
    tags: ['Open Air', 'direkt am See', { t: 'nur bei trockenem Wetter', k: 'warn' }],
    info: 'Die Freilichtbühne direkt am Weißen See – Kino unter freiem Himmel, Konzerte und Kinderprogramm. Unten steht das Programm für unsere zwei Wochen; tippt auf <b>„Einplanen“</b>, dann landet die Vorstellung direkt im Kalender. Bitte kurz auf der Website gegenchecken, kurzfristige Änderungen sind möglich.',
    url: 'https://freilichtbuehne-weissensee.de/',
    program: [
      { date: '2026-08-02', time: '14:00', title: 'Berliner Kurkonzerte – Sommerfrische & Pop im Kiez (Eintritt frei)' },
      { date: '2026-08-05', time: '21:15', title: 'Kino: Pillion (OmU)' },
      { date: '2026-08-06', time: '21:15', title: 'Kino: Ingeborg Bachmann – Jemand, der einmal ich war' },
      { date: '2026-08-07', time: '21:15', title: 'Kino: I Swear – Verflucht normal (OmU)' },
      { date: '2026-08-08', time: '16:00', title: 'Puppentheater für Kinder' },
      { date: '2026-08-08', time: '21:15', title: 'Kino: Backrooms (OmU)' },
      { date: '2026-08-12', time: '21:15', title: 'Kino: Therapie für Wikinger' },
      { date: '2026-08-13', time: '21:00', title: 'Kino: Was haben wir gelacht' },
      { date: '2026-08-14', time: '21:00', title: 'Kino: Glennkill – Ein Schafskrimi' },
      { date: '2026-08-15', time: '16:00', title: 'Puppentheater für Kinder' },
      { date: '2026-08-15', time: '19:30', title: 'Konzert an der Freilichtbühne' },
      { date: '2026-08-16', time: '13:30', title: 'Luma und die Reise durchs Universum (Kinderkonzert)' },
    ],
  },
  {
    id: 'spreewald', emoji: '🚣', cat: 'ausflug', days: 3, pics: ['spreewald'],
    title: 'Spreewald — zwei Übernachtungen',
    sub: 'Lübbenau / Lehde · ca. 1 Std mit dem RE',
    tags: ['3 Tage / 2 Nächte', 'Kahn & Kanu', { t: 'Unterkunft buchen', k: 'warn' }],
    info: 'Der große Ausflug: drei Tage, zwei Nächte im Spreewald. Klassiker vor Ort – Kahnfahrt ab Lübbenau durch die Fließe, selbst Kanu oder Paddelboot fahren (das mögen Emmi und Felix erfahrungsgemäß mehr als den Kahn), das Freilandmuseum Lehde und natürlich Spreewaldgurken.<br><br>Wenn ihr die Idee einplant, blockt sie automatisch drei Tage im Kalender. Bedenkt die Fixpunkte: die Beisetzung am 5.8. und Carlas Geburtstag am 9.8.<br><br><b>Noch zu tun:</b> Unterkunft buchen – im August ist der Spreewald voll.',
    url: 'https://www.spreewald.de/',
  },
  {
    id: 'opafrank', emoji: '👴', cat: 'familie', pics: ['opafrank-1', 'opafrank-2', 'opafrank'],
    title: 'Zu Opa Frank nach Neuenhagen',
    sub: 'S5 Richtung Strausberg · ca. 30 Min ab Ostkreuz',
    tags: ['halber Tag', 'Tarifbereich C', 'Familie'],
    info: 'Besuch bei Opa Frank in Neuenhagen. Mit der S5 direkt zu erreichen – für den Tarifbereich C braucht ihr ein ABC-Ticket oder einen Anschlussfahrschein.<br><br>Vorher anrufen und einen Tag ausmachen, dann hier eintragen.',
  },
  {
    id: 'pum', emoji: '👵', cat: 'familie', pics: ['pum-1', 'pum'],
    title: 'Zu Pum nach Schöneiche',
    sub: 'S3 bis Friedrichshagen, dann Tram 88',
    tags: ['halber Tag', 'Tarifbereich C', 'Familie'],
    info: 'Besuch bei Pum in Schöneiche. Mit der S3 bis Friedrichshagen und weiter mit der Schöneicher Tram 88.<br><br>Tipp: Lässt sich gut mit dem Müggelsee verbinden, wenn ihr sowieso schon in Friedrichshagen umsteigt.',
  },
  {
    id: 'wandlitz', emoji: '🍻', cat: 'familie', pics: ['wandlitz-1', 'wandlitz'],
    title: 'Zu Opa Micha nach Wandlitz',
    sub: 'S2 bis Karow, dann die Heidekrautbahn RB27',
    tags: ['halber bis ganzer Tag', 'Tarifbereich C', 'Baden möglich'],
    info: 'Besuch bei Opa Micha in Wandlitz, nördlich von Berlin. Mit der S2 bis Berlin-Karow und dort in die Heidekrautbahn (RB27) Richtung Groß Schönebeck umsteigen – Halt Wandlitz oder Wandlitzsee. Ihr braucht ein Ticket für den Tarifbereich C.<br><br><b>Tipp für Emmi und Felix:</b> Direkt am Ort liegt der <b>Wandlitzsee</b> mit Strandbad, Steg und Liegewiese. Wenn das Wetter passt, lässt sich der Besuch gut mit einem Badenachmittag verbinden – Badesachen einpacken.<br><br>Vorher anrufen und einen Tag ausmachen, dann hier eintragen.',
    url: 'https://www.wandlitz.de/',
  },
  {
    id: 'oder', emoji: '⚱️', cat: 'familie', pics: ['oder'],
    title: 'Urnenbeisetzung von Oma Helga',
    sub: 'an der Oder · Mittwoch, 5. August, 10:30 Uhr',
    tags: [{ t: 'fester Termin', k: 'warn' }, 'ganzer Tag', 'Essen an der Oder'],
    fixed: { date: '2026-08-05', slot: 'tag', time: '10:30' },
    info: 'Die Beisetzung ist am <b>Mittwoch, 5. August um 10:30 Uhr</b> an der Oder, danach geht es zum Essen in ein Restaurant an der Oder.<br><br>Rechnet den ganzen Tag ein: Hinfahrt, Beisetzung, Essen, Rückfahrt. An dem Tag also nichts anderes mehr planen.<br><br><b>Noch zu tun:</b> Restaurant reservieren und die Abfahrtszeit festlegen.',
  },
  {
    id: 'carla16', emoji: '🎂', cat: 'fest', pics: ['carla16'],
    title: 'Carlas 16. Geburtstag',
    sub: 'Pauls Nichte wird 16 · Sonntag, 9. August',
    tags: [{ t: 'Datum steht fest', k: 'warn' }, 'Carla entscheidet'],
    fixed: { date: '2026-08-09', slot: 'tag', time: '' },
    info: 'Pauls Nichte Carla wird <b>16</b>. Der Tag gehört ihr – erst fragen, was sie vorhat und ob ihr dabei seid, dann drumherum planen. Was an dem Wochenende ohnehin läuft: die MUBI Summer Night bei C/O Berlin (freier Eintritt, Open Air, DJ) am 8. und 9. August.<br><br>Am Sonntag ist das Volksbad geschlossen, das fällt für den Tag also weg.',
  },
];

/* Bildnachweise – alle Fotos stammen aus Wikimedia Commons */
const CREDITS = {
  ballon:       { autor: 'Lotse', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Berlin_Hi-Flyer_(2013)_1207-1087-(120).jpg' },
  carla16:      { autor: 'Ed g2s', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Birthday_candles.jpg' },
  coberlin:     { autor: 'Raimond Spekking', lizenz: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Amerika-Haus,_Berlin-4514.jpg' },
  dhm:          { autor: 'Avda', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Zeughaus_Berlin_2012.jpg' },
  fotografiska: { autor: 'De-okin', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Kunsthaus_tacheles.berlin.II.JPG' },
  freilicht:    { autor: 'Sebastian Wallroth', lizenz: 'CC BY 3.0', url: 'https://commons.wikimedia.org/wiki/File:Freilichtbuehne_im_Park_am_Weissen_See_Berlin_Weissensee_004.JPG' },
  hbf:          { autor: 'Marek Śliwecki', lizenz: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Berlin_Hamburger_Bahnhof_%E2%80%93_Museum_f%C3%BCr_Gegenwart.jpg' },
  kino:         { autor: 'Fridolin freudenfett', lizenz: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Freiluftkino_Friedrichshain_2020.jpg' },
  mubigo:       { autor: 'Jörg Zägel', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Karl-Marx-Allee_33,_Kino_International.jpg' },
  oder:         { autor: 'Deltongo', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Blick_von_Krajnik-Dolny.jpg' },
  opafrank:     { autor: 'Molgreen', lizenz: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:20220809_xl_041736426_S-Bahnhof_Neuenhagen_bei_Berlin.jpg' },
  pum:          { autor: 'Arbalete', lizenz: 'gemeinfrei', url: 'https://commons.wikimedia.org/wiki/File:Sch%C3%B6neicher_Stra%C3%9Fenbahn_Friedrichshagen.JPG' },
  spreewald:    { autor: 'A. Savin', lizenz: 'FAL', url: 'https://commons.wikimedia.org/wiki/File:Spreewald_04-2016_img03_Spree_near_Luebbenau.jpg' },
  wandlitz:     { autor: '44penguins (Angela M. Arnold)', lizenz: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Strandbad_W%27see_20110814_AMA_fec_(1).JPG' },
  strandbad:    { autor: 'A. Savin', lizenz: 'FAL', url: 'https://commons.wikimedia.org/wiki/File:Weisser_See_B-Weissensee_06-2017.jpg' },
};
/* Bildunterschriften. own = eigenes Familienfoto, kein Nachweis nötig. */
const PICCAP = {
  'lapelyte-1': { cap: 'Die Holzklötze in der Halle des Hamburger Bahnhofs', own: true },
  'opafrank-1': { cap: 'Opa Frank in Neuenhagen', own: true },
  'opafrank-2': { cap: 'Der Pool im Garten in Neuenhagen', own: true },
  'pum-1':      { cap: 'Der Pool bei Pum in Schöneiche', own: true },
  'wandlitz-1': { cap: 'Opa Micha in Wandlitz', own: true },
  ballon:       { cap: 'Der Weltballon am Ballongarten in Mitte' },
  carla16:      { cap: 'Geburtstagskerzen' },
  coberlin:     { cap: 'Das Amerika Haus – Sitz von C/O Berlin' },
  dhm:          { cap: 'Das Zeughaus Unter den Linden' },
  fotografiska: { cap: 'Oranienburger Straße 54 – heute Fotografiska' },
  freilicht:    { cap: 'Die Freilichtbühne im Park am Weißen See' },
  hbf:          { cap: 'Der Hamburger Bahnhof' },
  kino:         { cap: 'Open-Air-Kino in Berlin' },
  mubigo:       { cap: 'Das Kino International an der Karl-Marx-Allee' },
  oder:         { cap: 'Blick über die Oder' },
  opafrank:     { cap: 'S-Bahnhof Neuenhagen (b Berlin)' },
  pum:          { cap: 'Die Tram 88 nach Schöneiche am S-Bahnhof Friedrichshagen' },
  spreewald:    { cap: 'Die Spree bei Lübbenau im Spreewald' },
  strandbad:    { cap: 'Der Weiße See in Weißensee' },
  volksbad:     { cap: 'Das 25-Meter-Becken vor der Volksbühne' },
  wandlitz:     { cap: 'Das Strandbad am Wandlitzsee' },
};
const imgSrc = key => (key && key.slice(0, 5) === 'data:') ? key : './img/' + key + '.jpg';
const capOf = key => (PICCAP[key] || {}).cap || '';
const mainPic = idea => (idea && idea.pics && idea.pics[0]) || null;

/* Offizielle Seiten – erscheinen unter „Infos“ bei jeder Idee. */
const LINKS = {
  ballon: [['Weltballon – Preise & Zeiten', 'https://air-service-berlin.de/produkt/weltballon/']],
  lapelyte: [['Lina Lapelytė – Ausstellungsseite', 'https://www.smb.museum/ausstellungen/detail/chanel-commission-lina-lapelyte/'],
             ['Hamburger Bahnhof – Besuch planen', 'https://www.smb.museum/museen-einrichtungen/hamburger-bahnhof/home/']],
  dhm: [['DHM – aktuelle Ausstellungen', 'https://www.dhm.de/ausstellungen/unsere-ausstellungen/']],
  fotografiska: [['Fotografiska Berlin – Ausstellungen', 'https://berlin.fotografiska.com/de/ausstellungen']],
  coberlin: [['C/O Berlin – Ausstellungen', 'https://co-berlin.org/de/programm/ausstellungen'],
             ['C/O Berlin – Kalender', 'https://co-berlin.org/de/programm/kalender']],
  mubinight: [['C/O Berlin – Kalender', 'https://co-berlin.org/de/programm/kalender']],
  mubigo: [['MUBI GO', 'https://mubi.com/de/de/go'], ['Yorck-Kinos Berlin', 'https://www.yorck.de/']],
  volksbad: [['Volksbad an der Volksbühne', 'https://www.volksbuehne-berlin.de/produktionen/volksbad/']],
  strandbad: [['Strandbad Weißensee', 'https://www.strandbadweissensee.de/'],
              ['Berliner Bäder – Infos & Preise', 'https://www.berlinerbaeder.de/baeder/detail/strandbad-weissensee/']],
  freilicht: [['Freilichtbühne Weißensee – Programm', 'https://freilichtbuehne-weissensee.de/']],
  spreewald: [['Spreewald – offizielles Portal', 'https://www.spreewald.de/'],
              ['Freilandmuseum Lehde', 'https://www.freilandmuseum-lehde.de/']],
  opafrank: [['Gemeinde Neuenhagen bei Berlin', 'https://www.neuenhagen-bei-berlin.de/'],
             ['Fahrplanauskunft VBB', 'https://www.vbb.de/']],
  pum: [['Gemeinde Schöneiche bei Berlin', 'https://www.schoeneiche.de/'],
        ['Fahrplanauskunft VBB', 'https://www.vbb.de/']],
  wandlitz: [['Gemeinde Wandlitz', 'https://www.wandlitz.de/'],
             ['Fahrplanauskunft VBB', 'https://www.vbb.de/']],
};

const TODOS = [
  { id: 't1', text: 'Spreewald-Unterkunft für zwei Nächte buchen', hint: 'Im August wird es schnell voll' },
  { id: 't2', text: 'Restaurant an der Oder für den 5.8. reservieren', hint: 'Nach der Beisetzung, für alle' },
  { id: 't3', text: 'Bei Carla nachfragen, was sie am 9.8. vorhat', hint: 'Pauls Nichte wird 16 – seid ihr dabei?' },
  { id: 't4', text: 'Volksbad: kostenloses Zeitfenster-Ticket buchen', hint: 'Online-Shop der Volksbühne, ab 7.8.' },
  { id: 't5', text: 'Fotografiska: Bob Jones & Undula enden am 11.8.', hint: 'Falls ihr die sehen wollt: erste Woche' },
  { id: 't6', text: 'Weltballon: morgens Wetter checken', hint: '030 2327 7500 – fährt nur bei Windstille' },
  { id: 't7', text: 'MUBI GO: Film der Woche in der App anschauen', hint: 'Felix & Paul, ein Ticket pro Woche' },
  { id: 't8', text: 'Termine mit Opa Frank, Pum und Opa Micha ausmachen', hint: 'Neuenhagen, Schöneiche und Wandlitz – alle im Tarifbereich C' },
];

/* ============================================================
   3. Kleine Helfer
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const WD  = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
             'September', 'Oktober', 'November', 'Dezember'];

const d2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
const parse = s => new Date(s + 'T12:00:00');
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * 864e5));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);

function dayList() {
  const out = [];
  let cur = TRIP.start;
  while (cur <= TRIP.end) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}
const DAYS = dayList();

function fmtDay(dstr) {
  const d = parse(dstr);
  return { wd: WD[d.getDay()], wds: WDS[d.getDay()], num: d.getDate(),
           mon: MON[d.getMonth()], we: d.getDay() === 0 || d.getDay() === 6 };
}
const todayIso = () => iso(new Date());

/* ============================================================
   4. Zustand
   ============================================================ */

const KEY = 'berlin2026_plan_v1';
let S = { v: 1, entries: [], votes: {}, custom: [], todos: {}, avatars: {}, unpinned: [], seeded: false,
          /* Merkzeiten: wann wurde was zuletzt geändert. Nur dadurch lassen sich
             zwei Geräte zusammenführen, ohne dass eines das andere überfährt. */
          stamp: { votes: {}, entries: {}, custom: {}, todos: {}, avatars: 0 },
          tomb:  { entries: {}, custom: {} } };

function frischeFelder() {
  S.stamp = Object.assign({ votes: {}, entries: {}, custom: {}, todos: {}, avatars: 0 }, S.stamp);
  S.tomb = Object.assign({ entries: {}, custom: {} }, S.tomb);
  S.unpinned = S.unpinned || [];
}

function migriereStempel() {
  const jetzt = Date.now();
  ['entries', 'custom'].forEach(art => (S[art] || []).forEach(x => {
    if (!S.stamp[art][x.id]) S.stamp[art][x.id] = jetzt;
  }));
  Object.entries(S.votes || {}).forEach(([idee, v]) => Object.keys(v).forEach(p => {
    const z = idee + '|' + p;
    if (!S.stamp.votes[z]) S.stamp.votes[z] = jetzt;
  }));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(S, JSON.parse(raw));
  } catch (e) { /* kaputter Speicher – dann eben frisch */ }
  frischeFelder();
  migriereStempel();
  if (!S.seeded) { seedFixed(); S.seeded = true; }
  syncPinned();
  letzterStand = schnappschuss();
  save();
}

/* --- Merkzeiten pflegen -------------------------------------------------
   Statt jede einzelne Änderung im Code zu markieren, wird beim Speichern
   verglichen, was sich gegenüber dem letzten Stand geändert hat. */
let letzterStand = null;

function schnappschuss() {
  return {
    votes: JSON.stringify(S.votes || {}),
    votesObj: JSON.parse(JSON.stringify(S.votes || {})),
    entries: Object.fromEntries((S.entries || []).map(e => [e.id, JSON.stringify(e)])),
    custom: Object.fromEntries((S.custom || []).map(i => [i.id, JSON.stringify(i)])),
    todos: JSON.parse(JSON.stringify(S.todos || {})),
    avatars: JSON.stringify(S.avatars || {}),
  };
}

function stempeln() {
  const alt = letzterStand || schnappschuss();
  const neu = schnappschuss();
  const jetzt = Date.now();

  // Stimmen: jede einzelne Zelle für sich
  const zellen = new Set();
  [alt.votesObj, neu.votesObj].forEach(q => Object.entries(q).forEach(([i, v]) =>
    Object.keys(v).forEach(p => zellen.add(i + '|' + p))));
  zellen.forEach(z => {
    const [i, p] = z.split('|');
    const a = (alt.votesObj[i] || {})[p], b = (neu.votesObj[i] || {})[p];
    if (a !== b) S.stamp.votes[z] = jetzt;
  });

  // Termine und eigene Ideen: neu, geändert oder gelöscht
  ['entries', 'custom'].forEach(art => {
    Object.keys(neu[art]).forEach(id => {
      if (alt[art][id] !== neu[art][id]) { S.stamp[art][id] = jetzt; delete S.tomb[art][id]; }
    });
    Object.keys(alt[art]).forEach(id => {
      if (!(id in neu[art])) { S.tomb[art][id] = jetzt; delete S.stamp[art][id]; }
    });
  });

  Object.keys(Object.assign({}, alt.todos, neu.todos)).forEach(k => {
    if (alt.todos[k] !== neu.todos[k]) S.stamp.todos[k] = jetzt;
  });
  if (alt.avatars !== neu.avatars) S.stamp.avatars = jetzt;

  letzterStand = neu;
}
function save(vomServer) {
  if (!vomServer) stempeln();      // eigene Änderungen mit der Uhrzeit versehen
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) {
    // Meist der volle Speicher – Fotos sind mit Abstand das Größte darin
    toast('Speicher voll – bitte ein Foto weniger 📵');
    return false;
  }
  if (!vomServer) syncPush();     // eigene Änderung an die anderen weitergeben
  return true;
}

/* Avatare dürfen überschrieben werden */
const avatarOf = p => (S.avatars && S.avatars[p.id]) || p.emoji;
function seedFixed() {
  IDEAS.filter(i => i.fixed).forEach(i => {
    if (S.entries.some(e => e.ideaId === i.id)) return;
    S.entries.push({ id: 'fix-' + i.id, ideaId: i.id, date: i.fixed.date, slot: i.fixed.slot,
                     time: i.fixed.time, note: '', done: false, fixed: true });
  });
}

const allIdeas = () => IDEAS.concat(S.custom || []);
const ideaById = id => allIdeas().find(i => i.id === id);
const entriesOf = (date, slot) =>
  S.entries.filter(e => e.date === date && e.slot === slot)
           .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
const entriesForIdea = id => S.entries.filter(e => e.ideaId === id);

/* ============================================================
   4a. Live-Abgleich über Firebase
   Der Plan liegt verschlüsselt in einem Familien-Raum. Der Schlüssel
   steht nur im Familien-Link, nie beim Anbieter – Google sieht also
   ausschließlich unlesbare Zeichen.
   ============================================================ */

/* Sichtbar machen, welche Fassung ein Gerät wirklich ausführt. Solange
   eines noch eine alte fährt, überschreibt es den Raum für alle. */
const FASSUNG = 16;
const SYNC_KEY = 'berlin2026_raum_v1';
const GERAET = (() => {                      // damit man den eigenen Nachhall erkennt
  let g = localStorage.getItem('berlin2026_geraet');
  if (!g) { g = uid() + uid(); localStorage.setItem('berlin2026_geraet', g); }
  return g;
})();

let RAUM = null;          // { db, id, k }  – k ist der Schlüssel als Text
let RAUMKEY = null;       // derselbe Schlüssel, für WebCrypto vorbereitet
let quelle = null;        // offene Verbindung zum Server
let syncStatus = 'aus';   // aus | verbinde | live | offline
let pushTimer = null, letzterPush = '';

const b64u = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function keyAus(text) {
  return crypto.subtle.importKey('raw', unb64u(text), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function verschluesseln(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, RAUMKEY,
    new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, von: GERAET, iv: b64u(iv), ct: b64u(new Uint8Array(ct)) };
}

async function entschluesseln(paket) {
  const klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(paket.iv) },
    RAUMKEY, unb64u(paket.ct));
  return JSON.parse(new TextDecoder().decode(klar));
}

const raumUrl = () => `${RAUM.db.replace(/\/+$/, '')}/rooms/${RAUM.id}.json`;
const teilbar = () => ({ entries: S.entries, votes: S.votes, custom: S.custom,
                         todos: S.todos, avatars: S.avatars, unpinned: S.unpinned,
                         stamp: S.stamp, tomb: S.tomb, fassung: FASSUNG });
let letzteFremdFassung = null, letzterEmpfang = 0, raumInhalt = null;
let letzterFehler = null;        // { was, text, zeit } der letzten misslungenen Übertragung
let letzterVersand = 0;          // wann zuletzt erfolgreich gesendet wurde
let letztePaketGroesse = 0;      // Bytes des letzten (versuchten) Pakets

function merkeFehler(was, e) {
  letzterFehler = { was, text: String((e && e.message) || e || 'unbekannt').slice(0, 80), zeit: Date.now() };
}
const mb = n => n > 900000 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB'
             : Math.max(1, Math.round(n / 1024)) + ' kB';

/* Für den Vergleich: gleiche Inhalte ergeben immer dieselbe Zeichenkette,
   egal in welcher Reihenfolge sie im Speicher stehen. */
function kanon(x) {
  if (Array.isArray(x)) return '[' + x.map(kanon).join(',') + ']';
  if (x && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + kanon(x[k])).join(',') + '}';
  }
  return JSON.stringify(x === undefined ? null : x);
}
const nachId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function vergleichbar(q) {
  // Nur der sichtbare Inhalt zählt. Merkzeiten und Grabsteine reisen zwar mit,
  // sollen aber keinen Schreibvorgang auslösen – sonst schicken sich zwei
  // Geräte ewig Verwaltungskram hin und her.
  return kanon({
    entries: (q.entries || []).slice().sort(nachId),
    custom: (q.custom || []).slice().sort(nachId),
    votes: q.votes || {}, todos: q.todos || {}, avatars: q.avatars || {},
    unpinned: (q.unpinned || []).slice().sort(),
  });
}

/* Zwei Stände zusammenführen. Für jedes einzelne Stück gewinnt die
   jüngere Änderung – auch eine Löschung. Niemand überfährt mehr den
   anderen, nur weil er sich zuletzt verbunden hat. */
function verschmelzen(f) {
  const fs = Object.assign({ votes: {}, entries: {}, custom: {}, todos: {}, avatars: 0 }, f.stamp);
  const ft = Object.assign({ entries: {}, custom: {} }, f.tomb);
  const zeit = (q, k) => (q && q[k]) || 0;

  // Grabsteine beider Seiten vereinen – die jüngere Löschung zählt
  ['entries', 'custom'].forEach(art => Object.entries(ft[art]).forEach(([id, t]) => {
    if (t > zeit(S.tomb[art], id)) S.tomb[art][id] = t;
  }));

  ['entries', 'custom'].forEach(art => {
    const meins = new Map((S[art] || []).map(x => [x.id, x]));
    (f[art] || []).forEach(x => {
      const tf = zeit(fs[art], x.id), tl = zeit(S.stamp[art], x.id);
      const grab = zeit(S.tomb[art], x.id);
      if (grab) {
        if (tf > 0 && grab > tf) return;               // Löschung nachweislich jünger
        delete S.tomb[art][x.id];                      // sonst gewinnt das Behalten
      }
      if (!meins.has(x.id) || tf > tl) {
        meins.set(x.id, x);
        S.stamp[art][x.id] = Math.max(tf, tl) || Date.now();
      }
    });
    // eigene Stücke fallen lassen, die der andere später gelöscht hat
    Array.from(meins.keys()).forEach(id => {
      if (zeit(S.tomb[art], id) > zeit(S.stamp[art], id)) meins.delete(id);
    });
    S[art] = Array.from(meins.values());
  });

  // Doppelgänger aus alten Fassungen einsammeln: gleicher Inhalt, andere Kennung
  const gesehen = new Map();
  S.entries.forEach(e => {
    const kern = [e.ideaId, e.date, e.slot, e.time || '', e.label || ''].join('|');
    const vorhanden = gesehen.get(kern);
    if (!vorhanden) { gesehen.set(kern, e); return; }
    const behalten = vorhanden.id < e.id ? vorhanden : e;    // stabile Wahl auf allen Geräten
    gesehen.set(kern, behalten);
  });
  S.entries = Array.from(gesehen.values());

  Object.entries(fs.votes).forEach(([zelle, t]) => {
    if (t <= zeit(S.stamp.votes, zelle)) return;
    const [idee, wer] = zelle.split('|');
    const wert = ((f.votes || {})[idee] || {})[wer];
    S.votes[idee] = S.votes[idee] || {};
    if (wert === undefined) delete S.votes[idee][wer]; else S.votes[idee][wer] = wert;
    S.stamp.votes[zelle] = t;
  });

  Object.entries(fs.todos).forEach(([k, t]) => {
    if (t <= zeit(S.stamp.todos, k)) return;
    S.todos[k] = (f.todos || {})[k];
    S.stamp.todos[k] = t;
  });

  if ((fs.avatars || 0) > (S.stamp.avatars || 0)) {
    S.avatars = f.avatars || {};
    S.stamp.avatars = fs.avatars;
  }

  S.unpinned = Array.from(new Set((S.unpinned || []).concat(f.unpinned || [])));
  letzterStand = schnappschuss();     // Zusammengeführtes gilt nicht als eigene Änderung
}

function setStatus(s) {
  // Solange das Abholen klappt, ist der Abgleich in Ordnung – auch wenn
  // der Live-Strom gerade neu aufgebaut wird.
  if (s === 'verbinde' && letzterEmpfang && Date.now() - letzterEmpfang < 40000) s = 'live';
  syncStatus = s;
  renderSyncCard();
}

/* --- verbinden und zuhören --- */
let neuversuch = null, wartezeit = 2000;

async function syncConnect() {
  if (!RAUM) return;
  clearTimeout(neuversuch); neuversuch = null;
  try { RAUMKEY = await keyAus(RAUM.k); } catch (e) { setStatus('aus'); return; }
  if (quelle) { quelle.close(); quelle = null; }
  setStatus('verbinde');

  quelle = new EventSource(raumUrl());
  quelle.addEventListener('put', ev => uebernehmen(ev.data));
  quelle.addEventListener('patch', ev => uebernehmen(ev.data));
  quelle.onopen = () => { wartezeit = 2000; setStatus('live'); syncPull(); };
  quelle.onerror = () => { setStatus('offline'); spaeterNochmal(); };
}

/* Eine abgerissene Verbindung kommt von allein nicht immer zurück –
   auf dem Handy reißt sie bei jedem Sperren des Bildschirms ab. */
function spaeterNochmal() {
  if (!RAUM || neuversuch) return;
  neuversuch = setTimeout(() => {
    neuversuch = null;
    wartezeit = Math.min(wartezeit * 2, 30000);
    syncConnect();
  }, wartezeit);
}

/* Prüfen, ob die Leitung wirklich noch steht, und sonst neu aufbauen. */
function syncPruefen(grund) {
  if (!RAUM) return;
  const zu = !quelle || quelle.readyState === 2;          // 2 = geschlossen
  const stumm = letzterEmpfang && Date.now() - letzterEmpfang > 120000;
  if (zu || (grund === 'sichtbar' && quelle.readyState !== 1)) {
    wartezeit = 2000;
    syncConnect();
  } else if (grund === 'sichtbar' || stumm) {
    syncPush();       // eigene Änderungen nachreichen, falls offline etwas dazukam
  }
}

addEventListener('online', () => { syncPruefen('online'); syncPull(); });
addEventListener('visibilitychange', () => {
  if (!document.hidden) { syncPruefen('sichtbar'); syncPull(); }
});
addEventListener('focus', () => syncPruefen('sichtbar'));
setInterval(() => syncPruefen('herzschlag'), 25000);
// Sicherheitsnetz: alle 20 Sekunden aktiv nachsehen, solange die App offen ist
setInterval(() => { if (!document.hidden) syncPull(); }, 20000);

function uebernehmen(rohdaten) {
  setStatus('live');
  let paket;
  try {
    const nachricht = JSON.parse(rohdaten);
    paket = nachricht && nachricht.path === '/' ? nachricht.data : null;
    if (!paket && nachricht && nachricht.data && nachricht.data.ct) paket = nachricht.data;
  } catch (e) { return; }
  verarbeitePaket(paket);
}

/* Ein empfangenes Paket auswerten – gleich ob es aus dem Live-Strom
   kam oder direkt abgeholt wurde. */
async function verarbeitePaket(paket, laut) {
  if (!paket || !paket.ct) {                 // Raum noch leer: wir legen den ersten Stand hinein
    raumInhalt = { leer: true, zeit: Date.now() };
    letzterPush = ''; syncPush(true);
    renderSyncCard();
    return;
  }
  if (paket.von === GERAET) {
    // Unser eigener Nachhall. Trotzdem nachsehen, ob wir inzwischen mehr
    // wissen – etwa Änderungen, die während der Funkstille entstanden sind.
    letzterEmpfang = Date.now();
    try {
      const eigen = await entschluesseln(paket);
      raumInhalt = beschreibe(eigen, 'diesem Gerät');
      if (vergleichbar(eigen) !== vergleichbar(teilbar())) { letzterPush = ''; syncPush(true); }
      else if (laut) toast('Der Raum ist auf demselben Stand ✓');
    } catch (e) {}
    renderSyncCard();
    return;
  }

  try {
    const fremd = await entschluesseln(paket);
    letzteFremdFassung = fremd.fassung || 0;
    letzterEmpfang = Date.now();
    raumInhalt = beschreibe(fremd, 'einem anderen Gerät');
    const fremdStr = vergleichbar(fremd);
    const vorher = vergleichbar(teilbar());
    verschmelzen(fremd);
    syncPinned();
    save(true);                              // ohne Rückweg, sonst ginge es im Kreis
    renderCrew(); renderAll(); renderSyncCard();

    // Nur zurückschreiben, wenn wir etwas wissen, das drüben fehlt.
    // Sonst würden sich zwei Geräte gegenseitig endlos anstupsen.
    const jetztStr = vergleichbar(teilbar());
    if (jetztStr !== fremdStr) { letzterPush = ''; syncPush(true); }
    else letzterPush = kanon(teilbar());
    if (jetztStr !== vorher) toast('Von den anderen aktualisiert 🔄');
    else if (laut) toast('Nichts Neues im Raum');
  } catch (e) {
    toast('Ein Paket ließ sich nicht entschlüsseln');
  }
}

const beschreibe = (q, wer) => ({
  termine: (q.entries || []).length,
  ideen: (q.custom || []).length,
  fassung: q.fassung || 0,
  wer, zeit: Date.now(),
});

/* Sofort senden und ehrlich berichten, ob es angekommen ist. */
async function sendeJetzt() {
  if (!RAUM) { toast('Kein Raum eingerichtet'); return; }
  if (!RAUMKEY) {                 // direkt nach dem Start kurz warten statt scheitern
    try { RAUMKEY = await keyAus(RAUM.k); } catch (e) { toast('Schlüssel unlesbar'); return; }
  }
  clearTimeout(pushTimer);
  try {
    const paket = await verschluesseln(teilbar());
    const body = JSON.stringify(paket);
    letztePaketGroesse = body.length;
    const r = await fetch(raumUrl(), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
    });
    if (!r.ok) throw new Error('Antwort ' + r.status);
    letzterPush = kanon(teilbar());
    raumInhalt = beschreibe(teilbar(), 'diesem Gerät');
    letzterVersand = Date.now();
    letzterFehler = null;
    setStatus('live');
    toast('Im Raum abgelegt ✓');
  } catch (e) {
    merkeFehler('Senden', e);
    setStatus('offline');
    toast('Senden fehlgeschlagen: ' + ((e && e.message) || 'kein Netz'));
  }
  renderSyncCard();
}

/* Direkt abholen, ohne auf den Live-Strom angewiesen zu sein.
   Auf iPhones stirbt der Strom gern unbemerkt – das hier geht immer. */
async function syncPull(laut) {
  if (!RAUM) return;
  if (!RAUMKEY) {
    try { RAUMKEY = await keyAus(RAUM.k); } catch (e) { return; }
  }
  try {
    const r = await fetch(raumUrl() + '?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const paket = await r.json();
    letzterEmpfang = Date.now();       // erfolgreicher Kontakt zählt, auch bei leerem Raum
    setStatus('live');
    await verarbeitePaket(paket, laut);
  } catch (e) {
    merkeFehler('Abholen', e);
    setStatus('offline');
    if (laut) toast('Raum nicht erreichbar');
  }
}

/* --- eigene Änderungen hochschicken (gebündelt) --- */
function syncPush(sofort) {
  if (!RAUM || !RAUMKEY) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const inhalt = kanon(teilbar());
    if (inhalt === letzterPush) return;              // nichts Neues
    try {
      const paket = await verschluesseln(teilbar());
      const body = JSON.stringify(paket);
      letztePaketGroesse = body.length;
      const r = await fetch(raumUrl(), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
      });
      if (!r.ok) throw new Error('Antwort ' + r.status);
      letzterPush = inhalt;
      letzterVersand = Date.now();
      letzterFehler = null;
      setStatus('live');
    } catch (e) {
      merkeFehler('Senden', e);
      setStatus('offline');                          // beim nächsten Mal erneut versuchen
    }
  }, sofort ? 50 : 500);
}

/* --- Raum anlegen, betreten, verlassen --- */
async function raumStarten(dbUrl) {
  const db = dbUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[\w.-]+\.(firebasedatabase\.app|firebaseio\.com)$/.test(db)) {
    toast('Das sieht nicht nach einer Firebase-Adresse aus');
    return false;
  }
  const schluessel = b64u(crypto.getRandomValues(new Uint8Array(16)));
  RAUM = { db, id: b64u(crypto.getRandomValues(new Uint8Array(12))), k: schluessel };
  localStorage.setItem(SYNC_KEY, JSON.stringify(RAUM));
  letzterPush = '';
  await syncConnect();
  return true;
}

function raumBeenden() {
  if (quelle) { quelle.close(); quelle = null; }
  RAUM = null; RAUMKEY = null; letzterPush = '';
  localStorage.removeItem(SYNC_KEY);
  setStatus('aus');
}

const familienLink = () => RAUM
  ? location.origin + location.pathname + '#f=' + b64u(new TextEncoder().encode(JSON.stringify(RAUM)))
  : '';

function syncLaden() {
  try {
    const roh = localStorage.getItem(SYNC_KEY);
    if (roh) { RAUM = JSON.parse(roh); syncConnect().then(() => syncPull()); }
  } catch (e) {}
}

/* ============================================================
   4b. Wetter (Open-Meteo, ohne Schlüssel, mit Zwischenspeicher)
   ============================================================ */

const WX_KEY = 'berlin2026_wetter_v1';
const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405'
             + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
             + '&timezone=Europe%2FBerlin&forecast_days=16';

/* WMO-Codes → Symbol und Klartext */
const WX_CODES = {
  0:  ['☀️', 'klar'],            1: ['🌤️', 'meist sonnig'], 2: ['⛅', 'wechselnd bewölkt'],
  3:  ['☁️', 'bedeckt'],         45: ['🌫️', 'Nebel'],        48: ['🌫️', 'Nebel'],
  51: ['🌦️', 'leichter Niesel'], 53: ['🌦️', 'Niesel'],       55: ['🌦️', 'starker Niesel'],
  56: ['🌧️', 'gefrierender Niesel'], 57: ['🌧️', 'gefrierender Niesel'],
  61: ['🌧️', 'leichter Regen'],  63: ['🌧️', 'Regen'],        65: ['🌧️', 'starker Regen'],
  66: ['🌧️', 'Eisregen'],        67: ['🌧️', 'Eisregen'],
  71: ['🌨️', 'leichter Schnee'], 73: ['🌨️', 'Schnee'],       75: ['🌨️', 'starker Schnee'],
  77: ['🌨️', 'Schneegriesel'],   80: ['🌦️', 'Schauer'],       81: ['🌧️', 'Schauer'],
  82: ['⛈️', 'kräftige Schauer'], 85: ['🌨️', 'Schneeschauer'], 86: ['🌨️', 'Schneeschauer'],
  95: ['⛈️', 'Gewitter'],        96: ['⛈️', 'Gewitter mit Hagel'], 99: ['⛈️', 'Gewitter mit Hagel'],
};

let WX = { days: {}, at: 0 };

function wxOf(date) { return WX.days[date] || null; }

function loadWxCache() {
  try {
    const raw = localStorage.getItem(WX_KEY);
    if (raw) WX = JSON.parse(raw);
  } catch (e) {}
}

async function fetchWx(manual) {
  const frisch = Date.now() - (WX.at || 0) < 3 * 3600e3;
  if (frisch && !manual) return;
  try {
    const r = await fetch(WX_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const d = j.daily, days = {};
    d.time.forEach((t, n) => {
      days[t] = { c: d.weather_code[n], max: Math.round(d.temperature_2m_max[n]),
                  min: Math.round(d.temperature_2m_min[n]),
                  rain: d.precipitation_probability_max[n] };
    });
    WX = { days, at: Date.now() };
    localStorage.setItem(WX_KEY, JSON.stringify(WX));
    renderStrip(); renderDays(); renderWxCard();
    if (manual) toast('Wetter aktualisiert ☀️');
  } catch (e) {
    if (manual) toast(WX.at ? 'Kein Netz – zeige gespeichertes Wetter' : 'Wetter gerade nicht erreichbar');
  }
}

function wxBadge(date) {
  const w = wxOf(date);
  if (!w) return '';
  const [em, txt] = WX_CODES[w.c] || ['🌡️', ''];
  const nass = w.rain != null && w.rain >= 50;
  return `<span class="wx${nass ? ' wet' : ''}" title="${esc(txt)}">${em} ${w.max}°<small>/${w.min}°</small>${
    w.rain != null ? ` <b>${w.rain}%</b>` : ''}</span>`;
}

function renderSyncCard() {
  const box = $('#syncBox');
  if (!box) return;
  // Ampel aus dem, was wirklich passiert – nicht nur aus dem Live-Strom.
  const jetzt = Date.now();
  const empfangFrisch = letzterEmpfang && jetzt - letzterEmpfang < 45000;
  const sendenKlemmt = letzterFehler && letzterFehler.was === 'Senden'
                    && letzterFehler.zeit > letzterVersand;
  let em, txt;
  if (sendenKlemmt && empfangFrisch) {
    em = '🟠'; txt = 'Empfang läuft – aber Senden klemmt';
  } else if (syncStatus === 'live' || empfangFrisch) {
    em = '🟢'; txt = 'live – alle sehen dasselbe';
  } else if (syncStatus === 'verbinde') {
    em = '🟡'; txt = 'verbinde …';
  } else if (syncStatus === 'offline') {
    em = '🔴'; txt = 'kein Netz, läuft lokal weiter';
  } else { em = '⚪'; txt = 'aus'; }

  if (!RAUM) {
    box.innerHTML = `
      <p class="muted">Damit alle sofort sehen, wem was gefällt, braucht die App einen
        gemeinsamen Speicher. Einmal einrichten, dann läuft es von allein.</p>
      <label class="field"><span>Adresse eurer Firebase-Datenbank</span>
        <input type="url" id="syncDb" inputmode="url"
          placeholder="https://…-default-rtdb.europe-west1.firebasedatabase.app"></label>
      <div class="btnrow"><button class="btn btn-main" id="syncStart">🔄 Familien-Raum starten</button></div>
      <p class="muted" style="margin-top:10px">Die Anleitung dazu hat dir Claude geschickt.
        Wer den Familien-Link bekommt, muss nichts einrichten.</p>`;
    return;
  }
  const uhr = t => t ? `${d2(new Date(t).getHours())}:${d2(new Date(t).getMinutes())}` : '–';
  const alt = letzteFremdFassung !== null && letzteFremdFassung < FASSUNG;
  box.innerHTML = `
    <div class="syncstate"><span>${em}</span><b>${esc(txt)}</b></div>
    ${alt ? `<div class="hint" style="background:#ffe8e2;color:#a3341f"><b>Achtung:</b>
      Ein anderes Gerät läuft noch mit einer älteren Fassung (${letzteFremdFassung || '?'})
      und kann Einträge überschreiben. Dort die App einmal ganz schließen und neu öffnen –
      oder unten „App erneuern“ drücken.</div>` : ''}
    <p class="muted">Alle mit dem Familien-Link sehen Stimmen, Termine und Häkchen sofort.
      Der Plan wird verschlüsselt übertragen – der Schlüssel steckt nur im Link.</p>
    <div class="diag">
      <div><b>Fassung</b><span>${FASSUNG}${letzteFremdFassung !== null
        ? ` · andere: ${letzteFremdFassung || 'alt'}` : ''}</span></div>
      <div><b>Raum</b><span>${esc(RAUM.id.slice(0, 8))}…</span></div>
      <div><b>Auf diesem Gerät</b><span>${S.entries.length} Termine, ${(S.custom || []).length} eigene Ideen</span></div>
      <div><b>Im Raum</b><span>${raumInhalt
        ? (raumInhalt.leer ? 'noch leer'
           : `${raumInhalt.termine} Termine, ${raumInhalt.ideen} eigene Ideen · von ${esc(raumInhalt.wer)}`)
        : 'noch nicht nachgesehen'}</span></div>
      <div><b>Zuletzt empfangen</b><span>${uhr(letzterEmpfang)} Uhr</span></div>
      <div><b>Zuletzt gesendet</b><span>${uhr(letzterVersand)} Uhr${
        letztePaketGroesse ? ` · Paket ${mb(letztePaketGroesse)}` : ''}</span></div>
      ${letzterFehler ? `<div style="background:#ffe8e2"><b>Letzter Fehler</b><span>${
        esc(letzterFehler.was)} um ${uhr(letzterFehler.zeit)}: ${esc(letzterFehler.text)}</span></div>` : ''}
    </div>
    ${sendenKlemmt && letztePaketGroesse > 700000 ? `<div class="hint">Das Paket ist mit
      ${mb(letztePaketGroesse)} recht groß – vermutlich stecken Fotos in eigenen Ideen.
      Bei schwachem Netz hilft: ins WLAN gehen oder die Fotos aus den Ideen nehmen.</div>` : ''}
    <div class="btnrow">
      <button class="btn btn-main" id="syncShare">👨‍👩‍👧 Familien-Link teilen</button>
      <button class="btn" id="syncNow">⬆︎ Meinen Stand senden</button>
      <button class="btn" id="syncGet">⬇︎ Raum abholen</button>
      <button class="btn" id="syncFresh">🔃 App erneuern</button>
      <button class="btn btn-danger" id="syncStop">Abgleich beenden</button>
    </div>`;
}

function renderWxCard() {
  const box = $('#wxList');
  if (!box) return;
  if (!WX.at) { box.innerHTML = '<p class="muted">Noch keine Wetterdaten geladen.</p>'; return; }
  const stand = new Date(WX.at);
  box.innerHTML = DAYS.map(d => {
    const w = wxOf(d), f = fmtDay(d);
    const [em, txt] = w ? (WX_CODES[w.c] || ['🌡️', '']) : ['–', 'keine Daten'];
    return `<div class="wxrow${w && w.rain >= 50 ? ' wet' : ''}">
      <b>${f.wds} ${f.num}.8.</b><span class="e">${em}</span>
      <span class="t">${w ? w.max + '° / ' + w.min + '°' : '–'}</span>
      <span class="d">${esc(txt)}</span>
      ${w && w.rain != null ? `<span class="r">💧 ${w.rain} %</span>` : ''}</div>`;
  }).join('') + `<p class="muted" style="margin:10px 0 0">Stand: ${
    d2(stand.getDate())}.${d2(stand.getMonth() + 1)}. um ${d2(stand.getHours())}:${d2(stand.getMinutes())} Uhr
    · Vorhersage für Berlin-Mitte von Open-Meteo</p>`;
}

/* ============================================================
   5. Kopf & Held
   ============================================================ */

/* Auswahl für die Figuren. Schwarze Haare gibt es in Unicode nicht als
   eigenes Zeichen – die Standardfigur wird auf iPhone und Android dunkel
   gezeichnet, deshalb steht sie hier vorn. */
const AVATARE = ['👨', '🧔', '👨‍🦱', '🧑', '👱‍♂️', '👨‍🦰', '👨‍🦳', '🧑‍🦲',
                 '👩', '👩‍🦱', '👱‍♀️', '👩‍🦰', '👵', '👴',
                 '🌻', '🦄', '🎬', '🎧', '🐻', '🦊', '🐬', '🚀', '⚽', '🎸'];

function renderCrew() {
  $('#crewStrip').innerHTML = PEOPLE.map(p =>
    `<div class="av" style="background:${p.color}22;color:${p.color}" title="${esc(p.name)}">${avatarOf(p)}</div>`).join('');
  $('#crewList').innerHTML = PEOPLE.map(p => `
    <button class="person" data-avatar="${p.id}">
      <span class="av" style="background:${p.color}22">${avatarOf(p)}</span>
      <span><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span>
      <span class="edit">✏️</span>
    </button>`).join('');
}

function sheetAvatar(pid) {
  const p = PEOPLE.find(x => x.id === pid);
  if (!p) return;
  openSheet(`Figur für ${esc(p.name)}`, `
    <div class="avgrid">${AVATARE.map(a =>
      `<button class="avpick${avatarOf(p) === a ? ' on' : ''}" data-setav="${pid}|${a}">${a}</button>`).join('')}</div>
    <p class="hint">Wie die Figuren genau aussehen, entscheidet das Gerät –
      auf dem iPhone werden sie anders gezeichnet als auf dem Computer.</p>
    <div class="sheet-acts"><button class="btn btn-ghost" data-close>Schließen</button></div>`);
}

function renderHero() {
  const t = todayIso();
  const total = DAYS.length;
  let kicker = 'Vorfreude', title = '';
  if (t < TRIP.start) {
    const n = Math.round((parse(TRIP.start) - parse(t)) / 864e5);
    title = n === 1 ? 'Noch ein Mal schlafen!' : `Noch ${n} Mal schlafen!`;
  } else if (t > TRIP.end) {
    kicker = 'Rückblick'; title = 'Das waren zwei gute Wochen.';
  } else {
    const n = Math.round((parse(t) - parse(TRIP.start)) / 864e5) + 1;
    kicker = `Tag ${n} von ${total}`;
    const heute = S.entries.filter(e => e.date === t);
    title = heute.length
      ? heute.map(e => (ideaById(e.ideaId) || {}).emoji || '📍').join(' ') + ' Heute geht was!'
      : 'Heute ist noch nichts geplant.';
  }
  $('#heroKicker').textContent = kicker;
  $('#heroTitle').textContent = title;
  const planned = S.entries.length;
  $('#planCount').textContent = planned;
  const daysUsed = new Set(S.entries.map(e => e.date)).size;
  $('#heroBar').style.width = Math.min(100, Math.round(daysUsed / total * 100)) + '%';
  $('#heroSub').textContent = daysUsed === 0
    ? 'Tippt auf ein leeres Feld oder auf eine Idee, um sie einzuplanen.'
    : `An ${daysUsed} von ${total} Tagen ist schon etwas los.`;
}

/* ============================================================
   6. Plan-Ansicht
   ============================================================ */

function renderStrip() {
  const t = todayIso();
  $('#dayStrip').innerHTML = DAYS.map(d => {
    const f = fmtDay(d);
    const has = S.entries.some(e => e.date === d);
    const w = wxOf(d);
    const wx = w ? `<u>${(WX_CODES[w.c] || ['🌡️'])[0]}<em>${w.max}°</em></u>` : '';
    return `<button class="dchip${has ? ' has' : ''}${d === t ? ' today' : ''}${f.we ? ' we' : ''}" data-jump="${d}">
      <small>${f.wds}</small><b>${f.num}</b>${wx}<i></i></button>`;
  }).join('');
}

function entryHtml(e) {
  const idea = ideaById(e.ideaId) || { emoji: '📍', title: 'Unbekannt', cat: 'alle' };
  const label = e.label || idea.title;
  const votes = S.votes[e.ideaId] || {};
  const who = PEOPLE.filter(p => votes[p.id]).map(p =>
    `<i style="background:${p.color}22;color:${p.color}">${avatarOf(p)}</i>`).join('');
  const bits = [];
  if (e.time) bits.push(e.time + ' Uhr');
  if (e.groupLabel) bits.push(e.groupLabel);
  if (e.note) bits.push(e.note);
  if (!bits.length && idea.sub) bits.push(idea.sub);
  const mp = mainPic(idea);
  const pic = mp
    ? `<span class="em thumb"><img src="${imgSrc(mp)}" alt="" loading="lazy"><i>${e.done ? '✅' : idea.emoji}</i></span>`
    : `<span class="em">${e.done ? '✅' : idea.emoji}</span>`;
  return `<button class="entry k-${idea.cat}${e.done ? ' done' : ''}${e.fixed ? ' fixed' : ''}" data-entry="${e.id}">
    ${pic}
    <span class="txt"><b>${esc(label)}</b><small>${esc(bits.join(' · '))}</small></span>
    <span class="who">${who}</span>
  </button>`;
}

function renderDays() {
  const t = todayIso();
  $('#days').innerHTML = DAYS.map(d => {
    const f = fmtDay(d);
    const banners = entriesOf(d, 'tag');
    const bday = d === '2026-08-09' ? '<span class="badge">🎂 Carla wird 16</span>' : '';
    const leer = !SLOTS.some(s => entriesOf(d, s.id).length);
    // Leere Tage bleiben flach – sonst scrollt man sich zwei Wochen lang die Finger wund.
    const slots = leer
      ? `<div class="quickadd">${SLOTS.map(s =>
          `<button class="add mini" data-add="${d}|${s.id}">${s.em} ${s.short}</button>`).join('')}</div>`
      : SLOTS.filter(s => s.id !== 'tag').map(s => {
          const items = entriesOf(d, s.id);
          return `<div class="slot">
            <div class="slot-label"><em>${s.em}</em>${s.label}</div>
            <div class="slot-items">
              ${items.map(entryHtml).join('')}
              <button class="add" data-add="${d}|${s.id}">＋ ${s.short}</button>
            </div></div>`;
        }).join('');
    return `<section class="day${d === t ? ' today' : ''}${f.we ? ' we' : ''}" id="day-${d}">
      <div class="day-head"><b>${f.wd}</b><span>${f.num}. ${f.mon}</span>${wxBadge(d)}${bday}</div>
      ${banners.map(e => {
        const idea = ideaById(e.ideaId) || { emoji: '📍', title: '' };
        const bp = mainPic(idea);
        return `<button class="banner${bp ? ' haspic' : ''}" data-entry="${e.id}" style="width:calc(100% - 24px)${
          bp ? `;background-image:linear-gradient(100deg,rgba(255,247,232,.97) 42%,rgba(255,247,232,.35)),url(${imgSrc(bp)})` : ''}">
          <span class="bem">${idea.emoji}</span>
          <span style="text-align:left;flex:1;min-width:0">
            <b>${esc(e.label || idea.title)}</b>
            <small>${esc([e.time ? e.time + ' Uhr' : (istFlexibel(idea) ? '🔄 flexibel' : 'ganzer Tag'),
              e.groupLabel, e.note].filter(Boolean).join(' · '))}</small>
          </span></button>`;
      }).join('')}
      <div class="slots">${slots}
        ${leer ? '' : `<button class="add" data-add="${d}|tag">＋ Etwas für den ganzen Tag</button>`}
        ${hintsFor(d).map(i => `<button class="maybe" data-maybe="${i.id}|${d}">
          <span>${i.emoji}</span> möglich: <b>${esc(i.title)}</b> <em>eintragen ＋</em></button>`).join('')}
      </div>
    </section>`;
  }).join('');
}

/* ============================================================
   7. Ideen-Ansicht
   ============================================================ */

let filter = 'alle';

function renderFilters() {
  $('#filters').innerHTML = CATS.map(c =>
    `<button class="fchip${filter === c.id ? ' on' : ''}" data-cat="${c.id}">${c.label}</button>`).join('');
}

/* Offizielle Seiten zu einer Idee */
function linksHtml(i) {
  const list = LINKS[i.id] || (i.url ? [['Website öffnen', i.url]] : []);
  if (!list.length) return '';
  return `<div class="links"><h5>Offizielle Seiten</h5>${list.map(([label, url]) =>
    `<a href="${url}" target="_blank" rel="noopener">${esc(label)} <span>↗</span></a>`).join('')}</div>`;
}

/* Fotostrecke: seitlich durchwischen, Punkte zeigen die Position. */
function galleryHtml(i) {
  const pics = i.pics || [];
  if (!pics.length) return '';
  return `<div class="gal" data-gal="${i.id}">
    <div class="gal-track">${pics.map(k => `
      <figure><img src="${imgSrc(k)}" alt="${esc(capOf(k) || i.title)}" loading="lazy">
        ${capOf(k) ? `<figcaption>${esc(capOf(k))}</figcaption>` : ''}</figure>`).join('')}
    </div>
    ${pics.length > 1 ? `<div class="dots">${pics.map((_, n) =>
      `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="swipehint">← wischen für mehr Fotos →</div>` : ''}
  </div>`;
}

/* Punkte mitlaufen lassen (einmal pro Galerie registriert) */
function wireGalleries() {
  $$('.gal').forEach(g => {
    const track = $('.gal-track', g), dots = $$('.dots i', g);
    if (!dots.length || track.dataset.wired) return;
    track.dataset.wired = '1';
    track.addEventListener('scroll', () => {
      const n = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, k) => d.classList.toggle('on', k === n));
      g.classList.toggle('scrolled', track.scrollLeft > 8);
    }, { passive: true });
  });
}

function tagHtml(t) {
  if (typeof t === 'string') return `<span class="tag">${esc(t)}</span>`;
  return `<span class="tag ${t.k || ''}">${esc(t.t)}</span>`;
}

function renderIdeas() {
  const list = allIdeas().filter(i => filter === 'alle' || i.cat === filter);
  $('#ideas').innerHTML = list.map(i => {
    const votes = S.votes[i.id] || {};
    const placed = entriesForIdea(i.id);
    const where = placed.length
      ? '📌 Eingeplant: ' + [...new Set(placed.map(e => {
          const f = fmtDay(e.date); return `${f.wds}. ${f.num}.8.`;
        }))].join(', ')
      : '';
    return `<article class="idea k-${i.cat}" data-idea="${i.id}">
      ${galleryHtml(i)}
      <div class="idea-top">
        <div class="idea-em">${i.emoji}</div>
        <div class="idea-h"><b>${esc(i.title)}</b><span>${esc(i.sub || '')}</span></div>
      </div>
      <div class="tags">${(i.tags || []).map(tagHtml).join('')}</div>
      <div class="voters"><span class="lbl">Wer will?</span>${PEOPLE.map(p => {
        const v = votes[p.id] || 0;
        return `<button class="vote v${v}" data-vote="${i.id}|${p.id}"
          style="background:${p.color}22" title="${esc(p.name)}">${avatarOf(p)}</button>`;
      }).join('')}</div>
      ${where ? `<div class="planned-on">${esc(where)}</div>` : ''}
      <div class="idea-acts">
        <button class="btn btn-main" data-plan="${i.id}">📅 Einplanen</button>
        <button class="btn btn-ghost" data-more="${i.id}">Infos</button>
        ${i.custom ? `<button class="btn btn-ghost" data-editidea="${i.id}">✏️</button>
        <button class="btn btn-danger" data-delidea="${i.id}">🗑</button>` : ''}
      </div>
      <div class="detail" id="det-${i.id}">
        <p>${i.info || 'Keine weiteren Infos hinterlegt.'}</p>
        ${i.program ? `<ul>${i.program.filter(p => p.date >= TRIP.start && p.date <= TRIP.end).map(p => {
          const f = fmtDay(p.date);
          return `<li><b>${f.wds}, ${f.num}.8.<br>${p.time}</b><span>${esc(p.title)}</span>
            <button data-prog="${i.id}|${p.date}|${p.time}|${esc(p.title)}">＋ Einplanen</button></li>`;
        }).join('')}</ul>` : ''}
        ${linksHtml(i)}
      </div>
    </article>`;
  }).join('') || '<p class="muted" style="text-align:center;padding:30px 0">Hier ist noch nichts. Legt eine eigene Idee an!</p>';
  wireGalleries();
}

/* ============================================================
   8. Bottom-Sheet
   ============================================================ */

function openSheet(title, html) {
  $('#sheetTitle').innerHTML = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetWrap').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheetWrap').hidden = true;
  document.body.style.overflow = '';
}

/* --- Idee auf einen Tag legen --- */
let pick = { ideaId: null, date: null, slot: null, time: '', label: '', note: '' };

function sheetPlan(ideaId, presetDate, presetSlot) {
  const idea = ideaById(ideaId);
  if (!idea) return;
  pick = { ideaId, date: presetDate || null,
           slot: presetSlot || idea.slot || (idea.days ? 'tag' : null),
           time: '', label: '', note: '' };
  drawPlanSheet();
}

function drawPlanSheet() {
  const idea = ideaById(pick.ideaId);
  const multi = idea.days > 1;
  const html = `
    ${mainPic(idea) ? `<div class="sheet-pic"><img src="${imgSrc(mainPic(idea))}" alt="${esc(capOf(mainPic(idea)))}"></div>` : ''}
    <p class="muted" style="margin-bottom:4px">${idea.emoji} <b>${esc(idea.title)}</b></p>
    <h4>An welchem Tag?</h4>
    <div class="daygrid">${DAYS.map(d => {
      const f = fmtDay(d);
      const passt = dayFits(idea, d);
      return `<button class="dsel${pick.date === d ? ' on' : ''}${passt ? '' : ' off'}" data-pdate="${d}">
        <small>${f.wds}</small><b>${f.num}.8.</b></button>`;
    }).join('')}</div>
    ${(idea.from || idea.to) ? `<div class="hint">Diese Idee geht nur ${
      idea.from && idea.to ? `vom ${fmtDay(idea.from).num}.8. bis ${fmtDay(idea.to).num}.8.`
      : idea.from ? `ab dem ${fmtDay(idea.from).num}.8.` : `bis zum ${fmtDay(idea.to).num}.8.`
      } – die anderen Tage sind ausgegraut.</div>` : ''}
    ${multi ? `<div class="hint">Diese Idee dauert ${idea.days} Tage – sie blockt ab dem gewählten Tag automatisch ${idea.days} Tage.</div>` : `
    <h4>Wann am Tag?</h4>
    <div class="slotsel">${SLOTS.map(s =>
      `<button class="ssel${pick.slot === s.id ? ' on' : ''}" data-pslot="${s.id}">${s.em} ${s.short}</button>`).join('')}</div>
    <label class="field"><span>Uhrzeit (optional)</span>
      <input type="time" id="pTime" value="${pick.time}"></label>`}
    <label class="field"><span>Notiz (optional)</span>
      <input type="text" id="pNote" placeholder="z. B. Treffpunkt, Tickets, wer mitkommt" value="${esc(pick.note)}"></label>
    <div class="sheet-acts">
      <button class="btn btn-ghost" data-close>Abbrechen</button>
      <button class="btn btn-main" id="pSave">Eintragen</button>
    </div>`;
  openSheet('📅 Einplanen', html);
}

function commitPlan() {
  const idea = ideaById(pick.ideaId);
  if (!pick.date) { toast('Bitte einen Tag auswählen 🙂'); return; }
  const note = ($('#pNote') || {}).value || '';
  const time = ($('#pTime') || {}).value || '';
  if (idea.days > 1) {
    const g = uid();
    for (let k = 0; k < idea.days; k++) {
      const d = addDays(pick.date, k);
      if (d > TRIP.end) break;
      S.entries.push({ id: uid(), ideaId: idea.id, date: d, slot: 'tag', time: k === 0 ? time : '',
                       note: k === 0 ? note : '', groupLabel: `Tag ${k + 1} von ${idea.days}`,
                       group: g, done: false });
    }
  } else {
    S.entries.push({ id: uid(), ideaId: idea.id, date: pick.date, slot: pick.slot || 'nm',
                     time, note, label: pick.label || '', done: false });
  }
  save(); closeSheet(); renderAll();
  const f = fmtDay(pick.date);
  toast(`${idea.emoji} ${f.wds}, ${f.num}. August eingetragen!`);
  confetti();
}

/* --- Eintrag bearbeiten --- */
function sheetEntry(eid) {
  const e = S.entries.find(x => x.id === eid);
  if (!e) return;
  const idea = ideaById(e.ideaId) || {};
  const f = fmtDay(e.date);
  openSheet(`${idea.emoji || '📍'} ${esc(e.label || idea.title || '')}`, `
    ${mainPic(idea) ? `<div class="sheet-pic"><img src="${imgSrc(mainPic(idea))}" alt="${esc(capOf(mainPic(idea)))}"></div>` : ''}
    <p class="muted">${f.wd}, ${f.num}. ${f.mon} · ${SLOTS.find(s => s.id === e.slot)?.short || ''}</p>
    ${e.groupLabel ? `<div class="hint">Teil des mehrtägigen Ausflugs (${esc(e.groupLabel)}).</div>` : ''}
    <label class="field"><span>Uhrzeit</span><input type="time" id="eTime" value="${e.time || ''}"></label>
    <label class="field"><span>Notiz</span><textarea id="eNote" placeholder="Tickets, Treffpunkt, wer kommt mit …">${esc(e.note || '')}</textarea></label>
    <div class="sheet-acts">
      <button class="btn ${e.done ? 'btn-ghost' : ''}" id="eDone">${e.done ? '↩︎ Doch nicht erledigt' : '✅ Erledigt'}</button>
      <button class="btn btn-main" id="eSave">Speichern</button>
    </div>
    <div class="sheet-acts">
      <button class="btn btn-ghost" id="eMove">📅 Auf anderen Tag</button>
      <button class="btn btn-danger" id="eDel">🗑 Entfernen</button>
    </div>
    ${idea.info ? `<h4>Infos</h4><div style="font-size:13.5px;color:#3d4454">${idea.info}</div>` : ''}
    ${linksHtml(idea)}
  `);

  $('#eSave').onclick = () => {
    e.time = $('#eTime').value; e.note = $('#eNote').value;
    save(); closeSheet(); renderAll(); toast('Gespeichert ✓');
  };
  $('#eDone').onclick = () => {
    e.done = !e.done; save(); closeSheet(); renderAll();
    if (e.done) { toast('Abgehakt! ✅'); confetti(); }
  };
  $('#eDel').onclick = () => {
    if (e.pinned) { S.unpinned = S.unpinned || []; S.unpinned.push(e.ideaId); }
    S.entries = e.group ? S.entries.filter(x => x.group !== e.group) : S.entries.filter(x => x.id !== e.id);
    save(); closeSheet(); renderAll(); toast('Entfernt');
  };
  $('#eMove').onclick = () => {
    const keep = { time: e.time, note: e.note, label: e.label };
    S.entries = e.group ? S.entries.filter(x => x.group !== e.group) : S.entries.filter(x => x.id !== e.id);
    save();
    pick = { ideaId: e.ideaId, date: null, slot: e.slot, time: keep.time, label: keep.label, note: keep.note };
    drawPlanSheet();
  };
}

/* --- Idee für einen leeren Platz auswählen --- */
function sheetPickIdea(date, slot) {
  const f = fmtDay(date);
  const s = SLOTS.find(x => x.id === slot);
  openSheet(`＋ ${f.wds}, ${f.num}. August · ${s.short}`, `
    <div class="picklist">${allIdeas().map(i => `
      <button class="pick" data-pickidea="${i.id}|${date}|${slot}">
        ${mainPic(i) ? `<span class="em thumb"><img src="${imgSrc(mainPic(i))}" alt="" loading="lazy"><i>${i.emoji}</i></span>`
                : `<span class="em">${i.emoji}</span>`}
        <span style="flex:1;min-width:0"><b>${esc(i.title)}</b><small>${esc(i.sub || '')}</small></span>
        ${i.days > 1 ? '<span class="tag">' + i.days + ' Tage</span>' : ''}
      </button>`).join('')}
    </div>
    <div class="sheet-acts"><button class="btn btn-ghost" data-close>Abbrechen</button></div>`);
}

/* --- Eigene Idee --- */
/* Fotos werden vor dem Speichern verkleinert – sonst ist der
   Browserspeicher nach drei Handybildern voll. */
function shrinkPhoto(file, maxPx = 900, quality = .72) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('lesen'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('bild'));
      im.onload = () => {
        const s = Math.min(1, maxPx / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));   // ohne EXIF, also ohne GPS
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const MAXPICS = 4;
let draftPics = [];

function drawDraftPics() {
  const box = $('#nPics');
  if (!box) return;
  box.innerHTML = draftPics.map((p, n) =>
    `<div class="thumbpic"><img src="${p}" alt=""><button data-delpic="${n}" title="Foto entfernen">✕</button></div>`).join('')
    || '<p class="muted" style="margin:0">Noch keine Fotos.</p>';
  $('#nPicCount').textContent = `${draftPics.length}/${MAXPICS}`;
}

function sheetIdeaForm(existing) {
  const e = existing || {};
  draftPics = (e.pics || []).slice();
  openSheet(existing ? '✏️ Idee bearbeiten' : '💡 Eigene Idee', `
    <label class="field"><span>Was wollt ihr machen?</span>
      <input type="text" id="nTitle" placeholder="z. B. Tretboot am Müggelsee" value="${esc(e.title || '')}"></label>
    <label class="field"><span>Wo? (optional)</span>
      <input type="text" id="nSub" placeholder="Ort oder Adresse" value="${esc(e.sub || '')}"></label>

    <h4>Fotos <span style="float:right;font-weight:700" id="nPicCount">0/${MAXPICS}</span></h4>
    <div class="picgrid" id="nPics"></div>
    <label class="btn btn-ghost filebtn">📷 Fotos auswählen
      <input type="file" id="nFile" accept="image/*" multiple hidden></label>

    <h4>Wann am besten?</h4>
    <div class="slotsel five" id="nSlot">
      <button type="button" class="ssel${!e.slot ? ' on' : ''}" data-nslot="">🔄 Flexibel</button>
      ${SLOTS.map(x => `<button type="button" class="ssel${e.slot === x.id ? ' on' : ''}"
        data-nslot="${x.id}">${x.em} ${x.short}</button>`).join('')}
    </div>
    <p class="muted" style="margin:-2px 0 4px"><b>Flexibel</b> heißt: passt zu jeder Tageszeit.
      Sonst schlägt die App beim Einplanen gleich die richtige Zeit vor.</p>

    <h4>Nur an bestimmten Tagen möglich?</h4>
    <div class="range">
      <label class="field"><span>von</span>
        <input type="date" id="nFrom" min="${TRIP.start}" max="${TRIP.end}" value="${e.from || ''}"></label>
      <label class="field"><span>bis</span>
        <input type="date" id="nTo" min="${TRIP.start}" max="${TRIP.end}" value="${e.to || ''}"></label>
    </div>
    <p class="muted" style="margin:-2px 0 4px">Leer lassen, wenn die Idee an jedem Tag geht.
      Sonst werden die anderen Tage beim Einplanen ausgegraut.</p>

    <label class="field"><span>Website (optional)</span>
      <input type="url" id="nUrl" inputmode="url" placeholder="https://…" value="${esc(e.url || '')}"></label>

    <label class="field"><span>Emoji</span>
      <input type="text" id="nEmoji" value="${esc(e.emoji || '⭐')}" maxlength="4"></label>
    <label class="field"><span>Kategorie</span>
      <select id="nCat">${CATS.filter(c => c.id !== 'alle').map(c =>
        `<option value="${c.id}"${e.cat === c.id ? ' selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <label class="field"><span>Notizen (optional)</span>
      <textarea id="nInfo" placeholder="Öffnungszeiten, Preise, was man mitnehmen muss …">${esc(e.raw || '')}</textarea></label>
    <div class="sheet-acts">
      <button class="btn btn-ghost" data-close>Abbrechen</button>
      <button class="btn btn-main" id="nSave">${existing ? 'Änderungen sichern' : 'Idee anlegen'}</button>
    </div>`);

  drawDraftPics();

  $('#nSlot').onclick = ev => {
    const b = ev.target.closest('[data-nslot]');
    if (!b) return;
    $$('#nSlot .ssel').forEach(x => x.classList.toggle('on', x === b));
  };

  $('#nFile').onchange = async ev => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    const platz = MAXPICS - draftPics.length;
    if (platz <= 0) { toast(`Mehr als ${MAXPICS} Fotos gehen nicht 🙂`); return; }
    toast('Fotos werden verkleinert …');
    for (const f of files.slice(0, platz)) {
      try { draftPics.push(await shrinkPhoto(f)); }
      catch (err) { toast('Ein Foto ließ sich nicht lesen'); }
    }
    if (files.length > platz) toast(`Nur ${platz} Foto(s) passten noch dazu`);
    drawDraftPics();
    ev.target.value = '';
  };

  $('#nSave').onclick = () => {
    const title = $('#nTitle').value.trim();
    if (!title) { toast('Die Idee braucht noch einen Namen 🙂'); return; }
    let from = $('#nFrom').value, to = $('#nTo').value;
    if (from && to && to < from) { const x = from; from = to; to = x; }
    let url = $('#nUrl').value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    const raw = $('#nInfo').value.trim();

    const idee = {
      id: e.id || 'c' + uid(), custom: true,
      emoji: $('#nEmoji').value.trim() || '⭐', cat: $('#nCat').value,
      title, sub: $('#nSub').value.trim(),
      raw, info: esc(raw).replace(/\n/g, '<br>'),
      url, from, to, pics: draftPics.slice(),
      slot: ($('#nSlot .ssel.on') || {}).dataset ? $('#nSlot .ssel.on').dataset.nslot : '',
      tags: ['eigene Idee'].concat(slotTag(($('#nSlot .ssel.on') || { dataset: {} }).dataset.nslot) || [])
                           .concat(rangeTag(from, to) || []),
    };
    const merk = S.custom.slice();
    if (e.id) S.custom = S.custom.map(x => x.id === e.id ? idee : x);
    else S.custom.push(idee);
    if (!save()) { S.custom = merk; return; }        // Speicher voll: nichts kaputt machen
    syncPinned(); save();
    closeSheet(); showView('ideen'); renderAll();
    toast(existing ? 'Gespeichert ✓' : 'Idee aufgenommen! 💡');
    if (!existing) confetti();
  };
}

/* „am liebsten abends“ als Merker auf der Karte */
const SLOTWORT = { tag: '🗓️ ganzer Tag', vm: '☀️ vormittags', nm: '🌤️ nachmittags', ab: '🌙 abends' };
/* Eigene Ideen ohne gewählte Tageszeit sind „flexibel“ – dann ist
   „ganzer Tag“ die falsche Beschriftung. */
const istFlexibel = idea => !!(idea && idea.custom && !idea.slot);
function slotTag(slot) {
  if (!slot) return [{ t: '🔄 flexibel', k: 'good' }];
  return SLOTWORT[slot] ? [{ t: SLOTWORT[slot] }] : null;
}

/* „nur 5.–8.8.“ als Merker auf der Karte */
function rangeTag(from, to) {
  if (!from && !to) return null;
  const kurz = d => { const f = fmtDay(d); return `${f.num}.8.`; };
  if (from && to) return [{ t: from === to ? `nur am ${kurz(from)}` : `nur ${kurz(from)}–${kurz(to)}`, k: 'warn' }];
  return [{ t: from ? `ab ${kurz(from)}` : `bis ${kurz(to)}`, k: 'warn' }];
}

/* Ideen mit festem Einzeltag hängen von selbst im Kalender –
   genau wie die Beisetzung und Carlas Geburtstag. */
function syncPinned() {
  S.unpinned = S.unpinned || [];
  allIdeas().forEach(i => {
    const tag = (i.from && i.from === i.to) ? i.from : null;
    const schon = S.entries.filter(e => e.ideaId === i.id && e.pinned);

    if (!tag) {                                   // kein fester Tag (mehr)
      if (schon.length) S.entries = S.entries.filter(e => !(e.ideaId === i.id && e.pinned));
      return;
    }
    if (S.unpinned.includes(i.id)) return;        // von Hand entfernt – bleibt entfernt
    if (schon.length) { schon.forEach(e => { e.date = tag; }); return; }   // Datum geändert
    if (S.entries.some(e => e.ideaId === i.id)) return;                    // schon selbst geplant
    S.entries.push({ id: 'pin-' + i.id, ideaId: i.id, date: tag, slot: i.slot || 'tag', time: '',
                     note: '', done: false, fixed: true, pinned: true });
  });
}

/* Ideen mit kurzem Zeitfenster als Vormerkung an den passenden Tagen zeigen */
function hintsFor(date) {
  return allIdeas().filter(i => {
    if (!i.from || !i.to || i.from === i.to) return false;
    const spanne = Math.round((parse(i.to) - parse(i.from)) / 864e5) + 1;
    if (spanne > 4) return false;                 // längere Zeiträume würden jeden Tag zumüllen
    if (date < i.from || date > i.to) return false;
    return !S.entries.some(e => e.ideaId === i.id);
  });
}

/* Passt der Tag in den Zeitraum der Idee? */
function dayFits(idea, date) {
  if (!idea) return true;
  if (idea.from && date < idea.from) return false;
  if (idea.to && date > idea.to) return false;
  return true;
}

/* ============================================================
   9. Teilen, Text, Kalenderdatei
   ============================================================ */

function b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64dec(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function shareLink() {
  const payload = { entries: S.entries, votes: S.votes, custom: S.custom, todos: S.todos, avatars: S.avatars };
  return location.origin + location.pathname + '#p=' + b64enc(JSON.stringify(payload));
}

function planText() {
  const lines = ['🐻 BERLIN-SOMMER · 2.–16. August 2026', ''];
  DAYS.forEach(d => {
    const f = fmtDay(d);
    const es = SLOTS.flatMap(s => entriesOf(d, s.id));
    if (!es.length) return;
    lines.push(`${f.wd}, ${f.num}. ${f.mon}`);
    SLOTS.forEach(s => entriesOf(d, s.id).forEach(e => {
      const idea = ideaById(e.ideaId) || {};
      const bits = [e.time ? e.time + ' Uhr' : (istFlexibel(idea) ? 'flexibel' : s.short),
                    e.label || idea.title];
      if (e.groupLabel) bits.push('(' + e.groupLabel + ')');
      if (e.note) bits.push('– ' + e.note);
      lines.push('  ' + (e.done ? '✔ ' : '• ') + bits.join(' · '));
    }));
    lines.push('');
  });
  const offen = TODOS.filter(t => !S.todos[t.id]);
  if (offen.length) {
    lines.push('Noch zu erledigen:');
    offen.forEach(t => lines.push('  ☐ ' + t.text));
  }
  return lines.join('\n');
}

function icsFile() {
  const pad = s => s.replace(/-/g, '');
  const escI = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Berlin-Sommer//Urlaubsplaner//DE', 'CALSCALE:GREGORIAN'];
  S.entries.forEach(e => {
    const idea = ideaById(e.ideaId) || {};
    const title = e.label || idea.title || 'Termin';
    out.push('BEGIN:VEVENT', 'UID:' + e.id + '@berlin-sommer');
    if (e.time) {
      const t = e.time.replace(':', '') + '00';
      const endH = d2(Math.min(23, parseInt(e.time.slice(0, 2), 10) + 2));
      out.push('DTSTART:' + pad(e.date) + 'T' + t,
               'DTEND:' + pad(e.date) + 'T' + endH + e.time.slice(3, 5) + '00');
    } else {
      out.push('DTSTART;VALUE=DATE:' + pad(e.date), 'DTEND;VALUE=DATE:' + pad(addDays(e.date, 1)));
    }
    out.push('SUMMARY:' + escI(title));
    const desc = [e.note, e.groupLabel, idea.sub, idea.url].filter(Boolean).join(' · ');
    if (desc) out.push('DESCRIPTION:' + escI(desc));
    if (idea.sub) out.push('LOCATION:' + escI(idea.sub));
    out.push('END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* Teilen: erst das Teilen-Menü des Handys, sonst Zwischenablage,
   sonst ein Feld zum Markieren. Abbrechen ist kein Fehler. */
async function shareOut({ url, text, title, sheetTitle }) {
  const payload = url ? { title, url } : { title, text };
  try {
    if (navigator.share) { await navigator.share(payload); return; }
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return;
  }
  const raw = url || text;
  try {
    await navigator.clipboard.writeText(raw);
    toast('Kopiert! 📋');
    return;
  } catch (e) {}
  openSheet(sheetTitle, `<p class="muted">Markieren und kopieren:</p>
    <textarea class="share-out" readonly>${esc(raw)}</textarea>
    <div class="sheet-acts"><button class="btn btn-main" data-close>Fertig</button></div>`);
}

/* Nur die Adresse der App, ohne Plan – zum Weitergeben an die Familie */
const appLink = () => location.origin + location.pathname;

/* ============================================================
   10. Deko: Toast & Konfetti
   ============================================================ */

let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 2200);
}

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const cols = ['#ffc93c', '#ff6b6b', '#4cc9f0', '#2fd39b', '#9b5de5'];
  const bits = Array.from({ length: 70 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 160, y: innerHeight * .45,
    vx: (Math.random() - .5) * 9, vy: -6 - Math.random() * 8,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    col: cols[(Math.random() * cols.length) | 0],
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    bits.forEach(b => {
      b.vy += .32; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.col; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * .6); ctx.restore();
    });
    if (++frame < 110) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, c.width, c.height);
  })();
}

/* ============================================================
   11. Ansichten & Ereignisse
   ============================================================ */

function showView(v) {
  ['plan', 'ideen', 'info'].forEach(x => { $('#view-' + x).hidden = x !== v; });
  $$('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.view === v));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTodos() {
  $('#todos').innerHTML = TODOS.map(t => `
    <button class="todo${S.todos[t.id] ? ' on' : ''}" data-todo="${t.id}">
      <span class="box">✓</span>
      <span><b>${esc(t.text)}</b><small>${esc(t.hint)}</small></span>
    </button>`).join('');
}

function renderCredits() {
  $('#credits').innerHTML = Object.keys(CREDITS).sort().map(k => {
    const c = CREDITS[k];
    return `<li><img src="${imgSrc(k)}" alt="" loading="lazy">
      <span><b>${esc(capOf(k) || k)}</b><small>${esc(c.autor)} · ${esc(c.lizenz)}</small></span>
      <a href="${c.url}" target="_blank" rel="noopener">↗</a></li>`;
  }).join('');
}

function renderAll() {
  renderHero(); renderStrip(); renderDays(); renderIdeas(); renderTodos(); renderWxCard();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-view],[data-jump],[data-add],[data-entry],[data-cat],[data-vote],[data-plan],[data-more],[data-prog],[data-pdate],[data-pslot],[data-pickidea],[data-delidea],[data-todo],[data-editidea],[data-avatar],[data-setav],[data-maybe],[data-delpic],[data-close]');
  if (!el) return;
  const D = el.dataset;

  if (D.view) return showView(D.view);
  if (D.close !== undefined) return closeSheet();

  if (D.jump) {
    const t = $('#day-' + D.jump);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (D.cat) { filter = D.cat; renderFilters(); renderIdeas(); wireGalleries(); return; }

  if (D.add) { const [d, s] = D.add.split('|'); return sheetPickIdea(d, s); }
  if (D.entry) return sheetEntry(D.entry);

  if (D.pickidea) {
    const [id, date, slot] = D.pickidea.split('|');
    return sheetPlan(id, date, slot);
  }
  if (D.plan) return sheetPlan(D.plan);
  if (D.more) {
    const det = $('#det-' + D.more);
    det.classList.toggle('open');
    el.textContent = det.classList.contains('open') ? 'Weniger' : 'Infos';
    return;
  }
  if (D.prog) {
    const [ideaId, date, time, title] = D.prog.split('|');
    const idea = ideaById(ideaId);
    S.entries.push({ id: uid(), ideaId, date, slot: parseInt(time, 10) >= 17 ? 'ab' : 'nm',
                     time, label: idea.title.split(' ')[0] + ': ' + title.replace(/^Kino: /, ''),
                     note: '', done: false });
    save(); renderAll();
    const f = fmtDay(date);
    toast(`${idea.emoji} ${f.wds}, ${f.num}.8. um ${time} eingetragen!`);
    confetti();
    return;
  }
  if (D.pdate) { pick.date = D.pdate; drawPlanSheet(); return; }
  if (D.pslot) { pick.slot = D.pslot; drawPlanSheet(); return; }

  if (D.vote) {
    const [ideaId, pid] = D.vote.split('|');
    S.votes[ideaId] = S.votes[ideaId] || {};
    S.votes[ideaId][pid] = ((S.votes[ideaId][pid] || 0) + 1) % 3;
    save(); renderIdeas(); wireGalleries(); renderDays();
    return;
  }
  if (D.editidea) { return sheetIdeaForm(ideaById(D.editidea)); }
  if (D.delpic !== undefined) { draftPics.splice(+D.delpic, 1); drawDraftPics(); return; }
  if (D.maybe) { const [id, date] = D.maybe.split('|'); return sheetPlan(id, date, 'nm'); }
  if (D.avatar) { return sheetAvatar(D.avatar); }
  if (D.setav) {
    const [pid, em] = D.setav.split('|');
    S.avatars = S.avatars || {};
    S.avatars[pid] = em;
    save(); closeSheet(); renderCrew(); renderAll(); toast('Figur geändert ✓');
    return;
  }
  if (D.delidea) {
    S.custom = S.custom.filter(i => i.id !== D.delidea);
    S.entries = S.entries.filter(e => e.ideaId !== D.delidea);
    S.unpinned = (S.unpinned || []).filter(x => x !== D.delidea);
    save(); renderAll(); wireGalleries(); toast('Idee gelöscht');
    return;
  }
  if (D.todo) {
    S.todos[D.todo] = !S.todos[D.todo];
    save(); renderTodos();
    if (S.todos[D.todo]) confetti();
    return;
  }
});

/* Sheet-Buttons, die nach dem Zeichnen existieren */
document.addEventListener('click', ev => {
  if (ev.target.id === 'pSave') commitPlan();
});

document.addEventListener('click', async ev => {
  const t = ev.target;
  if (t.id === 'syncStart') {
    if (await raumStarten($('#syncDb').value || '')) {
      renderSyncCard(); confetti();
      toast('Raum steht – jetzt den Familien-Link verschicken');
    }
    return;
  }
  if (t.id === 'syncShare') {
    return shareOut({ url: familienLink(), title: 'Unser Berlin-Planer (Familien-Link)',
                      sheetTitle: '👨‍👩‍👧 Familien-Link' });
  }
  if (t.id === 'syncNow') { await sendeJetzt(); return; }
  if (t.id === 'syncGet') { toast('Hole den Raum …'); await syncPull(true); return; }
  if (t.id === 'syncFresh') {
    toast('Hole die neueste Fassung …');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      const namen = await caches.keys();
      await Promise.all(namen.map(n => caches.delete(n)));
    } catch (e) {}
    location.reload();
    return;
  }
  if (t.id === 'syncStop') {
    openSheet('Abgleich beenden?', `
      <p class="muted">Euer Plan bleibt auf diesem Gerät erhalten, wird aber nicht mehr
        mit den anderen abgeglichen.</p>
      <div class="sheet-acts">
        <button class="btn btn-ghost" data-close>Weiterlaufen lassen</button>
        <button class="btn btn-danger" id="syncStopJa">Beenden</button>
      </div>`);
    $('#syncStopJa').onclick = () => { raumBeenden(); closeSheet(); toast('Abgleich beendet'); };
  }
});

$('#sheetClose').onclick = closeSheet;
$('#sheetBg').onclick = closeSheet;
$('#btnAddIdea').onclick = () => sheetIdeaForm();
$('#btnPrint').onclick = () => print();
$('#btnWx').onclick = () => fetchWx(true);
$('#btnText').onclick = () => shareOut({ text: planText(), title: 'Unser Berlin-Plan',
                                          sheetTitle: '📋 Unser Plan' });
$('#btnApp').onclick = () => shareOut({ url: appLink(), title: 'Unser Berlin-Planer',
                                        sheetTitle: '📲 Link zur App' });
$('#btnIcs').onclick = () => {
  if (!S.entries.length) return toast('Noch nichts geplant 🙂');
  download('berlin-sommer-2026.ics', icsFile(), 'text/calendar;charset=utf-8');
  toast('Kalenderdatei gespeichert 📅');
};
$('#btnShare').onclick = () => shareOut({ url: shareLink(), title: 'Unser Berlin-Plan',
                                          sheetTitle: '🔗 Plan-Link' });
$('#btnReset').onclick = () => {
  openSheet('♻️ Wirklich alles zurücksetzen?', `
    <p class="muted">Alle Termine, Stimmen, Häkchen und eigenen Ideen auf diesem Gerät werden gelöscht.
    Die festen Termine (Beisetzung, Carlas Geburtstag) kommen zurück.</p>
    <div class="sheet-acts">
      <button class="btn btn-ghost" data-close>Lieber nicht</button>
      <button class="btn btn-danger" id="rYes">Ja, zurücksetzen</button>
    </div>`);
  $('#rYes').onclick = () => {
    localStorage.removeItem(KEY);
    S = { v: 1, entries: [], votes: {}, custom: [], todos: {}, avatars: {}, unpinned: [], seeded: false };
    frischeFelder(); letzterStand = schnappschuss();
    seedFixed(); S.seeded = true; save();
    closeSheet(); renderAll(); showView('plan'); toast('Alles auf Anfang');
  };
};

$('#logo').onclick = confetti;

/* Geteilten Plan aus dem Link übernehmen */
/* Zwei Pläne zusammenlegen, ohne dass jemandes Eintragungen verlorengehen.
   Es wird nur ergänzt – nie etwas überschrieben oder gelöscht. */
function mergePlan(data) {
  const kennung = e => [e.ideaId, e.date, e.slot, e.time || '', e.label || ''].join('|');
  const da = new Set(S.entries.map(kennung));
  let neu = 0, stimmen = 0;

  (data.entries || []).forEach(e => {
    if (da.has(kennung(e))) return;
    da.add(kennung(e));
    S.entries.push(Object.assign({}, e, { id: uid() }));
    neu++;
  });

  Object.entries(data.votes || {}).forEach(([ideaId, v]) => {
    S.votes[ideaId] = S.votes[ideaId] || {};
    Object.entries(v).forEach(([pid, wert]) => {
      if (!wert) return;                                   // leere Stimmen nichts überschreiben lassen
      if (S.votes[ideaId][pid] !== wert) stimmen++;
      S.votes[ideaId][pid] = wert;
    });
  });

  (data.custom || []).forEach(i => { if (!S.custom.some(x => x.id === i.id)) S.custom.push(i); });
  Object.entries(data.todos || {}).forEach(([k, v]) => { if (v) S.todos[k] = true; });
  S.avatars = Object.assign({}, S.avatars, data.avatars || {});
  return { neu, stimmen };
}

function importFromHash() {
  const f = location.hash.match(/^#f=(.+)$/);
  if (f) {
    try {
      const raum = JSON.parse(new TextDecoder().decode(unb64u(f[1])));
      history.replaceState(null, '', location.pathname);
      if (RAUM && RAUM.id === raum.id) { toast('Ihr seid schon im selben Raum ✓'); return; }
      openSheet('👨‍👩‍👧 Familien-Raum', `
        <p class="muted">Jemand aus der Familie lädt euch in den gemeinsamen Plan ein.
          Ab dann seht ihr Stimmen und Termine der anderen sofort – und sie eure.</p>
        <div class="hint">Euer bisheriger Stand geht nicht verloren – er wird mit dem
          gemeinsamen zusammengeführt.</div>
        <div class="sheet-acts">
          <button class="btn btn-ghost" data-close>Abbrechen</button>
          <button class="btn btn-main" id="raumJa">Beitreten</button>
        </div>`);
      $('#raumJa').onclick = async () => {
        RAUM = raum; localStorage.setItem(SYNC_KEY, JSON.stringify(RAUM));
        letzterPush = '';
        await syncConnect();
        closeSheet(); renderSyncCard(); toast('Ihr seid dabei! 🟢'); confetti();
      };
    } catch (e) {}
    return;
  }
  const m = location.hash.match(/^#p=(.+)$/);
  if (!m) return;
  try {
    const data = JSON.parse(b64dec(m[1]));
    history.replaceState(null, '', location.pathname);
    const anzStimmen = Object.values(data.votes || {})
      .reduce((n, v) => n + Object.values(v).filter(Boolean).length, 0);
    const zahl = (n, ein, viele) => `<b>${n} ${n === 1 ? ein : viele}</b>`;
    openSheet('🔗 Geteilter Plan', `
      <p class="muted">Jemand aus der Familie hat euch seinen Stand geschickt:
        ${zahl((data.entries || []).length, 'Termin', 'Termine')},
        ${zahl(anzStimmen, 'Stimme', 'Stimmen')}${
        (data.custom || []).length ? `, ${zahl(data.custom.length, 'eigene Idee', 'eigene Ideen')}` : ''}.</p>
      <div class="hint"><b>Zusammenführen</b> ergänzt euren Plan um alles, was dort steht,
        und lässt eure eigenen Eintragungen unangetastet. <b>Ersetzen</b> wirft euren
        bisherigen Stand weg.</div>
      <div class="sheet-acts">
        <button class="btn btn-main" id="impMerge">🔀 Zusammenführen</button>
      </div>
      <div class="sheet-acts">
        <button class="btn btn-ghost" data-close>Abbrechen</button>
        <button class="btn btn-danger" id="impReplace">Ersetzen</button>
      </div>`);

    $('#impMerge').onclick = () => {
      const { neu, stimmen } = mergePlan(data);
      syncPinned(); save(); closeSheet(); renderCrew(); renderAll();
      toast(`${neu} ${neu === 1 ? 'Termin' : 'Termine'} und ${stimmen} ${
        stimmen === 1 ? 'Stimme' : 'Stimmen'} dazu ✓`); confetti();
    };
    $('#impReplace').onclick = () => {
      S.entries = data.entries || []; S.votes = data.votes || {};
      S.custom = data.custom || []; S.todos = data.todos || {};
      S.avatars = data.avatars || {}; S.unpinned = [];
      syncPinned(); save(); closeSheet(); renderCrew(); renderAll();
      toast('Plan übernommen ✓'); confetti();
    };
  } catch (e) { /* kaputter Link – ignorieren */ }
}

/* ============================================================
   12. Start
   ============================================================ */

load();
syncLaden();
loadWxCache();
renderCrew();
renderFilters();
renderCredits();
renderSyncCard();
renderAll();
wireGalleries();
fetchWx();
importFromHash();
/* Wird der Link angetippt, während die App schon offen ist, ändert sich
   nur die Adresse – ohne dieses Signal würde nichts passieren. */
addEventListener('hashchange', importFromHash);

/* Am heutigen Tag starten, wenn der Urlaub läuft */
(function jumpToToday() {
  const t = todayIso();
  if (t >= TRIP.start && t <= TRIP.end) {
    const el = $('#day-' + t);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 120);
  }
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

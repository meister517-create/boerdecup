/* Börde-Cup 2026 – Turnier-Engine (Modus M8: Herren 2 Gruppen à 4, Damen 6er-Gruppe, alle Plätze ausgespielt)
   Reine Rechenlogik ohne Oberfläche: Spielplan, Uhrzeiten, Paarungen, Tabellen, Platzierungsspiele, Endstand. */

// Fester Spielplan (Reihenfolge wie Spielplan_Modell2_final.xlsx)
// d = Tag (1 Sa, 2 So), c = Code, a/b = Auslosung (Herren "A1".."B4", Damen 1..6), l = Bezeichnung
const G = (d, c, a, b) => ({d, c, a, b, l: c === "HA" ? "Gruppe A" : c === "HB" ? "Gruppe B" : "Damen"});
const K = (c, l) => ({d: 2, c, a: null, b: null, l});
export const TEMPLATE = [
  G(1, "HA", "A1", "A3"), G(1, "HB", "B1", "B3"), G(1, "D", 1, 4), G(1, "D", 2, 5),
  G(1, "HA", "A2", "A3"), G(1, "HB", "B2", "B4"), G(1, "D", 1, 6), G(1, "D", 5, 3),
  G(1, "HA", "A2", "A4"), G(1, "HB", "B1", "B4"), G(1, "D", 6, 4), G(1, "D", 2, 3),
  G(1, "HA", "A1", "A4"), G(1, "HB", "B2", "B3"), G(1, "D", 5, 6), G(1, "D", 4, 2),
  G(1, "D", 1, 3), G(1, "HA", "A1", "A2"), G(1, "HB", "B1", "B2"), G(1, "D", 6, 2),
  G(1, "HA", "A3", "A4"), G(1, "HB", "B3", "B4"), G(1, "D", 1, 5), G(1, "D", 3, 4),
  G(2, "D", 1, 2), G(2, "D", 4, 5), G(2, "D", 3, 6),
  K("HPS1", "Überkreuz 1 um Platz 5–8"), K("HPS2", "Überkreuz 2 um Platz 5–8"),
  K("DHF1", "Halbfinale 1 Damen"), K("DHF2", "Halbfinale 2 Damen"), K("HP7", "Spiel um Platz 7 Herren"),
  K("HHF1", "Halbfinale 1 Herren"), K("HHF2", "Halbfinale 2 Herren"),
  K("DP5", "Spiel um Platz 5 Damen"), K("HP5", "Spiel um Platz 5 Herren"),
  K("DP3", "Spiel um Platz 3 Damen"), K("HP3", "Spiel um Platz 3 Herren"), K("DF", "Finale Damen"), K("HF", "Finale Herren")
];

export const MODE = "M8";
export const H_SEEDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"];
export const D_SEEDS = [1, 2, 3, 4, 5, 6];
export const KO_CODES = TEMPLATE.filter(t => t.a === null).map(t => t.c);
export const GAME_COUNT = TEMPLATE.length;

export const DEFAULT_SETTINGS = {day1: "2026-10-24", day2: "2026-10-25", start1: "09:00", start2: "09:00",
  durG: 20, chgG: 5, durK: 17, chgK: 5, refFirst: "Soest", date: "24. und 25. Oktober 2026", place: ""};

export function defaultTeams() {
  return H_SEEDS.map(s => ({id: "h" + s, cat: "H", seed: s, name: "Herren " + s}))
    .concat(D_SEEDS.map(s => ({id: "d" + s, cat: "D", seed: s, name: "Damen-Team " + s})));
}

const num = v => (typeof v === "number" && isFinite(v)) ? v : null;
const hm = t => { const p = String(t || "09:00").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); };
const fmt = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

/** Tabelle: Punkte, Tordifferenz, Tore, Los (kleiner = besser), Auslosungsreihenfolge */
export function standings(teams, games, los) {
  los = los || {};
  const st = {};
  teams.forEach((t, i) => st[t.id] = {t, idx: i, sp: 0, s: 0, u: 0, n: 0, tf: 0, tg: 0});
  games.forEach(g => {
    const a = st[g.t1], b = st[g.t2]; if (!a || !b) return;
    [[a, g.h, g.a], [b, g.a, g.h]].forEach(([r, x, y]) => {
      r.sp++; r.tf += x; r.tg += y;
      if (x > y) r.s++; else if (x === y) r.u++; else r.n++;
    });
  });
  const rows = Object.values(st);
  rows.forEach(r => { r.diff = r.tf - r.tg; r.p = 3 * r.s + r.u; r.los = num(los[r.t.id]); });
  rows.sort((x, y) => y.p - x.p || y.diff - x.diff || y.tf - x.tf ||
    ((x.los !== null ? 0 : 1) - (y.los !== null ? 0 : 1)) || ((x.los || 0) - (y.los || 0)) || x.idx - y.idx);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.tie = rows.some(o => o !== r && o.p === r.p && o.diff === r.diff && o.tf === r.tf);
  });
  return rows;
}

/** Rechnet den kompletten Turnierstand aus Einstellungen, Teams und Ergebnissen. */
export function compute(settings, teams, results) {
  const S = Object.assign({}, DEFAULT_SETTINGS, settings || {});
  const R = (results && results.games) || {};
  const LOS = (results && results.los) || {};
  const byId = {}; teams.forEach(t => byId[t.id] = t);
  const H = H_SEEDS.map(s => teams.find(t => t.cat === "H" && t.seed === s));
  const D = D_SEEDS.map(s => teams.find(t => t.cat === "D" && t.seed === s));
  const TG = (+S.durG || 0) + (+S.chgG || 0), TK = (+S.durK || 0) + (+S.chgK || 0);

  // Grunddaten je Spiel: Uhrzeit läuft je Tag fortlaufend, Gruppenspiele mit Gruppen-, Platzierungsspiele mit K.-o.-Takt
  const clock = {1: hm(S.start1), 2: hm(S.start2)};
  const games = TEMPLATE.map((tp, i) => {
    const nr = i + 1, ko = KO_CODES.includes(tp.c), start = clock[tp.d];
    clock[tp.d] += ko ? TK : TG;
    const r = R["g" + nr] || {};
    const h = num(r.h), a = num(r.a), p1 = num(r.p1), p2 = num(r.p2);
    const played = h !== null && a !== null;
    const decided = played && (h !== a || (ko && p1 !== null && p2 !== null && p1 !== p2));
    return {nr, code: tp.c, phase: ko ? "KO" : tp.c, cat: tp.c[0] === "D" ? "D" : "H",
      label: tp.l, day: tp.d, date: tp.d === 1 ? S.day1 : S.day2, start, time: fmt(start),
      dur: ko ? +S.durK : +S.durG, ko, h, a, p1, p2, played, decided: ko ? decided : played,
      partial: (h === null) !== (a === null), t1: null, t2: null, l1: "", l2: ""};
  });
  const set = (g, s, id, label) => { g["t" + s] = id || null; g["l" + s] = id ? byId[id].name : label; };
  const res = gs => gs.filter(g => g.played && g.t1 && g.t2).map(g => ({t1: g.t1, t2: g.t2, h: g.h, a: g.a}));

  // Gruppenspiele
  games.forEach(g => {
    const tp = TEMPLATE[g.nr - 1];
    if (g.code === "HA" || g.code === "HB") {
      const x = H[H_SEEDS.indexOf(tp.a)], y = H[H_SEEDS.indexOf(tp.b)];
      set(g, 1, x && x.id, "Herren " + tp.a); set(g, 2, y && y.id, "Herren " + tp.b);
    }
    if (g.code === "D") { const x = D[tp.a - 1], y = D[tp.b - 1]; set(g, 1, x && x.id, "Damen " + tp.a); set(g, 2, y && y.id, "Damen " + tp.b); }
  });
  const ga = games.filter(g => g.code === "HA"), gb = games.filter(g => g.code === "HB"), dg = games.filter(g => g.code === "D");
  const HA = H.slice(0, 4).filter(Boolean), HB = H.slice(4).filter(Boolean), Ds = D.filter(Boolean);
  const tabA = standings(HA, res(ga), LOS.A), tabB = standings(HB, res(gb), LOS.B), tabD = standings(Ds, res(dg), LOS.D);
  const completeA = ga.every(g => g.played), completeB = gb.every(g => g.played), completeD = dg.every(g => g.played);

  // Platzierungsspiele
  const Gc = c => games.find(g => g.code === c);
  const ar = r => completeA && tabA[r - 1] ? [tabA[r - 1].t.id, r + ". Gruppe A"] : [null, r + ". Gruppe A"];
  const br = r => completeB && tabB[r - 1] ? [tabB[r - 1].t.id, r + ". Gruppe B"] : [null, r + ". Gruppe B"];
  const dr = r => completeD && tabD[r - 1] ? [tabD[r - 1].t.id, r + ". Damen"] : [null, r + ". Damen"];
  const out = c => {
    const g = Gc(c);
    if (g.decided && g.t1 && g.t2) {
      const w1 = g.h > g.a || (g.h === g.a && g.p1 > g.p2);
      return {w: [w1 ? g.t1 : g.t2, ""], l: [w1 ? g.t2 : g.t1, ""]};
    }
    return {w: [null, "Sieger Spiel " + g.nr], l: [null, "Verlierer Spiel " + g.nr]};
  };
  const ko = (c, x, y) => { const g = Gc(c); set(g, 1, x[0], x[1]); set(g, 2, y[0], y[1]); };
  ko("HPS1", ar(3), br(4)); ko("HPS2", br(3), ar(4));
  ko("DHF1", dr(2), dr(3)); ko("DHF2", dr(1), dr(4)); ko("DP5", dr(5), dr(6));
  ko("HHF1", ar(1), br(2)); ko("HHF2", br(1), ar(2));
  ko("HP7", out("HPS1").l, out("HPS2").l); ko("HP5", out("HPS1").w, out("HPS2").w);
  ko("DP3", out("DHF1").l, out("DHF2").l); ko("DF", out("DHF1").w, out("DHF2").w);
  ko("HP3", out("HHF1").l, out("HHF2").l); ko("HF", out("HHF1").w, out("HHF2").w);

  // Schiedsrichter: erstes Spiel des Tages = Einstellung, sonst die Teams des Vorspiels
  games.forEach((g, i) => {
    const p = games[i - 1];
    if (!p || p.day !== g.day) { g.r1 = g.r2 = S.refFirst || "Soest"; }
    else { g.r1 = p.l1; g.r2 = p.l2; }
  });

  // Endstand
  const lab = x => x[0] ? byId[x[0]].name : x[1];
  const pair = (c, pl) => { const o = out(c); return [o.w[0] ? lab(o.w) : pl + ". Platz", o.l[0] ? lab(o.l) : (pl + 1) + ". Platz"]; };
  const endH = [].concat(pair("HF", 1), pair("HP3", 3), pair("HP5", 5), pair("HP7", 7));
  const endD = [].concat(pair("DF", 1), pair("DP3", 3), pair("DP5", 5));

  games.forEach(g => {
    g.hint = g.partial ? "Ergebnis unvollständig" : (g.ko && g.played && !g.decided ? "Unentschieden – 7m-Schießen eintragen" : "");
  });
  return {games, tabA, tabB, tabD, completeA, completeB, completeD, endH, endD, settings: S,
    championH: out("HF").w[0] || null, championD: out("DF").w[0] || null};
}

/** Startzeit eines Spiels als Zeitstempel (lokale Zeit) */
export function startTs(g) {
  if (!g.date) return null;
  const p = g.date.split("-");
  return new Date(+p[0], p[1] - 1, +p[2], Math.floor(g.start / 60), g.start % 60).getTime();
}

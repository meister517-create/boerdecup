/* Börde-Cup 2026 – Turnier-Engine (Modus B2, fester Turnierbaum)
   Reine Rechenlogik ohne Oberfläche: Spielplan, Uhrzeiten, Paarungen, Tabellen, K.-o.-Runde, Endstand. */

// Fester Spielplan: d = Tag (1 Sa, 2 So), c = Code, a/b = Auslosung (HV: Buchstabe, D: Nummer, HH: Platz in der Vorrunde)
export const TEMPLATE = [{"d":1,"c":"D","a":1,"b":2,"l":"Damen"},{"d":1,"c":"HV","a":"A","b":"B","l":"Herren Vorrunde"},{"d":1,"c":"D","a":3,"b":6,"l":"Damen"},{"d":1,"c":"HV","a":"C","b":"D","l":"Herren Vorrunde"},{"d":1,"c":"D","a":4,"b":5,"l":"Damen"},{"d":1,"c":"HV","a":"E","b":"F","l":"Herren Vorrunde"},{"d":1,"c":"HV","a":"G","b":"A","l":"Herren Vorrunde"},{"d":1,"c":"D","a":6,"b":2,"l":"Damen"},{"d":1,"c":"D","a":5,"b":3,"l":"Damen"},{"d":1,"c":"D","a":1,"b":4,"l":"Damen"},{"d":1,"c":"HV","a":"B","b":"C","l":"Herren Vorrunde"},{"d":1,"c":"HV","a":"D","b":"E","l":"Herren Vorrunde"},{"d":1,"c":"HV","a":"F","b":"G","l":"Herren Vorrunde"},{"d":1,"c":"D","a":2,"b":3,"l":"Damen"},{"d":1,"c":"D","a":1,"b":5,"l":"Damen"},{"d":1,"c":"D","a":6,"b":4,"l":"Damen"},{"d":1,"c":"HH","a":1,"b":4,"l":"Herren Hauptrunde"},{"d":1,"c":"HH","a":2,"b":5,"l":"Herren Hauptrunde"},{"d":1,"c":"HH","a":3,"b":6,"l":"Herren Hauptrunde"},{"d":1,"c":"D","a":1,"b":3,"l":"Damen"},{"d":1,"c":"D","a":5,"b":6,"l":"Damen"},{"d":1,"c":"D","a":4,"b":2,"l":"Damen"},{"d":1,"c":"HH","a":7,"b":1,"l":"Herren Hauptrunde"},{"d":2,"c":"HH","a":4,"b":2,"l":"Herren Hauptrunde"},{"d":2,"c":"HH","a":5,"b":3,"l":"Herren Hauptrunde"},{"d":2,"c":"HH","a":6,"b":7,"l":"Herren Hauptrunde"},{"d":2,"c":"D","a":1,"b":6,"l":"Damen"},{"d":2,"c":"D","a":2,"b":5,"l":"Damen"},{"d":2,"c":"D","a":3,"b":4,"l":"Damen"},{"d":2,"c":"VF1","a":null,"b":null,"l":"Viertelfinale 1 Herren"},{"d":2,"c":"VF2","a":null,"b":null,"l":"Viertelfinale 2 Herren"},{"d":2,"c":"VF3","a":null,"b":null,"l":"Viertelfinale 3 Herren"},{"d":2,"c":"DHF1","a":null,"b":null,"l":"Halbfinale 1 Damen"},{"d":2,"c":"DHF2","a":null,"b":null,"l":"Halbfinale 2 Damen"},{"d":2,"c":"HHF1","a":null,"b":null,"l":"Halbfinale 1 Herren"},{"d":2,"c":"HHF2","a":null,"b":null,"l":"Halbfinale 2 Herren"},{"d":2,"c":"DP3","a":null,"b":null,"l":"Spiel um Platz 3 Damen"},{"d":2,"c":"DF","a":null,"b":null,"l":"Finale Damen"},{"d":2,"c":"HP3","a":null,"b":null,"l":"Spiel um Platz 3 Herren"},{"d":2,"c":"HF","a":null,"b":null,"l":"Finale Herren"}];

export const H_SEEDS = ["A", "B", "C", "D", "E", "F", "G"];
export const D_SEEDS = [1, 2, 3, 4, 5, 6];
export const KO_CODES = ["VF1", "VF2", "VF3", "DHF1", "DHF2", "HHF1", "HHF2", "DP3", "DF", "HP3", "HF"];
const SHORT = {VF1: "VF 1", VF2: "VF 2", VF3: "VF 3", DHF1: "HF 1 Damen", DHF2: "HF 2 Damen", HHF1: "HF 1 Herren",
  HHF2: "HF 2 Herren", DP3: "Spiel um Platz 3 Damen", DF: "Finale Damen", HP3: "Spiel um Platz 3 Herren", HF: "Finale Herren"};

export const DEFAULT_SETTINGS = {day1: "2026-10-24", day2: "2026-10-25", start1: "09:00", start2: "09:00",
  durG: 20, chgG: 5, durK: 17, chgK: 3, refFirst: "Soest", date: "24. und 25. Oktober 2026", place: ""};

export function defaultTeams() {
  return H_SEEDS.map(s => ({id: "h" + s, cat: "H", seed: s, name: "Herren-Team " + s}))
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

  // Grunddaten je Spiel (Uhrzeit, Spielzeit, Ergebnis)
  let satI = 0, sunI = 0;
  const games = TEMPLATE.map((tp, i) => {
    const nr = i + 1, ko = KO_CODES.includes(tp.c);
    let start;
    if (tp.d === 1) start = hm(S.start1) + (satI++) * TG;
    else if (!ko) start = hm(S.start2) + (sunI++) * TG;
    else start = hm(S.start2) + 6 * TG + KO_CODES.indexOf(tp.c) * TK;
    const r = R["g" + nr] || {};
    const h = num(r.h), a = num(r.a), p1 = num(r.p1), p2 = num(r.p2);
    const played = h !== null && a !== null;
    const decided = played && (h !== a || (ko && p1 !== null && p2 !== null && p1 !== p2));
    return {nr, code: tp.c, phase: ko ? "KO" : tp.c, cat: (tp.c === "D" || tp.c[0] === "D") ? "D" : "H",
      label: tp.l, day: tp.d, date: tp.d === 1 ? S.day1 : S.day2, start, time: fmt(start),
      dur: ko ? +S.durK : +S.durG, ko, h, a, p1, p2, played, decided: ko ? decided : played,
      partial: (h === null) !== (a === null), t1: null, t2: null, l1: "", l2: ""};
  });
  const set = (g, s, id, label) => { g["t" + s] = id || null; g["l" + s] = id ? byId[id].name : label; };
  const res = gs => gs.filter(g => g.played && g.t1 && g.t2).map(g => ({t1: g.t1, t2: g.t2, h: g.h, a: g.a}));

  // Vorrunde Herren + Damen-Gruppe
  games.forEach(g => {
    const tp = TEMPLATE[g.nr - 1];
    if (g.code === "HV") { const x = H[H_SEEDS.indexOf(tp.a)], y = H[H_SEEDS.indexOf(tp.b)]; set(g, 1, x && x.id, "Team " + tp.a); set(g, 2, y && y.id, "Team " + tp.b); }
    if (g.code === "D") { const x = D[tp.a - 1], y = D[tp.b - 1]; set(g, 1, x && x.id, "Team " + tp.a); set(g, 2, y && y.id, "Team " + tp.b); }
  });
  const hv = games.filter(g => g.code === "HV"), dg = games.filter(g => g.code === "D");
  const Hs = H.filter(Boolean), Ds = D.filter(Boolean);
  const tabV = standings(Hs, res(hv), LOS.V);
  const completeV = hv.every(g => g.played);
  // Hauptrunde: festes Schema nach Platz in der Vorrunde
  games.forEach(g => {
    if (g.code !== "HH") return;
    const tp = TEMPLATE[g.nr - 1];
    [[1, tp.a], [2, tp.b]].forEach(([s, r]) => set(g, s, completeV ? tabV[r - 1].t.id : null, r + ". Vorrunde"));
  });
  const hh = games.filter(g => g.code === "HH");
  const tabG = standings(Hs, res(hv.concat(hh)), LOS.G);
  const completeG = completeV && hh.every(g => g.played);
  const tabD = standings(Ds, res(dg), LOS.D);
  const completeD = dg.every(g => g.played);

  // K.-o.-Runde
  const G = c => games.find(g => g.code === c);
  const hr = r => completeG ? [tabG[r - 1].t.id, r + ". Herren"] : [null, r + ". Herren"];
  const dr = r => completeD ? [tabD[r - 1].t.id, r + ". Damen"] : [null, r + ". Damen"];
  const out = c => {
    const g = G(c);
    if (g.decided && g.t1 && g.t2) {
      const w1 = g.h > g.a || (g.h === g.a && g.p1 > g.p2);
      return {w: [w1 ? g.t1 : g.t2, ""], l: [w1 ? g.t2 : g.t1, ""]};
    }
    return {w: [null, "Sieger " + SHORT[c]], l: [null, "Verlierer " + SHORT[c]]};
  };
  const ko = (c, x, y) => { const g = G(c); set(g, 1, x[0], x[1]); set(g, 2, y[0], y[1]); };
  ko("VF1", hr(2), hr(7)); ko("VF2", hr(3), hr(6)); ko("VF3", hr(4), hr(5));
  ko("DHF1", dr(1), dr(4)); ko("DHF2", dr(2), dr(3));
  ko("HHF1", hr(1), out("VF3").w); ko("HHF2", out("VF1").w, out("VF2").w);
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
  const endH = [lab(out("HF").w), lab(out("HF").l), lab(out("HP3").w), lab(out("HP3").l)];
  const vfs = ["VF1", "VF2", "VF3"];
  if (vfs.every(c => G(c).decided && G(c).t1 && G(c).t2)) {
    const losers = vfs.map(c => out(c).l[0]).sort((x, y) => tabG.find(r => r.t.id === x).rank - tabG.find(r => r.t.id === y).rank);
    losers.forEach(id => endH.push(byId[id].name));
  } else [5, 6, 7].forEach(k => endH.push(k + ". Platz (Verlierer Viertelfinale)"));
  const endD = [lab(out("DF").w), lab(out("DF").l), lab(out("DP3").w), lab(out("DP3").l), lab(dr(5)), lab(dr(6))];
  const endHid = [out("HF").w[0], out("HF").l[0], out("HP3").w[0], out("HP3").l[0]];

  games.forEach(g => {
    g.hint = g.partial ? "Ergebnis unvollständig" : (g.ko && g.played && !g.decided ? "Unentschieden – 7m-Schießen eintragen" : "");
  });
  return {games, tabV, tabG, tabD, completeV, completeG, completeD, endH, endD, settings: S,
    championH: endHid[0] || null, championD: out("DF").w[0] || null};
}

/** Startzeit eines Spiels als Zeitstempel (lokale Zeit) */
export function startTs(g) {
  if (!g.date) return null;
  const p = g.date.split("-");
  return new Date(+p[0], p[1] - 1, +p[2], Math.floor(g.start / 60), g.start % 60).getTime();
}


import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,doc,onSnapshot,setDoc,updateDoc,arrayUnion,arrayRemove,deleteField} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {compute,startTs,defaultTeams,DEFAULT_SETTINGS,H_SEEDS,D_SEEDS} from "./engine.js";

var CFG=window.BC_CONFIG||{};
var LOGO="logo.png";
var app=document.getElementById("app");
var STATE=null, RESULTS={games:{},los:{}}, LOGOS={}, USER=null, authReady=false, DRAFT=null, route="home", filter="Alle", atab="results", gsel="", publishing=false, pendingRender=false, resDay=1;
var MAIN_FIELDS=["mode","settings","teams","menu","goldTeams","info"];

function norm(s){
  s.settings=Object.assign({},DEFAULT_SETTINGS,s.settings||{});
  if(!Array.isArray(s.teams)||!s.teams.length||!s.teams[0].cat)s.teams=defaultTeams();
  s.menu=s.menu||[];s.goldTeams=s.goldTeams||[];s.goldLog=s.goldLog||[];s.info=s.info||[];
  return s}

/* ---------- storage helpers ---------- */
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function authed(){return !!USER}
function saveResume(){lsSet("bc-resume",{route:route,atab:atab,gsel:gsel,filter:filter,resDay:resDay,t:Date.now()})}

/* ---------- utils ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function uid(p){return p+Math.random().toString(36).slice(2,9)}
function eur(n){return Number(n||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}
function clone(o){return JSON.parse(JSON.stringify(o))}
function S(){return DRAFT||STATE||norm({})}
function teamById(id){return id?S().teams.find(function(t){return t.id===id}):null}
function isB2(){return !!STATE&&STATE.mode==="B2"}
var _C=null,_Ck="";
function C(){var k=JSON.stringify([S().settings,S().teams,RESULTS]);if(k!==_Ck){_Ck=k;_C=compute(S().settings,S().teams,RESULTS)}return _C}
function liveInfo(g){if(g.played)return null;var s=startTs(g);if(s===null)return null;var n=Date.now(),D=Math.max(1,g.dur)*60e3;if(n<s||n>=s+D)return null;return{min:Math.floor((n-s)/60e3)+1,p:(n-s)/D}}
function liveGames(){return C().games.filter(function(g){return liveInfo(g)})}
function nextGame(){return C().games.find(function(g){return !g.played&&!liveInfo(g)})}
function fmtDay(d,o){if(!d)return"";var p=d.split("-");return new Date(+p[0],p[1]-1,+p[2]).toLocaleDateString("de-DE",o||{weekday:"long",day:"numeric",month:"long"})}
function initials(n){var w=String(n||"?").replace(/[^\p{L}\p{N} ]/gu,"").trim().split(/\s+/);return ((w[0]||"?")[0]+(w[1]?w[1][0]:(w[0]||"")[1]||"")).toUpperCase()}
function logo(team,size){
  var st=size?' style="--s:'+size+'px"':'';
  if(!team)return '<span class="lg nil"'+st+' aria-hidden="true">?</span>';
  var src=team.logo||(team.id&&LOGOS[team.id]);
  if(src)return '<span class="lg"'+st+'><img src="'+esc(src)+'" alt="" loading="lazy"></span>';
  return '<span class="lg ini"'+st+' aria-hidden="true">'+esc(initials(team.name))+'</span>';
}
function gtTeam(g){return g.teamId?teamById(g.teamId):null}
function gtName(g){var t=gtTeam(g);return t?t.name:(g.name||"Team")}
function gtLogoObj(g){var t=gtTeam(g);return t||{name:g.name}}
function seedLabel(t){return "Team "+t.seed}

/* ---------- icons & nav ---------- */
var ICON={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/></svg>',
 teams:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
 table:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10h5v11M9 21V4h6v17M15 21v-8h5v8M2 21h20"/></svg>',
 food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v8a3 3 0 0 0 6 0V2M9 2v20M17 2c-2 2-3 5-3 8h4v12"/></svg>',
 gold:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 10h2.5a2.5 2.5 0 0 1 0 5H15M5 8a3 3 0 0 1 2.5-4 3 3 0 0 1 5 0A3 3 0 0 1 15 8M8.5 12v5M11.5 12v5"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
var NAV=[["home","Start"],["plan","Spielplan"],["teams","Teams"],["table","Tabelle"],["food","Essen"],["gold","Thekengold"]];
function nav(){return '<nav class="bn" aria-label="Hauptnavigation"><div class="wrap">'+NAV.map(function(p){
  return '<button data-go="'+p[0]+'"'+(route===p[0]?' aria-current="page"':'')+'>'+ICON[p[0]]+'<span>'+p[1]+'</span></button>'}).join("")+'</div></nav>'}
function pageHead(t){return '<div class="ph"><div class="wrap"><img src="'+LOGO+'" alt="Zur Startseite" role="button" tabindex="0" data-go="home"><h1>'+t+'</h1></div></div>'}

function goldTotals(){
  var tot={};S().goldTeams.forEach(function(g){tot[g.id]=0});
  S().goldLog.forEach(function(e){if(e.g in tot)tot[e.g]+=+e.a||0});
  return S().goldTeams.map(function(g){return{g:g,v:tot[g.id]}}).sort(function(a,b){return b.v-a.v||gtName(a.g).localeCompare(gtName(b.g))});
}

/* ---------- frontend views ---------- */
var PITCH='<svg class="pitch" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" stroke-width="2"><rect x="-20" y="20" width="440" height="560"/><path d="M60 300a140 140 0 0 1 280 0"/><path d="M95 300a105 105 0 0 1 210 0" stroke-dasharray="8 10"/><path d="M-20 150h440" opacity=".6"/><circle cx="200" cy="240" r="3" fill="#fff"/><path d="M170 300v-14h60v14"/></svg>';
function hero(){
  var st=S().settings,meta=[st.date||fmtDay(st.day1,{day:"numeric",month:"long",year:"numeric"}),st.place].filter(Boolean).map(esc).join(", ");
  return '<header class="hero">'+PITCH+'<div class="wrap"><div class="hero-top"><img src="'+LOGO+'" alt="Logo Soester Hockey-Club"><div class="club">Soester Hockey-Club e.V.<br>seit 1996</div>'+
   '<button class="info-btn" data-go="info" aria-label="Infos zum Turnier">i</button></div>'+
   '<div class="hero-num"><span class="n" aria-hidden="true">40</span><span class="lbl">Auflage<br>des Turniers</span></div><h1>Soester Börde-Cup</h1>'+(meta?'<p class="meta">'+meta+'</p>':'')+'</div></header>';
}
function tile(k,t,body,cls){return '<button class="tile '+cls+'" data-go="'+k+'"><div class="t-head"><h2>'+t+'</h2>'+ICON[k]+'</div><div class="t-body">'+body+'</div></button>'}
function vHome(){
  var c=C(),nm=nextGame(),lv=liveGames(),gr=goldTotals().filter(function(r){return r.v>0}),items=[].concat.apply([],S().menu.map(function(x){return x.items||[]}));
  var wd=function(g){return fmtDay(g.date,{weekday:'long'})+' '};
  var plan=lv.length?'<span class="lvtag"><i></i>Live</span><span>'+liveInfo(lv[0]).min+'. Minute, '+esc(lv[0].label)+'</span><strong>'+esc(lv[0].l1)+'<span class="vs">gegen</span>'+esc(lv[0].l2)+'</strong>'
    :nm?'<span>Als Nächstes '+esc(wd(nm))+'um '+esc(nm.time)+' Uhr, '+esc(nm.label)+'</span><strong>'+esc(nm.l1)+'<span class="vs">gegen</span>'+esc(nm.l2)+'</strong>'
    :'<strong>Alle Spiele sind gespielt</strong>';
  var lines=[];
  if(c.championH)lines.push('Sieger Herren: '+esc(teamById(c.championH).name));else if(c.tabG[0]&&c.tabG[0].sp)lines.push('Herren: '+esc(c.tabG[0].t.name));
  if(c.championD)lines.push('Siegerinnen Damen: '+esc(teamById(c.championD).name));else if(c.tabD[0]&&c.tabD[0].sp)lines.push('Damen: '+esc(c.tabD[0].t.name));
  var tbl=lines.length?'<strong>'+lines[0]+'</strong>'+(lines[1]?'<span>'+lines[1]+'</span>':''):'<strong>Noch keine Ergebnisse</strong>';
  var ch=items.filter(function(i){return !i.out}).sort(function(a,b){return a.price-b.price})[0];
  var food=items.length?'<strong>'+items.length+' Angebote</strong><span>'+(ch?'ab '+eur(ch.price):'')+'</span>':'<strong>Karte folgt</strong>';
  var tm=S().teams;
  var teams='<div class="lgs">'+tm.slice(0,6).map(function(t){return logo(t)}).join("")+'</div><strong>'+tm.length+' Teams</strong>';
  var gold=gr.length?'<strong>'+esc(gtName(gr[0].g))+'</strong><span>liegt an der Theke vorn</span>':'<strong>Wer holt das Gold?</strong><span>Die Theke ist eröffnet</span>';
  return hero()+'<main><div class="wrap"><div class="tiles">'+tile("plan","Spielplan",plan,"big")+tile("table","Tabelle",tbl,"")+tile("food","Essen & Getränke",food,"")+tile("teams","Teams",teams,"")+tile("gold","Thekengold",gold,"gold")+
   '</div><p class="foot">40. Soester Börde-Cup des Soester Hockey-Club e.V.<br><button data-go="admin">Orga-Bereich</button></p></div></main>'+nav();
}
function gameHTML(g,nx){
  var sc=g.played,lv=liveInfo(g),t1=teamById(g.t1),t2=teamById(g.t2);
  var w1=g.decided&&(g.h>g.a||(g.h===g.a&&g.p1>g.p2)),w2=g.decided&&!w1;
  var pen=(g.ko&&g.played&&g.h===g.a&&g.p1!=null&&g.p2!=null)?'<div class="small">'+g.p1+':'+g.p2+' n. 7m</div>':'';
  var mid='<div class="mid">'+(lv?'<span class="pill lv"><i></i>LIVE</span>':nx?'<span class="pill">Als Nächstes</span>':'')+'<div class="grp">'+esc(g.label)+'</div>'+
    (lv?'<div class="min">'+lv.min+'. Min.</div><div class="prog" aria-hidden="true"><b style="--p:'+(lv.p*100).toFixed(1)+'%"></b></div><div class="small">seit '+esc(g.time)+' Uhr</div>'
    :sc?'<div class="score">'+g.h+':'+g.a+'</div>'+pen+'<div class="small">'+esc(g.time)+' Uhr</div>'
       :'<div class="vs">vs.</div><div class="clock">'+esc(g.time)+'</div><div class="small">'+g.dur+' Min.</div>')+'</div>';
  function side(t,s,won){return '<div class="side">'+logo(t,56)+'<span class="nm'+(t?'':' ph-t')+(won?' won':'')+'">'+esc(s)+'</span></div>'}
  return '<div class="game'+(lv?' live':nx?' next':'')+'" data-nr="'+g.nr+'">'+side(t1,g.l1,w1)+mid+side(t2,g.l2,w2)+
    '<div class="refl">Spiel '+g.nr+', Schiedsrichter: '+esc(g.r1===g.r2?g.r1:g.r1+' und '+g.r2)+'</div></div>';
}
var PF=["Alle","Herren","Damen","K.-o.-Runde"];
function vPlan(){
  var c=C(),teamF=filter.indexOf("team:")===0?teamById(filter.slice(5)):null;
  if(!teamF&&PF.indexOf(filter)<0)filter="Alle";
  var nm=nextGame();
  var gs=c.games.filter(function(g){
    if(teamF)return g.t1===teamF.id||g.t2===teamF.id;
    if(filter==="Herren")return g.cat==="H";if(filter==="Damen")return g.cat==="D";if(filter==="K.-o.-Runde")return g.ko;return true});
  var chips=(teamF?'<button class="chip" data-filter="Alle" aria-pressed="true">'+esc(teamF.name)+' ✕</button>':'')+PF.map(function(o){return '<button class="chip" data-filter="'+esc(o)+'" aria-pressed="'+(!teamF&&o===filter)+'">'+esc(o)+'</button>'}).join("");
  var st=c.settings,curDay=null,koShown=false,html='';
  gs.forEach(function(g){
    if(g.day!==curDay){curDay=g.day;koShown=false;html+='<h2 class="dayh">'+esc(fmtDay(g.date))+'</h2>'+(g.ko?'':'<p class="hint dayhint">'+st.durG+' Min. Spielzeit, '+st.chgG+' Min. Wechsel</p>')}
    if(g.ko&&!koShown){koShown=true;html+='<h3 class="koh">K.-o.-Runde</h3><p class="hint dayhint">'+st.durK+' Min. Spielzeit, '+st.chgK+' Min. Wechsel</p>'}
    html+=gameHTML(g,nm&&nm.nr===g.nr)});
  var body=gs.length?'<div class="games">'+html+'</div>':'<div class="empty">In dieser Auswahl gibt es keine Spiele.</div>';
  return pageHead("Spielplan")+'<main><div class="wrap"><div class="chips" role="group" aria-label="Filter">'+chips+'</div>'+(teamF?'<p class="hint">Spiele mit festgelegten Gegnern. Spiele der Hauptrunde und K.-o.-Runde erscheinen, sobald die Paarung feststeht.</p>':'')+body+'</div></main>'+nav();
}
function vTeams(){
  var tm=S().teams;
  function grid(list){return '<div class="tgrid">'+list.map(function(t){return '<button class="tcard" data-team="'+t.id+'">'+logo(t,84)+'<span class="nm">'+esc(t.name)+'</span></button>'}).join("")+'</div>'}
  return pageHead("Teams")+'<main><div class="wrap"><p class="hint" style="margin-top:0">Tippe auf ein Team, um seine Spiele zu sehen.</p>'+
    '<h2 class="sec">Herren</h2>'+grid(tm.filter(function(t){return t.cat==="H"}))+'<h2 class="sec">Damen</h2>'+grid(tm.filter(function(t){return t.cat==="D"}))+'</div></main>'+nav();
}
function tableHTML(rows,mark){
  return '<div class="tbl-wrap"><table><thead><tr><th>#</th><th class="team">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>'+
   rows.map(function(r,i){return '<tr class="'+(mark&&i===0&&r.sp?'lead':'')+'"><td class="pos">'+(i+1)+'</td><td class="team"><span class="tc">'+logo(r.t,28)+esc(r.t.name)+'</span></td><td>'+r.sp+'</td><td>'+r.s+'</td><td>'+r.u+'</td><td>'+r.n+'</td><td>'+r.tf+':'+r.tg+'</td><td class="pts">'+r.p+'</td></tr>'}).join("")+'</tbody></table></div>'}
function endHTML(title,list){
  return '<div class="endst"><h3>'+title+'</h3><ol>'+list.map(function(n,i){var real=S().teams.some(function(t){return t.name===n});return '<li class="'+(real?'':'ph-t')+'"><b>'+(i+1)+'.</b> '+esc(n)+'</li>'}).join("")+'</ol></div>'}
function vTable(){
  var c=C(),anyEnd=c.endH.concat(c.endD).some(function(n){return S().teams.some(function(t){return t.name===n})});
  return pageHead("Tabelle")+'<main><div class="wrap">'+
    (anyEnd?'<h2 class="sec">Endstand</h2><div class="endgrid">'+endHTML("Herren",c.endH)+endHTML("Damen",c.endD)+'</div>':'')+
    '<h2 class="sec">Herren – Gesamt (Vor- und Hauptrunde)</h2>'+tableHTML(c.tabG,true)+
    '<p class="hint">Grundlage für die K.-o.-Runde: Der Erste steht direkt im Halbfinale, Viertelfinale 2. gegen 7., 3. gegen 6., 4. gegen 5.</p>'+
    '<h2 class="sec">Herren – Vorrunde</h2>'+tableHTML(c.tabV,false)+
    '<p class="hint">Die Platzierung nach der Vorrunde bestimmt die Hauptrunde: 1.–4., 2.–5., 3.–6., 7.–1., 4.–2., 5.–3., 6.–7.</p>'+
    '<h2 class="sec">Damen</h2>'+tableHTML(c.tabD,true)+
    '<p class="hint">Grundlage für die K.-o.-Runde: Halbfinale 1. gegen 4. und 2. gegen 3.</p>'+
    '<p class="hint">Sieg 3 Punkte, Unentschieden 1 Punkt. Bei Gleichstand zählen Tordifferenz, dann erzielte Tore, zuletzt das Los. K.-o.-Spiele werden bei Unentschieden im 7m-Schießen entschieden.</p></div></main>'+nav();
}
function vFood(){
  var body=S().menu.length?S().menu.map(function(c){
    return '<section class="cat"><h2 class="sec">'+esc(c.name)+'</h2>'+((c.items||[]).length?c.items.map(function(i){
      return '<div class="item'+(i.out?' out':'')+'"><span class="nm">'+esc(i.name)+'</span><span class="pr">'+eur(i.price)+'</span>'+((i.note||i.out)?'<span class="nt">'+esc(i.note)+(i.out?(i.note?' ':'')+'<span class="so">ausverkauft</span>':'')+'</span>':'')+'</div>'}).join(""):'<p class="hint">Noch keine Einträge.</p>')+'</section>'}).join("")
   :'<div class="empty">Die Karte wird gerade geschrieben.</div>';
  return pageHead("Essen & Getränke")+'<main><div class="wrap">'+body+'</div></main>'+nav();
}
function vGold(){
  var r=goldTotals(),max=r.length?r[0].v:0,up=S().goldUpdated?new Date(S().goldUpdated):null;
  var body=r.length?'<div class="glist">'+r.map(function(x,i){var w=max>0?Math.max(x.v>0?6:0,x.v/max*100):0;
    return '<div class="gbar r'+(i+1)+'"><span class="rk">'+(i+1)+'</span><div class="hd">'+logo(gtLogoObj(x.g),30)+'<b>'+esc(gtName(x.g))+'</b></div><div class="trk"><div class="fl" style="--w:'+w.toFixed(1)+'%"></div></div></div>'}).join("")+'</div>'
   :'<div class="empty">Noch ist kein Team im Rennen. Die Theke wartet.</div>';
  return pageHead("Thekengold")+'<main><div class="wrap"><p class="livestat"><i></i>Live-Stand'+(up?', aktualisiert '+up.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+' Uhr':'')+'</p>'+body+'</div></main>'+nav();
}
function richText(t){
  return String(t||"").trim().split(/\n\s*\n/).map(function(p){
    var lines=p.split("\n"),lead="";
    if(lines.length>1&&lines[0].length<=40&&!/[.:!?]$/.test(lines[0].trim())){lead='<b class="ilead">'+esc(lines.shift())+'</b>'}
    var h=esc(lines.join("\n")).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,"<br>");
    return '<p>'+lead+h+'</p>'}).join("")}
function vInfo(){
  var secs=S().info.filter(function(s){return (s.title||"").trim()||(s.text||"").trim()});
  return '<div class="ihead"><div class="wrap"><button class="iconbtn" data-go="home" aria-label="Zurück zur Startseite">'+ICON.back+'</button><h1>Infos zum Turnier</h1><button class="iconbtn" data-go="home" aria-label="Schließen">'+ICON.close+'</button></div></div>'+
    '<main class="ipage"><div class="wrap">'+(secs.length?secs.map(function(s){return '<section class="isec"><h2>'+esc(s.title)+'</h2>'+richText(s.text)+'</section>'}).join(""):'<div class="empty">Hier erscheinen bald alle Infos zum Turnier.</div>')+
    '<p style="margin-top:28px;text-align:center"><button class="btn ghost" data-go="home">Zurück zur Startseite</button></p></div></main>';
}

/* ---------- admin views ---------- */
function vLogin(){
  return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Orga-Bereich</h1><p>Anmelden, um den Börde-Cup zu pflegen.</p>'+
  '<form id="lf" autocomplete="on"><label class="f" for="lu">Nutzername</label><input class="in" id="lu" autocomplete="username" autocapitalize="none" required>'+
  '<label class="f" for="lp">Passwort</label><input class="in" id="lp" type="password" autocomplete="current-password" required>'+
  '<button class="btn red" style="width:100%;margin-top:18px" type="submit">Anmelden</button><div class="err" id="lerr" role="alert"></div></form>'+
  '<p style="margin-top:18px"><button class="btn ghost sm" data-go="home">Zur Startseite</button></p></div></main>';
}
var ATABS=[["results","Ergebnisse"],["gold","Thekengold"],["teams","Teams"],["info","Infos"],["food","Essen & Getränke"],["general","Allgemein"]];
function numIn(id,v,label){return '<input class="in sc" id="'+id+'" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="'+(v==null?"":v)+'" aria-label="'+label+'">'}
function aResults(){
  var c=C(),gs=c.games.filter(function(g){return g.day===resDay});
  var done=c.games.filter(function(g){return g.played}).length;
  var head='<div class="card"><p class="hint" style="margin:0 0 10px">Ergebnisse werden pro Spiel mit „Speichern“ sofort veröffentlicht. Paarungen der Hauptrunde und K.-o.-Runde, Tabellen und Endstand rechnet die App automatisch. Leere Felder bedeuten: noch nicht gespielt.</p>'+
    '<div class="row" style="flex-wrap:wrap"><span class="badge">'+done+' von 40 Ergebnissen</span><span class="badge'+(c.completeV?' ok':'')+'">Vorrunde Herren '+(c.completeV?'komplett':'läuft')+'</span><span class="badge'+(c.completeG?' ok':'')+'">Hauptrunde Herren '+(c.completeG?'komplett':'offen')+'</span><span class="badge'+(c.completeD?' ok':'')+'">Damen-Gruppe '+(c.completeD?'komplett':'läuft')+'</span></div></div>'+
    '<div class="chips" role="group" aria-label="Tag"><button class="chip" data-resday="1" aria-pressed="'+(resDay===1)+'">Samstag</button><button class="chip" data-resday="2" aria-pressed="'+(resDay===2)+'">Sonntag</button><button class="chip" data-resday="0" aria-pressed="'+(resDay===0)+'">Losentscheid</button></div>';
  if(resDay===0)return head+aLos(c);
  return head+'<div class="rows">'+gs.map(function(g){
    var stx=g.hint?'<span class="warn">'+esc(g.hint)+'</span>':(g.played?'<span class="okt">gespeichert '+g.h+':'+g.a+(g.ko&&g.h===g.a&&g.p1!=null?' ('+g.p1+':'+g.p2+' n. 7m)':'')+'</span>':'');
    return '<div class="card rres'+(g.played?' done':'')+'"><div class="rtop"><b>Spiel '+g.nr+'</b><span>'+esc(g.time)+' Uhr, '+esc(g.label)+'</span></div>'+
     '<div class="rgrid"><span class="rt">'+esc(g.l1)+'</span>'+numIn("h"+g.nr,g.h,"Tore "+g.l1)+'<span class="colon">:</span>'+numIn("a"+g.nr,g.a,"Tore "+g.l2)+'<span class="rt r">'+esc(g.l2)+'</span></div>'+
     (g.ko?'<div class="rgrid pen"><span class="rt">7m-Schießen (nur bei Unentschieden)</span>'+numIn("p"+g.nr,g.p1,"7m "+g.l1)+'<span class="colon">:</span>'+numIn("q"+g.nr,g.p2,"7m "+g.l2)+'<span></span></div>':'')+
     '<div class="row" style="margin-top:8px;justify-content:space-between">'+stx+'<span class="row"><button class="btn ghost sm" data-act="clrRes" data-nr="'+g.nr+'"'+(g.played||g.partial?'':' disabled')+'>Leeren</button><button class="btn red sm" data-act="saveRes" data-nr="'+g.nr+'">Speichern</button></span></div></div>'}).join("")+'</div>';
}
function aLos(c){
  function block(key,title,rows,complete){
    var tied=rows.filter(function(r){return r.tie});
    return '<div class="card"><h2 class="sec">'+title+'</h2>'+(tied.length?'<p class="hint">Diese Teams sind nach Punkten, Tordifferenz und Toren gleich. Losergebnis eintragen (1 = vorne)'+(complete?'':'. Die Runde läuft noch, ein Los ist erst am Ende nötig')+'.</p>'+
      '<div class="rows">'+tied.map(function(r){return '<div class="row"><span class="grow">'+r.rank+'. '+esc(r.t.name)+' ('+r.p+' Pkt., '+r.tf+':'+r.tg+')</span>'+numIn("los-"+key+"-"+r.t.id,r.los,"Los "+r.t.name)+'</div>'}).join("")+'</div>'+
      '<button class="btn red sm" data-act="saveLos" data-key="'+key+'" style="margin-top:10px">Los speichern</button>':'<p class="hint" style="margin:0">Kein Gleichstand.</p>')+'</div>'}
  return block("V","Herren Vorrunde",c.tabV,c.completeV)+block("G","Herren Gesamt",c.tabG,c.completeG)+block("D","Damen",c.tabD,c.completeD);
}
function aTeams(D){
  function row(t){return '<div class="card"><div class="row"><span class="seed">'+esc(seedLabel(t))+'</span><input class="in grow" data-k="team.name" data-id="'+t.id+'" value="'+esc(t.name)+'" aria-label="Teamname '+esc(seedLabel(t))+'"></div>'+
    '<div class="row" style="margin-top:8px"><div class="upl">'+logo(t,44)+'<label class="btn ghost sm">'+(LOGOS[t.id]?'Logo ändern':'Logo hochladen')+'<input type="file" accept="image/png,image/jpeg" data-logo="'+t.id+'"></label>'+(LOGOS[t.id]?'<button class="btn icon sm" data-act="delLogo" data-id="'+t.id+'">Entfernen</button>':'')+'</div></div></div>'}
  return '<p class="hint">Die Buchstaben A–G (Herren) und Nummern 1–6 (Damen) kommen aus der Auslosung und legen den Spielplan fest. Hier nur die Namen eintragen. Logos als PNG oder JPG sind sofort live.</p>'+
    '<h2 class="sec">Herren</h2><div class="rows">'+D.teams.filter(function(t){return t.cat==="H"}).map(row).join("")+'</div>'+
    '<h2 class="sec">Damen</h2><div class="rows">'+D.teams.filter(function(t){return t.cat==="D"}).map(row).join("")+'</div>';
}
function aInfo(D){
  return '<p class="hint">Diese Abschnitte erscheinen auf der Startseite hinter dem „i“ oben rechts. Absätze mit einer Leerzeile trennen, Links (https://…) werden anklickbar.</p><div class="rows">'+
    D.info.map(function(s,i){return '<div class="card"><div class="row"><input class="in grow" style="font-weight:800" data-k="info.title" data-id="'+s.id+'" value="'+esc(s.title)+'" placeholder="Überschrift" aria-label="Überschrift">'+
      '<button class="btn icon" data-act="infoUp" data-id="'+s.id+'" aria-label="Nach oben"'+(i?'':' disabled')+'>↑</button><button class="btn icon" data-act="infoDown" data-id="'+s.id+'" aria-label="Nach unten"'+(i<D.info.length-1?'':' disabled')+'>↓</button><button class="btn icon" data-act="infoDel" data-id="'+s.id+'" aria-label="Abschnitt löschen">✕</button></div>'+
      '<textarea class="in ta" data-k="info.text" data-id="'+s.id+'" rows="7" placeholder="Text" aria-label="Text">'+esc(s.text)+'</textarea></div>'}).join("")+
    '</div><button class="btn ghost" data-act="infoAdd">Abschnitt hinzufügen</button>';
}
function aFood(D){
  return '<p class="hint">Kategorien, Angebote und Preise. Ausverkauftes bleibt sichtbar, aber durchgestrichen.</p>'+D.menu.map(function(c){
    return '<div class="card"><div class="row"><input class="in grow" style="font-weight:800" data-k="cat.name" data-id="'+c.id+'" value="'+esc(c.name)+'" aria-label="Kategorie"><button class="btn icon" data-act="delCat" data-id="'+c.id+'" aria-label="Kategorie löschen">✕</button></div><div class="rows" style="margin-top:10px">'+
    c.items.map(function(i){return '<div style="border-top:1px solid var(--line);padding-top:8px"><div class="row"><input class="in grow" data-k="it.name" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+esc(i.name)+'" aria-label="Name"><input class="in" style="width:86px;text-align:right" inputmode="decimal" data-k="it.price" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+String(i.price).replace(".",",")+'" aria-label="Preis in Euro"><span>€</span></div>'+
     '<div class="row" style="margin-top:6px"><input class="in grow" data-k="it.note" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+esc(i.note)+'" placeholder="Hinweis (optional)" aria-label="Hinweis"><label class="row" style="font-size:.85rem;gap:4px"><input type="checkbox" data-k="it.out" data-cid="'+c.id+'" data-id="'+i.id+'"'+(i.out?' checked':'')+'>aus</label><button class="btn icon" data-act="delItem" data-cid="'+c.id+'" data-id="'+i.id+'" aria-label="Angebot löschen">✕</button></div></div>'}).join("")+
    '</div><button class="btn ghost sm" data-act="addItem" data-id="'+c.id+'" style="margin-top:10px">Angebot hinzufügen</button></div>'}).join("")+
   '<button class="btn ghost" data-act="addCat">Kategorie hinzufügen</button>';
}
function aGold(D){
  var tot={};goldTotals().forEach(function(r){tot[r.g.id]=r.v});
  if(gsel&&!D.goldTeams.some(function(g){return g.id===gsel}))gsel="";
  var last=D.goldLog[D.goldLog.length-1],lastG=last&&D.goldTeams.find(function(g){return g.id===last.g});
  var sum=D.goldLog.reduce(function(s,e){return s+(+e.a||0)},0);
  var log=D.goldLog.slice(-15).reverse().map(function(e){var g=D.goldTeams.find(function(x){return x.id===e.g});
    return '<div><time>'+new Date(e.ts).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+'</time><span>'+esc(g?gtName(g):"gelöschtes Team")+'</span><b>'+eur(e.a)+'</b><button class="btn icon sm" data-act="delBook" data-id="'+e.id+'" aria-label="Buchung löschen">✕</button></div>'}).join("");
  return '<div class="card"><h2 class="sec">Verzehrkarte buchen</h2><p class="hint">Team wählen, dann Betrag tippen. Jede Buchung ist sofort live. Im Frontend sieht man nur die Platzierung, keine Beträge.</p>'+
   (D.goldTeams.length?'<div class="gteams">'+D.goldTeams.map(function(g){return '<button class="gbtn" data-act="gsel" data-id="'+g.id+'" aria-pressed="'+(g.id===gsel)+'">'+logo(gtLogoObj(g),30)+'<span>'+esc(gtName(g))+'<small>'+eur(tot[g.id]||0)+'</small></span></button>'}).join("")+'</div>'
     :'<div class="empty">Füge unten zuerst Teams zum Thekengold hinzu.</div>')+
   '<label class="f" style="margin-top:16px">Betrag</label><div class="amts">'+[10,20,30,50].map(function(a){return '<button class="amt" data-act="book" data-a="'+a+'"'+(gsel?'':' disabled')+'>'+a+' €</button>'}).join("")+'</div>'+
   '<div class="row" style="margin-top:10px"><input class="in grow" id="custom" inputmode="decimal" placeholder="Eigener Betrag in €" aria-label="Eigener Betrag"><button class="btn red" data-act="bookCustom"'+(gsel?'':' disabled')+'>Buchen</button></div>'+
   '<button class="btn ghost" data-act="undo" style="width:100%;margin-top:12px"'+(last?'':' disabled')+'>'+(last?'Rückgängig: '+esc(lastG?gtName(lastG):"Team")+', '+eur(last.a):'Nichts rückgängig zu machen')+'</button></div>'+
   '<div class="card"><h2 class="sec">Letzte Buchungen</h2>'+(log?'<div class="log">'+log+'</div><p class="hint" style="margin:10px 0 0">Gesamt '+eur(sum)+' aus '+D.goldLog.length+' Buchungen.</p>':'<p class="hint" style="margin:0">Noch keine Buchungen.</p>')+'</div>'+
   '<div class="card"><h2 class="sec">Teams im Thekengold</h2><p class="hint">Turnierteams übernehmen Name und Logo automatisch. Zusätzliche Teams kannst du frei anlegen.</p><div class="rows">'+
   D.goldTeams.map(function(g){var t=gtTeam(g);return '<div class="row">'+logo(gtLogoObj(g),34)+(t?'<span class="grow" style="font-weight:650">'+esc(t.name)+'</span>':'<input class="in grow" data-k="gt.name" data-id="'+g.id+'" value="'+esc(g.name)+'" aria-label="Teamname">')+'<button class="btn icon" data-act="delGt" data-id="'+g.id+'" aria-label="Aus Thekengold entfernen">✕</button></div>'}).join("")+
   '</div><div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn ghost sm" data-act="addGt">Team hinzufügen</button><button class="btn ghost sm" data-act="importGt">Turnierteams übernehmen</button></div></div>';
}
function aGeneral(D){
  var s=D.settings,c=compute(s,D.teams,RESULTS),g=c.games;
  function f(k,lab,type,extra){return '<div><label class="f" for="s-'+k+'">'+lab+'</label><input class="in" id="s-'+k+'" type="'+type+'" data-k="set.'+k+'" value="'+esc(s[k])+'"'+(extra||'')+'></div>'}
  return '<div class="card"><h2 class="sec">Turniertage und Uhrzeiten</h2><p class="hint">Aus diesen Angaben berechnet die App alle Anstoßzeiten und die Live-Anzeige.</p>'+
   '<div class="mgrid" style="grid-template-columns:1fr 1fr">'+f("day1","Samstag (Datum)","date")+f("start1","Beginn Samstag","time")+f("day2","Sonntag (Datum)","date")+f("start2","Beginn Sonntag","time")+'</div></div>'+
   '<div class="card"><h2 class="sec">Spielzeiten</h2><div class="mgrid" style="grid-template-columns:1fr 1fr">'+f("durG","Spielzeit Vor-/Haupt-/Gruppenrunde","number",' min="1"')+f("chgG","Wechselzeit","number",' min="0"')+f("durK","Spielzeit K.-o.-Runde","number",' min="1"')+f("chgK","Wechselzeit K.-o.-Runde","number",' min="0"')+'</div>'+
   '<p class="hint" style="margin:12px 0 0">Ende Samstag: '+fmtEnd(g[22])+' Uhr. Sonntag: K.-o.-Runde ab '+g[29].time+' Uhr, Ende '+fmtEnd(g[39])+' Uhr.</p></div>'+
   '<div class="card">'+f("refFirst","Schiedsrichter im ersten Spiel des Tages","text")+f("date","Datum als Text auf der Startseite","text",' placeholder="z. B. 24. und 25. Oktober 2026"')+f("place","Ort","text")+'</div>'+
   '<p class="hint">Veröffentlichte Änderungen erscheinen bei allen Besuchern sofort, ohne Neuladen.</p>';
}
function fmtEnd(g){var m=g.start+g.dur;return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function vMigrate(){
  return '<div class="card"><h2 class="sec">Neuer Turniermodus</h2><p class="hint">Die Datenbank enthält noch den alten Spielplan mit festen Gruppen. Mit dem Umstellen werden 7 Herren-Teams (A–G) und 6 Damen-Teams (1–6) im Modus Vor-/Hauptrunde und K.-o.-Runde angelegt. Getränkekarte und Thekengold-Buchungen bleiben erhalten, Teamnamen und Ergebnisse werden zurückgesetzt.</p>'+
    '<button class="btn red" data-act="migrate">Auf neuen Turniermodus umstellen</button></div>';
}
function pick(s){var o={};MAIN_FIELDS.forEach(function(k){o[k]=s[k]});return o}
function isDirty(){return !!DRAFT&&!!STATE&&JSON.stringify(pick(DRAFT))!==JSON.stringify(pick(STATE))}
function vAdmin(){
  var D=DRAFT,d=isDirty();
  var body=!isB2()?vMigrate():({results:aResults,teams:aTeams,food:aFood,gold:aGold,info:aInfo,general:aGeneral}[atab]||aResults)(D);
  var draftTab=["teams","food","info","general"].indexOf(atab)>=0||(atab==="gold");
  return '<div class="ph"><div class="wrap"><img src="'+LOGO+'" alt="Zur Startseite" role="button" tabindex="0" data-go="home"><h1>Orga</h1><button class="btn ghost sm out" data-act="logout">Abmelden</button></div>'+
   '<div class="wrap"><div class="atabs">'+ATABS.map(function(a){return '<button class="chip" data-atab="'+a[0]+'" aria-pressed="'+(a[0]===atab)+'">'+a[1]+'</button>'}).join("")+'</div></div></div>'+
   '<main style="padding-bottom:120px"><div class="wrap">'+body+'</div></main>'+
   ((draftTab||d)&&isB2()?'<div class="savebar"><div class="wrap"><span class="st'+(d?' dirty':'')+'" id="st">'+(publishing?'Wird veröffentlicht …':d?'Ungespeicherte Änderungen':'Alles veröffentlicht')+'</span><button class="btn ghost sm" data-act="reset"'+(d?'':' disabled')+'>Verwerfen</button><button class="btn red sm" data-act="publish"'+(d&&!publishing?'':' disabled')+'>Veröffentlichen</button></div></div>':'');
}

/* ---------- render ---------- */
function render(keep){
  var y=window.scrollY;
  if(route==="admin"){
    if(fbError){app.innerHTML=vWaiting();return}
    if(!authReady){app.innerHTML='<main><div class="login"><p>Lädt …</p></div></main>';return}
    if(!authed()){app.innerHTML=vLogin();bindLogin();return}
    if(!mainLoaded){app.innerHTML=vWaiting();return}
    if(!STATE){app.innerHTML=vSetup();return}
    if(!DRAFT)DRAFT=loadDraft();app.innerHTML=vAdmin()}
  else if(!STATE||!isB2()){app.innerHTML=vWaiting()}
  else{DRAFT=null;app.innerHTML=({home:vHome,plan:vPlan,teams:vTeams,table:vTable,food:vFood,gold:vGold,info:vInfo}[route]||vHome)()}
  if(keep)window.scrollTo(0,y);
}
function go(r){route=r;saveResume();render(false);window.scrollTo(0,0);if(r==="plan"){var g=document.querySelector(".game.live")||document.querySelector(".game.next");if(g&&g.getBoundingClientRect().top>innerHeight*.6)g.scrollIntoView({block:"center"})}}
function loadDraft(){var d=lsGet("bc-draft"),s=clone(STATE);if(d&&d.base===STATE.updated&&d.state){MAIN_FIELDS.forEach(function(k){if(d.state[k])s[k]=d.state[k]})}return norm(s)}
function saveDraft(){if(STATE&&DRAFT)lsSet("bc-draft",{base:STATE.updated,state:pick(DRAFT)})}
function markDirty(){saveDraft();var st=document.getElementById("st"),d=isDirty();
  if(st){st.textContent=publishing?'Wird veröffentlicht …':d?'Ungespeicherte Änderungen':'Alles veröffentlicht';st.className='st'+(d?' dirty':'')}
  document.querySelectorAll('[data-act="publish"],[data-act="reset"]').forEach(function(b){b.disabled=!d||publishing})}
function toast(t){var o=document.querySelector(".toast");if(o)o.remove();var d=document.createElement("div");d.className="toast";d.setAttribute("role","status");d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},3200)}

function bindLogin(){document.getElementById("lf").addEventListener("submit",async function(e){e.preventDefault();
  var u=document.getElementById("lu").value.trim().toLowerCase(),btn=e.target.querySelector("button");btn.disabled=true;
  var email=u.indexOf("@")>0?u:u+"@"+(CFG.loginDomain||"soester-boerdecup.de");
  try{await signInWithEmailAndPassword(auth,email,document.getElementById("lp").value)}
  catch(err){btn.disabled=false;document.getElementById("lerr").textContent=(err&&err.code==="auth/too-many-requests")?"Zu viele Versuche. Bitte kurz warten.":"Nutzername oder Passwort stimmt nicht."}})}

function findC(id){return DRAFT.menu.find(function(c){return c.id===id})}
function parseNum(v){v=String(v).trim().replace(",",".");if(v==="")return null;var n=parseFloat(v);return isNaN(n)?null:n}
function parseScore(id){var el=document.getElementById(id);if(!el)return undefined;var v=el.value.trim();if(v==="")return null;if(!/^\d{1,2}$/.test(v))return NaN;return parseInt(v,10)}

app.addEventListener("input",function(e){
  var el=e.target,k=el.dataset.k;if(!k||!DRAFT)return;var id=el.dataset.id,v=el.type==="checkbox"?el.checked:el.value;
  if(k==="team.name")DRAFT.teams.find(function(t){return t.id===id}).name=v;
  else if(k.indexOf("it.")===0){var c=findC(el.dataset.cid),it=c.items.find(function(i){return i.id===id}),g=k.slice(3);
    if(g==="price"){var p=parseNum(v);it.price=p===null?0:p}else it[g]=v}
  else if(k==="cat.name")findC(id).name=v;
  else if(k==="gt.name")DRAFT.goldTeams.find(function(g){return g.id===id}).name=v;
  else if(k==="info.title")DRAFT.info.find(function(s){return s.id===id}).title=v;
  else if(k==="info.text")DRAFT.info.find(function(s){return s.id===id}).text=v;
  else if(k.indexOf("set.")===0){var f=k.slice(4);DRAFT.settings[f]=["durG","chgG","durK","chgK"].indexOf(f)>=0?Math.max(0,parseInt(v,10)||0):v}
  markDirty();
});

/* logo upload: square, uniform size */
function processLogo(file){return new Promise(function(res,rej){
  if(!/^image\/(png|jpeg)$/.test(file.type)){rej(new Error("type"));return}
  var r=new FileReader();r.onerror=rej;r.onload=function(){var img=new Image();img.onerror=rej;img.onload=function(){
    var N=160,cv=document.createElement("canvas");cv.width=N;cv.height=N;var c=cv.getContext("2d");
    var sc=Math.min(N/img.width,N/img.height),w=img.width*sc,h=img.height*sc;
    c.drawImage(img,(N-w)/2,(N-h)/2,w,h);
    var out=cv.toDataURL("image/webp",.86);
    if(out.indexOf("data:image/webp")!==0){var c2=document.createElement("canvas");c2.width=N;c2.height=N;var x=c2.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,N,N);x.drawImage(cv,0,0);out=c2.toDataURL("image/jpeg",.86)}
    res(out)};img.src=r.result};r.readAsDataURL(file)})}
app.addEventListener("change",async function(e){
  var el=e.target;if(!el.dataset.logo||!el.files||!el.files[0])return;
  try{var url=await processLogo(el.files[0]);var tot=Object.keys(LOGOS).reduce(function(s,k){return s+(k===el.dataset.logo?0:LOGOS[k].length)},0)+url.length;
    if(tot>950000){toast("Speicher für Logos ist voll. Bitte ein anderes Logo entfernen.");return}
    var up={};up[el.dataset.logo]=url;await setDoc(refs.logos,up,{merge:true});toast("Logo gespeichert und live")}
  catch(err){toast("Bitte eine PNG- oder JPG-Datei wählen.")}
});

/* ---------- speichern ---------- */
function writeErr(err){console.error(err);toast(err&&err.code==="permission-denied"?"Keine Berechtigung. Bitte neu anmelden.":"Speichern fehlgeschlagen. Internetverbindung prüfen.")}
async function publish(){
  if(publishing||!DRAFT)return;publishing=true;markDirty();
  var data=clone(pick(DRAFT));data.updated=new Date().toISOString();
  try{await updateDoc(refs.main,data);lsSet("bc-draft",null);publishing=false;DRAFT=null;toast("Veröffentlicht");render(true)}
  catch(err){publishing=false;markDirty();writeErr(err)}
}
function laterPhaseStarted(g){
  var c=C();
  if(g.code==="HV")return c.games.some(function(x){return (x.code==="HH"||x.ko&&x.cat==="H")&&(x.played||x.partial)});
  if(g.code==="HH")return c.games.some(function(x){return x.ko&&x.cat==="H"&&(x.played||x.partial)});
  if(g.code==="D")return c.games.some(function(x){return x.ko&&x.cat==="D"&&(x.played||x.partial)});
  if(g.ko)return c.games.some(function(x){return x.ko&&x.nr>g.nr&&x.cat===g.cat&&(x.played||x.partial)});
  return false;
}
function saveRes(nr,clear){
  var g=C().games[nr-1],h=clear?null:parseScore("h"+nr),a=clear?null:parseScore("a"+nr),p1=clear||!g.ko?null:parseScore("p"+nr),p2=clear||!g.ko?null:parseScore("q"+nr);
  if([h,a,p1,p2].some(function(x){return typeof x==="number"&&isNaN(x)})){toast("Bitte nur Zahlen von 0 bis 99 eintragen.");return}
  if((h===null)!==(a===null)){toast("Bitte beide Torzahlen eintragen.");return}
  if(g.ko&&(p1===null)!==(p2===null)){toast("Beim 7m-Schießen bitte beide Werte eintragen.");return}
  if(g.ko&&h!==null&&h===a&&p1!==null&&p1===p2){toast("Das 7m-Schießen braucht einen Sieger.");return}
  var same=g.h===h&&g.a===a&&(g.p1==null?null:g.p1)===p1&&(g.p2==null?null:g.p2)===p2;
  if(same&&!clear){toast("Unverändert");return}
  if((g.played||g.partial)&&laterPhaseStarted(g)&&!confirm("Achtung: Die nächste Runde läuft bereits. Eine Änderung dieses Ergebnisses kann Tabelle und Paarungen verschieben. Trotzdem speichern?"))return;
  var val=(h===null)?deleteField():(g.ko&&h===a&&p1!==null?{h:h,a:a,p1:p1,p2:p2}:{h:h,a:a});
  var games={};games["g"+nr]=val;
  setDoc(refs.results,{games:games,updated:new Date().toISOString()},{merge:true}).then(function(){toast(h===null?"Spiel "+nr+" geleert":"Spiel "+nr+" gespeichert: "+h+":"+a)}).catch(writeErr);
}
function saveLos(key){
  var c=C(),rows={V:c.tabV,G:c.tabG,D:c.tabD}[key],o={};
  for(var i=0;i<rows.length;i++){var r=rows[i];if(!r.tie)continue;var v=parseScore("los-"+key+"-"+r.t.id);
    if(typeof v==="number"&&isNaN(v)){toast("Bitte nur Zahlen eintragen.");return}o[r.t.id]=v===null?deleteField():v}
  var los={};los[key]=o;
  setDoc(refs.results,{los:los},{merge:true}).then(function(){toast("Losentscheid gespeichert")}).catch(writeErr);
}
function book(a){
  if(!gsel||!(a>0))return;var g=DRAFT.goldTeams.find(function(x){return x.id===gsel});
  var e={id:uid("b"),g:gsel,a:Math.round(a*100)/100,ts:Date.now()};
  updateDoc(refs.gold,{log:arrayUnion(e),updated:new Date().toISOString()}).catch(writeErr);
  var c=document.getElementById("custom");if(c)c.value="";
  toast("Gebucht: "+gtName(g)+", "+eur(a));
}

app.addEventListener("click",function(e){
  var t=e.target.closest("[data-go],[data-filter],[data-atab],[data-act],[data-team],[data-resday]");if(!t)return;
  if(t.dataset.go){go(t.dataset.go);return}
  if(t.dataset.team){filter="team:"+t.dataset.team;go("plan");return}
  if(t.dataset.filter){filter=t.dataset.filter;saveResume();render(true);return}
  if(t.dataset.atab){atab=t.dataset.atab;saveResume();render(false);window.scrollTo(0,0);return}
  if(t.dataset.resday){resDay=+t.dataset.resday;saveResume();render(false);return}
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="logout"){signOut(auth);DRAFT=null;go("home");return}
  if(a==="publish"){publish();return}
  if(a==="reset"){if(confirm("Alle unveröffentlichten Änderungen verwerfen?")){lsSet("bc-draft",null);DRAFT=norm(clone(STATE));render(true)}return}
  if(a==="seed"){seed();return}
  if(a==="migrate"){if(confirm("Jetzt auf den neuen Turniermodus umstellen? Teamnamen und Ergebnisse werden zurückgesetzt."))migrate();return}
  if(a==="saveRes"){saveRes(+t.dataset.nr,false);return}
  if(a==="clrRes"){if(confirm("Ergebnis von Spiel "+t.dataset.nr+" wirklich löschen?"))saveRes(+t.dataset.nr,true);return}
  if(a==="saveLos"){saveLos(t.dataset.key);return}
  if(a==="gsel"){gsel=gsel===id?"":id;saveResume();render(true);return}
  if(a==="book"){book(+t.dataset.a);return}
  if(a==="bookCustom"){var v=parseNum(document.getElementById("custom").value);if(!(v>0)){toast("Bitte einen Betrag über 0 € eingeben.");return}book(v);return}
  if(a==="undo"){var l=STATE.goldLog[STATE.goldLog.length-1];if(!l)return;var lg=STATE.goldTeams.find(function(x){return x.id===l.g});
    updateDoc(refs.gold,{log:arrayRemove(l),updated:new Date().toISOString()}).then(function(){toast("Rückgängig: "+(lg?gtName(lg):"Team")+", "+eur(l.a))}).catch(writeErr);return}
  if(a==="delBook"){if(!confirm("Diese Buchung löschen?"))return;var bk=STATE.goldLog.find(function(x){return x.id===id});if(bk)updateDoc(refs.gold,{log:arrayRemove(bk),updated:new Date().toISOString()}).then(function(){toast("Buchung gelöscht")}).catch(writeErr);return}
  if(a==="delLogo"){var up={};up[id]=deleteField();updateDoc(refs.logos,up).then(function(){toast("Logo entfernt")}).catch(writeErr);return}
  var I=DRAFT&&DRAFT.info,ix=I?I.findIndex(function(s){return s.id===id}):-1;
  if(a==="infoAdd"){DRAFT.info.push({id:uid("s"),title:"Neuer Abschnitt",text:""})}
  else if(a==="infoDel"){if(!confirm("Abschnitt „"+(I[ix].title||"")+"“ löschen?"))return;I.splice(ix,1)}
  else if(a==="infoUp"&&ix>0){I.splice(ix-1,0,I.splice(ix,1)[0])}
  else if(a==="infoDown"&&ix>=0&&ix<I.length-1){I.splice(ix+1,0,I.splice(ix,1)[0])}
  else if(a==="addCat"){DRAFT.menu.push({id:uid("c"),name:"Neue Kategorie",items:[]})}
  else if(a==="delCat"){if(!confirm("Kategorie mit allen Angeboten löschen?"))return;DRAFT.menu=DRAFT.menu.filter(function(c){return c.id!==id})}
  else if(a==="addItem"){findC(id).items.push({id:uid("i"),name:"Neues Angebot",price:0,note:"",out:false})}
  else if(a==="delItem"){var c=findC(t.dataset.cid);c.items=c.items.filter(function(i){return i.id!==id})}
  else if(a==="addGt"){DRAFT.goldTeams.push({id:uid("g"),teamId:"",name:"Neues Team"})}
  else if(a==="importGt"){var n=0;DRAFT.teams.forEach(function(t){if(!DRAFT.goldTeams.some(function(g){return g.teamId===t.id})){DRAFT.goldTeams.push({id:uid("g"),teamId:t.id,name:""});n++}});toast(n?n+" Teams übernommen":"Alle Turnierteams sind schon dabei")}
  else if(a==="delGt"){var gg=DRAFT.goldTeams.find(function(x){return x.id===id}),cnt=DRAFT.goldLog.filter(function(x){return x.g===id}).length;
    if(!confirm("„"+gtName(gg)+"“ aus dem Thekengold entfernen?"+(cnt?" Die "+cnt+" Buchungen dieses Teams zählen dann nicht mehr.":"")))return;
    DRAFT.goldTeams=DRAFT.goldTeams.filter(function(x){return x.id!==id})}
  else return;
  markDirty();render(true);
});
app.addEventListener("keydown",function(e){
  if((e.key==="Enter"||e.key===" ")&&e.target.matches("img[data-go]")){e.preventDefault();go(e.target.dataset.go)}
  if(e.key==="Escape"&&route==="info")go("home");
  if(e.key==="Enter"&&e.target.classList.contains("sc")){var card=e.target.closest(".rres");if(card){var b=card.querySelector('[data-act="saveRes"]');if(b)b.click()}}
});

/* ---------- welcome ---------- */
function welcome(done){
  var last=lsGet("bc-welcomed");if(last&&Date.now()-last<6*3600e3){done();return}
  lsSet("bc-welcomed",Date.now());
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var w=document.createElement("div");w.id="welcome";w.setAttribute("role","dialog");w.setAttribute("aria-label","Willkommen zum 40. Soester Börde-Cup");
  w.innerHTML='<canvas></canvas><div class="w-inner"><img class="w-logo" src="'+LOGO+'" alt="Logo Soester Hockey-Club"><p class="w-num">40.</p><p class="w-title">Soester Börde-Cup</p><p class="w-sub">Schön, dass ihr da seid</p></div>';
  document.body.appendChild(w);done();
  var fin=false;function close(){if(fin)return;fin=true;w.classList.add("out");setTimeout(function(){w.remove()},650)}
  w.addEventListener("click",close);
  if(reduce){setTimeout(close,1800);return}
  var cv=w.querySelector("canvas"),ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;
  var cols=["#FFFFFF","#000000","#F4D27A","#1C4E9E","#FFFFFF"],P=[];
  function burst(x,y,n,dir){for(var i=0;i<n;i++){var a=dir+(Math.random()-.5)*1.1,s=(9+Math.random()*13)*dpr;
    P.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,w:(6+Math.random()*7)*dpr,h:(3+Math.random()*5)*dpr,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[i%cols.length],round:Math.random()<.25})}}
  var t0=performance.now();
  setTimeout(function(){burst(0,cv.height*.75,90,-Math.PI/3);burst(cv.width,cv.height*.75,90,-Math.PI*2/3)},650);
  setTimeout(function(){burst(cv.width/2,cv.height*.38,70,-Math.PI/2)},1050);
  (function tick(now){if(fin&&now-t0>4500)return;ctx.clearRect(0,0,cv.width,cv.height);
    P.forEach(function(p){p.vy+=.38*dpr;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;
      if(p.round){ctx.beginPath();ctx.arc(0,0,p.h*.8,0,6.3);ctx.fill()}else{var k=Math.abs(Math.cos(p.r*2));ctx.fillRect(-p.w/2,-p.h/2*k,p.w,p.h*k+1)}ctx.restore()});
    P=P.filter(function(p){return p.y<cv.height+40});requestAnimationFrame(tick)})(t0);
  setTimeout(close,3300);
}

/* ---------- setup & firebase ---------- */
function vWaiting(){
  var msg,btn='<p style="margin-top:18px"><button class="btn ghost sm" data-go="admin">Zum Orga-Bereich</button></p>';
  if(fbError)msg=esc(fbError);
  else if(mainLoaded&&!STATE)msg='Hier ist noch nichts eingetragen. Bitte im Orga-Bereich anmelden und einmalig „Startdaten anlegen“ tippen.';
  else if(mainLoaded&&STATE&&!isB2())msg='Der Spielplan wird gerade auf den neuen Turniermodus umgestellt. Bitte schau gleich noch einmal vorbei.';
  else if(slowLoad)msg='Die Verbindung zur Datenbank dauert ungewöhnlich lange. Prüfe in Firebase, ob die Firestore-Datenbank angelegt ist und die Werte in config.js stimmen.';
  else{msg='Die Seite wird geladen …';btn=''}
  return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>40. Soester Börde-Cup</h1><p>'+msg+'</p>'+btn+'</div></main>'}
function vSetup(){return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Ersteinrichtung</h1><p>Die Datenbank ist noch leer. Lege die Startdaten an: 7 Herren- und 6 Damen-Teams, den Spielplan für beide Tage, eine Beispielkarte und Infotexte.</p><button class="btn red" style="width:100%" data-act="seed">Startdaten anlegen</button><p style="margin-top:14px"><button class="btn ghost sm" data-act="logout">Abmelden</button></p></div></main>'}
var DEFAULT_MENU=[{"id":"c1","name":"Getränke","items":[{"id":"i1","name":"Bier 0,3 l","price":2.5,"note":"","out":false},{"id":"i2","name":"Radler 0,3 l","price":2.5,"note":"","out":false},{"id":"i3","name":"Softdrinks 0,3 l","price":2,"note":"Cola, Fanta, Sprite","out":false},{"id":"i4","name":"Wasser 0,5 l","price":1.5,"note":"","out":false},{"id":"i5","name":"Kaffee","price":1.5,"note":"","out":false}]},{"id":"c2","name":"Essen","items":[{"id":"i6","name":"Bratwurst im Brötchen","price":3.5,"note":"","out":false},{"id":"i7","name":"Pommes","price":3,"note":"Mayo oder Ketchup","out":false},{"id":"i8","name":"Kuchen","price":2,"note":"selbst gebacken","out":false}]}];
var DEFAULT_INFO=[
 {id:"s1",title:"Turnierkonzept",text:"Damen (6 Teams)\nJede gegen jede, also 5 Spiele pro Team. Danach Halbfinale (1. gegen 4., 2. gegen 3.), Spiel um Platz 3 und Finale. Platz 5 und 6 ergeben sich aus der Tabelle.\n\nHerren (7 Teams)\nVorrunde: Jedes Team bestreitet 2 Spiele.\nHauptrunde: Je nach Platzierung nach der Vorrunde folgen 2 weitere Spiele nach festem Schema (1.–4., 2.–5., 3.–6., 7.–1., 4.–2., 5.–3., 6.–7.). Dabei kann es auch zu einem Wiedersehen aus der Vorrunde kommen. Punkte und Tore aus Vor- und Hauptrunde zählen zusammen.\nK.-o.-Runde: Der Erste ist direkt fürs Halbfinale gesetzt. Viertelfinale 2. gegen 7., 3. gegen 6., 4. gegen 5. Danach Halbfinale, Spiel um Platz 3 und Finale. Die Verlierer der Viertelfinals belegen die Plätze 5 bis 7 nach ihrer Tabellenplatzierung.\n\nSpielzeiten\nVorrunde, Hauptrunde und Damen-Gruppe: 20 Minuten Spielzeit, 5 Minuten Wechsel. K.-o.-Spiele am Sonntag: 17 Minuten Spielzeit, 3 Minuten Wechsel.\n\nWertung\nSieg 3 Punkte, Unentschieden 1 Punkt. Bei Punktgleichheit entscheiden Tordifferenz, dann mehr erzielte Tore, zuletzt das Los. K.-o.-Spiele werden bei Unentschieden im 7m-Schießen entschieden.\n\nSchiedsrichter\nDas erste Spiel des Tages pfeift Soest, danach pfeifen immer die beiden Teams aus dem vorherigen Spiel. Bitte bleibt nach eurem Spiel direkt am Platz."},
 {id:"s2",title:"Party",text:"Die Infos zur Party folgen."},
 {id:"s3",title:"Anfahrt und Kontakt",text:"Adresse und Ansprechpartner folgen."}];
function newMain(old){
  var teams=defaultTeams(),keepGold=(old&&old.goldTeams||[]).filter(function(g){return !g.teamId});
  var s=Object.assign({},DEFAULT_SETTINGS);if(old&&old.settings){if(old.settings.place)s.place=old.settings.place;if(old.settings.date)s.date=old.settings.date}
  return {mode:"B2",settings:s,teams:teams,menu:(old&&old.menu&&old.menu.length)?old.menu:DEFAULT_MENU,
    goldTeams:teams.map(function(t){return {id:"g"+t.id,teamId:t.id,name:""}}).concat(keepGold),
    info:(old&&old.info&&old.info.length)?old.info:DEFAULT_INFO,updated:new Date().toISOString()};
}
async function seed(){
  if(STATE||!mainLoaded)return;
  try{await setDoc(refs.main,newMain(null));await setDoc(refs.results,{games:{},los:{}});
    await setDoc(refs.gold,{log:[],updated:""});await setDoc(refs.logos,{});toast("Startdaten angelegt")}
  catch(err){writeErr(err)}
}
async function migrate(){
  try{await setDoc(refs.main,newMain(STATE));await setDoc(refs.results,{games:{},los:{}});lsSet("bc-draft",null);DRAFT=null;toast("Turniermodus umgestellt")}
  catch(err){writeErr(err)}
}
var fbError="",refs={},auth=null,mainLoaded=false,slowLoad=false;
setTimeout(function(){if(!mainLoaded){slowLoad=true;render(true)}},10000);
function safeRender(){
  var ae=document.activeElement;
  if(route==="admin"&&ae&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)&&ae.id!=="custom"){pendingRender=true;return}
  if(document.querySelector(".toast")&&publishing)return;
  render(true);
}
app.addEventListener("focusout",function(){if(pendingRender){setTimeout(function(){var ae=document.activeElement;if(!ae||!/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)){pendingRender=false;render(true)}},50)}});
function startFirebase(){
  var c=CFG.firebase||{};
  if(!c.apiKey||/DEIN|YOUR/.test(c.apiKey)){fbError="Firebase ist noch nicht eingerichtet. Bitte die Datei config.js ausfüllen (siehe Anleitung).";authReady=true;render(true);return}
  var fb=initializeApp(c),db=getFirestore(fb);auth=getAuth(fb);
  refs={main:doc(db,"boerdecup","main"),gold:doc(db,"boerdecup","gold"),logos:doc(db,"boerdecup","logos"),results:doc(db,"boerdecup","results")};
  var goldLog=[],goldUpdated="";
  onAuthStateChanged(auth,function(u){USER=u;authReady=true;if(!u)DRAFT=null;render(true)});
  onSnapshot(refs.main,function(snap){
    if(!snap.exists()&&snap.metadata&&snap.metadata.fromCache)return;
    var wasDirty=isDirty();mainLoaded=true;
    if(!snap.exists()){STATE=null;DRAFT=null;safeRender();return}
    STATE=norm(snap.data());STATE.goldLog=goldLog;STATE.goldUpdated=goldUpdated;
    if(DRAFT){if(wasDirty){DRAFT.goldLog=goldLog}else DRAFT=null}
    safeRender();
  },function(err){console.error(err);fbError=err&&err.code==="permission-denied"?"Kein Lesezugriff auf die Datenbank. Bitte die Regeln aus firestore.rules in Firebase veröffentlichen.":"Daten konnten nicht geladen werden ("+((err&&err.code)||"unbekannt")+"). Prüfe, ob die Firestore-Datenbank angelegt ist.";render(true)});
  onSnapshot(refs.results,function(snap){var d=snap.exists()?snap.data():{};RESULTS={games:d.games||{},los:d.los||{}};safeRender()},function(err){console.error(err)});
  onSnapshot(refs.gold,function(snap){
    var d=snap.exists()?snap.data():{};goldLog=(d.log||[]).slice().sort(function(a,b){return a.ts-b.ts});goldUpdated=d.updated||"";
    if(STATE){STATE.goldLog=goldLog;STATE.goldUpdated=goldUpdated}if(DRAFT){DRAFT.goldLog=goldLog;DRAFT.goldUpdated=goldUpdated}
    safeRender();
  },function(err){console.error(err)});
  onSnapshot(refs.logos,function(snap){LOGOS=snap.exists()?snap.data():{};safeRender()},function(err){console.error(err)});
}
/* ---------- start ---------- */
setInterval(function(){if((route==="plan"||route==="home")&&!document.querySelector("#welcome"))render(true)},20000);
window.addEventListener("pagehide",saveResume);window.addEventListener("beforeunload",saveResume);
var res=lsGet("bc-resume");
if(res&&Date.now()-res.t<90e3){route=res.route||"home";atab=res.atab||atab;gsel=res.gsel||"";filter=res.filter||"Alle";if(typeof res.resDay==="number")resDay=res.resDay}
if(ATABS.every(function(x){return x[0]!==atab}))atab="results";
if(location.hash==="#orga")route="admin";
if(location.hash==="#info")route="info";
if(route==="admin"||route==="info"){done0()}else welcome(done0);
function done0(){render(false)}
startFirebase();

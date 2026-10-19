
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {initializeFirestore,doc,onSnapshot,setDoc,updateDoc,arrayUnion,arrayRemove,deleteField} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {compute,startTs,defaultTeams,DEFAULT_SETTINGS,MODE,GAME_COUNT} from "./engine.js?v=20261013c";

var CFG=window.BC_CONFIG||{};
var LOGO="logo.png";
var app=document.getElementById("app");
var SHIFT_PW="1996",shDay=1,shQ="";
var AREAS=[{id:"caf",name:"Cafeteria",n:2},{id:"grill",name:"Grill- und Bierstand",n:2},{id:"spk",name:"Sprecherkabine",n:1}];
var DEFAULT_QUICK=[{id:"q1",label:"Bier",price:2.5},{id:"q2",label:"Biermeter",price:25},{id:"q3",label:"Kamu",price:3},{id:"q4",label:"Kamumeter",price:30}];
var STATE=null, RESULTS={games:{},los:{}}, LOGOS={}, USER=null, authReady=false, DRAFT=null, route="home", filter="Alle", atab="results", gsel="", publishing=false, pendingRender=false, resDay=1;
var MAIN_FIELDS=["mode","settings","teams","menu","goldTeams","info","shuttle","shuttleStand","goldQuick","shifts","shiftsOff"];

function norm(s){
  s.settings=Object.assign({},DEFAULT_SETTINGS,s.settings||{});
  if(!Array.isArray(s.teams)||!s.teams.length||!s.teams[0].cat)s.teams=defaultTeams();
  s.menu=s.menu||[];s.goldTeams=s.goldTeams||[];s.goldLog=s.goldLog||[];s.info=s.info||[];s.shuttle=s.shuttle||[];if(s.shuttleStand!==SHUTTLE_STAND){s.shuttle=clone(DEFAULT_SHUTTLE);s.shuttleStand=SHUTTLE_STAND}if(!Array.isArray(s.goldQuick))s.goldQuick=clone(DEFAULT_QUICK);if(!s.shifts||typeof s.shifts!=="object"||Array.isArray(s.shifts))s.shifts={};if(!s.shiftsOff||typeof s.shiftsOff!=="object"||Array.isArray(s.shiftsOff))s.shiftsOff={};
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
function isB2(){return !!STATE&&STATE.mode===MODE}
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
function seedLabel(t){return t.cat==="H"?"Gruppe "+String(t.seed).charAt(0)+" · "+t.seed:"Damen "+t.seed}

/* ---------- icons & nav ---------- */
var ICON={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/></svg>',
 teams:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><path d="M6.5 20v-1.5a5.5 5.5 0 0 1 11 0V20"/><circle cx="5" cy="9.5" r="2.2"/><path d="M1.5 20v-1a3.5 3.5 0 0 1 4.6-3.3"/><circle cx="19" cy="9.5" r="2.2"/><path d="M22.5 20v-1a3.5 3.5 0 0 0-4.6-3.3"/></svg>',
 table:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10h5v11M9 21V4h6v17M15 21v-8h5v8M2 21h20"/></svg>',
 food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v8a3 3 0 0 0 6 0V2M9 2v20M17 2c-2 2-3 5-3 8h4v12"/></svg>',
 gold:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 10h2.5a2.5 2.5 0 0 1 0 5H15M5 8a3 3 0 0 1 2.5-4 3 3 0 0 1 5 0A3 3 0 0 1 15 8M8.5 12v5M11.5 12v5"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
var NAV=[["home","Start"],["plan","Spielplan"],["teams","Teams"],["table","Tabelle"],["food","Essen"],["gold","Thekengold"]];
function nav(){return '<nav class="bn" aria-label="Hauptnavigation"><div class="wrap">'+NAV.map(function(p){
  return '<button data-go="'+p[0]+'"'+(route===p[0]?' aria-current="page"':'')+'>'+ICON[p[0]]+'<span>'+p[1]+'</span></button>'}).join("")+'</div></nav>'}
function pageHead(t,back){return '<div class="ph"><div class="wrap"><img src="'+LOGO+'" alt="Zur Startseite" role="button" tabindex="0" data-go="home"><h1>'+t+'</h1>'+(back?'<button class="phback" data-go="home" aria-label="Zurück zur Startseite">'+ICON.back+'</button>':'')+'</div></div>'}

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
  if(c.championH)lines.push('Sieger Herren: '+esc(teamById(c.championH).name));else if((c.tabA[0]&&c.tabA[0].sp)||(c.tabB[0]&&c.tabB[0].sp))lines.push('Herren: '+esc(c.tabA[0].t.name)+' (A), '+esc(c.tabB[0].t.name)+' (B)');
  if(c.championD)lines.push('Siegerinnen Damen: '+esc(teamById(c.championD).name));else if(c.tabD[0]&&c.tabD[0].sp)lines.push('Damen: '+esc(c.tabD[0].t.name));
  var tbl=lines.length?'<strong>'+lines[0]+'</strong>'+(lines[1]?'<span>'+lines[1]+'</span>':''):'<strong>Noch keine Ergebnisse</strong>';
  var ch=items.filter(function(i){return !i.out}).sort(function(a,b){return a.price-b.price})[0];
  var food=items.length?'<strong>'+items.length+' Angebote</strong><span>'+(ch?'ab '+eur(ch.price):'')+'</span>':'<strong>Karte folgt</strong>';
  var tm=S().teams;
  var teams='<div class="lgs">'+tm.slice(0,6).map(function(t){return logo(t)}).join("")+'</div><strong>'+tm.length+' Teams</strong>';
  var gold=gr.length?'<strong>'+esc(gtName(gr[0].g))+'</strong><span>liegt an der Theke vorn</span>':'<strong>Wer holt das Gold?</strong><span>Die Theke ist eröffnet</span>';
  return hero()+'<main><div class="wrap"><div class="tiles">'+tile("plan","Spielplan",plan,"big")+tile("table","Tabelle",tbl,"")+tile("food","Essen & Getränke",food,"")+tile("teams","Teams",teams,"")+tile("gold","Thekengold",gold,"gold")+
   '</div><p class="foot">40. Soester Börde-Cup des Soester Hockey-Club e.V.<br><button data-go="admin">Orga-Bereich</button><br><button data-go="shifts">Schichtpläne</button></p></div></main>'+nav();
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
var PF=["Alle","Herren","Damen","Platzierungsspiele"];
function vPlan(){
  var c=C(),teamF=filter.indexOf("team:")===0?teamById(filter.slice(5)):null;
  if(!teamF&&PF.indexOf(filter)<0)filter="Alle";
  var nm=nextGame();
  var gs=c.games.filter(function(g){
    if(teamF)return g.t1===teamF.id||g.t2===teamF.id;
    if(filter==="Herren")return g.cat==="H";if(filter==="Damen")return g.cat==="D";if(filter==="Platzierungsspiele")return g.ko;return true});
  var chips=(teamF?'<button class="chip" data-filter="Alle" aria-pressed="true">'+esc(teamF.name)+' ✕</button>':'')+PF.map(function(o){return '<button class="chip" data-filter="'+esc(o)+'" aria-pressed="'+(!teamF&&o===filter)+'">'+esc(o)+'</button>'}).join("");
  var st=c.settings,curDay=null,koShown=false,html='';
  gs.forEach(function(g){
    if(g.day!==curDay){curDay=g.day;koShown=false;html+='<h2 class="dayh">'+esc(fmtDay(g.date))+'</h2>'+(g.ko?'':'<p class="hint dayhint">'+st.durG+' Min. Spielzeit, '+st.chgG+' Min. Wechsel</p>')}
    if(g.ko&&!koShown){koShown=true;html+='<h3 class="koh">Platzierungsspiele</h3><p class="hint dayhint">'+st.durK+' Min. Spielzeit, '+st.chgK+' Min. Wechsel</p>'}
    html+=gameHTML(g,nm&&nm.nr===g.nr)});
  var body=gs.length?'<div class="games">'+html+'</div>':'<div class="empty">In dieser Auswahl gibt es keine Spiele.</div>';
  return pageHead("Spielplan")+'<main><div class="wrap"><div class="chips" role="group" aria-label="Filter">'+chips+'</div>'+(teamF?'<p class="hint">Spiele mit festgelegten Gegnern. Platzierungsspiele am Sonntag erscheinen, sobald die Paarung feststeht.</p>':'')+body+'</div></main>'+nav();
}
function vTeams(){
  var tm=S().teams;
  function grid(list){return '<div class="tgrid">'+list.map(function(t){return '<button class="tcard" data-team="'+t.id+'">'+logo(t,84)+'<span class="nm">'+esc(t.name)+'</span></button>'}).join("")+'</div>'}
  return pageHead("Teams")+'<main><div class="wrap"><p class="hint" style="margin-top:0">Tippe auf ein Team, um seine Spiele zu sehen.</p>'+
    '<h2 class="sec">Herren – Gruppe A</h2>'+grid(tm.filter(function(t){return t.cat==="H"&&String(t.seed).charAt(0)==="A"}))+'<h2 class="sec">Herren – Gruppe B</h2>'+grid(tm.filter(function(t){return t.cat==="H"&&String(t.seed).charAt(0)==="B"}))+'<h2 class="sec">Damen</h2>'+grid(tm.filter(function(t){return t.cat==="D"}))+'</div></main>'+nav();
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
    '<h2 class="sec">Herren – Gruppe A</h2>'+tableHTML(c.tabA,true)+
    '<h2 class="sec">Herren – Gruppe B</h2>'+tableHTML(c.tabB,true)+
    '<p class="hint">Sonntag: Halbfinale 1. A gegen 2. B und 1. B gegen 2. A, Überkreuzspiele 3. A gegen 4. B und 3. B gegen 4. A. Danach werden alle Plätze von 1 bis 8 ausgespielt.</p>'+
    '<h2 class="sec">Damen</h2>'+tableHTML(c.tabD,true)+
    '<p class="hint">Sonntag: Halbfinale 1. gegen 4. und 2. gegen 3., Spiel um Platz 5 (5. gegen 6.), Spiel um Platz 3 und Finale.</p>'+
    '<p class="hint">Sieg 3 Punkte, Unentschieden 1 Punkt. Bei Gleichstand zählen Tordifferenz, dann erzielte Tore, zuletzt das Los. Platzierungsspiele werden bei Unentschieden im 7m-Schießen entschieden.</p></div></main>'+nav();
}
function vFood(){
  var body=S().menu.length?S().menu.map(function(c){
    return '<section class="cat"><h2 class="sec">'+esc(c.name)+'</h2>'+((c.items||[]).length?c.items.map(function(i){
      return '<div class="item'+(i.out?' out':'')+'"><span class="nm">'+esc(i.name)+'</span><span class="pr">'+eur(i.price)+'</span>'+((i.note||i.out)?'<span class="nt">'+esc(i.note)+(i.out?(i.note?' ':'')+'<span class="so">ausverkauft</span>':'')+'</span>':'')+'</div>'}).join(""):'<p class="hint">Noch keine Einträge.</p>')+'</section>'}).join("")
   :'<div class="empty">Die Karte wird gerade geschrieben.</div>';
  return pageHead("Essen & Getränke")+'<main><div class="wrap">'+body+'</div></main>'+nav();
}
function vGold(){
  var r=goldTotals(),max=r.length?r[0].v:0,lg=S().goldLog||[],up=lg.length?new Date(Math.max.apply(null,lg.map(function(e){return +e.ts||0}))):null;
  var upTxt=up?(up.toDateString()===new Date().toDateString()?'heute, ':'am '+up.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})+', ')+up.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+' Uhr':'';
  var body=r.length?'<div class="glist">'+r.map(function(x,i){var w=max>0?Math.max(x.v>0?6:0,x.v/max*100):0;
    return '<div class="gbar r'+(i+1)+'"><span class="rk">'+(i+1)+'</span><div class="hd">'+logo(gtLogoObj(x.g),30)+'<b>'+esc(gtName(x.g))+'</b></div><div class="trk"><div class="fl" style="--w:'+w.toFixed(1)+'%"></div></div></div>'}).join("")+'</div>'
   :'<div class="empty">Noch ist kein Team im Rennen. Die Theke wartet.</div>';
  return pageHead("Thekengold")+'<main><div class="wrap"><p class="livestat"><i></i>Live-Stand'+(upTxt?' · letzte Buchung '+upTxt:'')+'</p>'+body+'</div></main>'+nav();
}
function richText(t){
  return String(t||"").trim().split(/\n\s*\n/).map(function(p){
    var lines=p.split("\n"),lead="";
    if(lines.length>1&&lines[0].length<=40&&!/[.:!?]$/.test(lines[0].trim())){lead='<b class="ilead">'+esc(lines.shift())+'</b>'}
    var h=esc(lines.join("\n")).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,"<br>");
    return '<p>'+lead+h+'</p>'}).join("")}
function shuttleHTML(){
  var L=S().shuttle.filter(function(r){return (r.team||"").trim()});if(!L.length)return "";
  return '<div class="shl"><h3>Abholzeiten Samstag</h3><p class="shn">Taxi 1 und Taxi 2 fahren ab Hotel am Wall, Taxi 3 ab City Motel und Hanse-Hotel. Bitte seid ein paar Minuten vor der Abfahrt am Abholort. Teams mit mehreren Fahrten teilen sich selbst auf.</p>'+
    L.map(function(r){return '<div class="shr"><b>'+esc(r.team)+'</b><span class="shp">'+esc(r.place)+'</span>'+String(r.time||"").split(/\s*·\s*/).map(function(x){return '<span class="sht">'+esc(x)+'</span>'}).join("")+'</div>'}).join("")+'</div>'}
function vInfo(){
  var secs=S().info.filter(function(s){return (s.title||"").trim()||(s.text||"").trim()});
  var shIx=secs.findIndex(function(s){return /shuttle/i.test(s.title||"")}),sh=shuttleHTML();
  if(sh&&shIx<0){secs=secs.concat([{title:"Shuttle",text:"",sh:true}]);shIx=secs.length-1}
  return '<div class="ihead"><div class="wrap"><span class="iconspacer" aria-hidden="true"></span><h1>Infos zum Turnier</h1><button class="iconbtn" data-go="home" aria-label="Schließen">'+ICON.close+'</button></div></div>'+
    '<main class="ipage"><div class="wrap">'+(secs.length?secs.map(function(s,i){return '<section class="isec"><h2>'+esc(s.title)+'</h2>'+richText(s.text)+(i===shIx?sh:'')+'</section>'}).join(""):'<div class="empty">Hier erscheinen bald alle Infos zum Turnier.</div>')+
    '<p style="margin-top:28px;text-align:center"><button class="btn ghost" data-go="home">Zurück zur Startseite</button></p></div></main>';
}

/* ---------- Schichtpläne ---------- */
function hh(h){return String(h).padStart(2,"0")+":00"}
function shiftSlots(day){
  var gs=C().games.filter(function(g){return g.day===day});if(!gs.length)return [];
  var l=gs[gs.length-1],a=Math.floor(gs[0].start/60),b=Math.ceil((l.start+l.dur)/60),out=[];
  for(var h=a;h<b;h++)out.push(h);return out}
function shiftKey(day,h,area,i){return day+"-"+String(h).padStart(2,"0")+"|"+area+"|"+i}
function areaKey(day,h,area){return day+"-"+String(h).padStart(2,"0")+"|"+area}
function areaOff(st,day,h,area){return !!(st.shiftsOff||{})[areaKey(day,h,area)]}
function shiftNames(st,day,h,a){var ns=[];for(var i=0;i<a.n;i++){var v=((st.shifts||{})[shiftKey(day,h,a.id,i)]||"").trim();if(v)ns.push(v)}return ns}
function shiftResults(q){
  var st=S(),out=[];q=q.trim().toLowerCase();if(!q)return "";
  [1,2].forEach(function(day){shiftSlots(day).forEach(function(h){AREAS.forEach(function(a){
    if(areaOff(st,day,h,a.id))return;var ns=shiftNames(st,day,h,a),me=ns.filter(function(n){return n.toLowerCase().indexOf(q)>=0});
    if(!me.length)return;var mates=ns.filter(function(n){return me.indexOf(n)<0});
    out.push('<div class="shres"><span class="shrt">'+(day===1?'Sa':'So')+' '+hh(h)+' – '+hh(h+1)+'</span><b>'+esc(a.name)+'</b><span class="shrm">'+esc(me.join(", "))+(mates.length?' · mit '+esc(mates.join(", ")):'')+'</span></div>')})})});
  return out.length?'<p class="hint" style="margin:0 0 8px"><b>'+out.length+' Schicht'+(out.length===1?'':'en')+'</b> für „'+esc(q)+'“ an beiden Tagen</p><div class="shrlist">'+out.join("")+'</div>':'<p class="hint">Keine Schicht für „'+esc(q)+'“ gefunden.</p>'}
function shiftsOk(){return lsGet("bc-shifts")===SHIFT_PW}
function vShifts(){
  if(!shiftsOk())return pageHead("Schichtpläne",true)+'<main><div class="wrap"><form id="shf" class="card shlock"><h2 class="sec">Geschützter Bereich</h2><p class="hint">Bitte das Passwort für die Schichtpläne eingeben.</p>'+
    '<label class="f" for="shpw">Passwort</label><input class="in" id="shpw" type="password" inputmode="numeric" autocomplete="off" required>'+
    '<button class="btn red" type="submit" style="width:100%;margin-top:14px">Öffnen</button><div class="err" id="sherr" role="alert"></div></form></div></main>'+nav();
  var st=S(),c=C(),sh=st.shifts||{},slots=shiftSlots(shDay),date=c.games.filter(function(g){return g.day===shDay})[0];
  var now=new Date(),today=date&&date.date?(function(p){return new Date(+p[0],p[1]-1,+p[2]).toDateString()})(date.date.split("-")):"";
  var chips='<div class="chips" role="group" aria-label="Tag"><button class="chip" data-shday="1" aria-pressed="'+(shDay===1)+'">Samstag</button><button class="chip" data-shday="2" aria-pressed="'+(shDay===2)+'">Sonntag</button></div>';
  var cards=slots.map(function(h){
    var isNow=today===now.toDateString()&&now.getHours()===h,all=[];
    var rows=AREAS.filter(function(a){return !areaOff(st,shDay,h,a.id)}).map(function(a){var ns=shiftNames(st,shDay,h,a);all.push.apply(all,ns);
      return '<div class="shrow"><span class="sha">'+esc(a.name)+'</span><span class="shn2'+(ns.length<a.n?' open':'')+'">'+(ns.length?ns.map(esc).join(", "):'')+(ns.length<a.n?(ns.length?' · ':'')+(a.n-ns.length)+' offen':'')+'</span></div>'}).join("");
    return '<section class="shc'+(isNow?' now':'')+'" data-n="'+esc(all.join(" ").toLowerCase())+'"><h3>'+hh(h)+' – '+hh(h+1)+' Uhr'+(isNow?'<span class="pill lv"><i></i>Jetzt</span>':'')+'</h3>'+(rows||'<p class="hint" style="margin:4px 0 0">Keine Schicht in dieser Stunde.</p>')+'</section>'}).join("");
  return pageHead("Schichtpläne",true)+'<main><div class="wrap">'+
    '<label class="f" for="shq" style="margin-top:0">Meine Schichten</label><input class="in" id="shq" type="search" value="'+esc(shQ)+'" placeholder="Deinen Namen eingeben …" aria-label="Eigenen Namen suchen" style="margin:0 0 12px">'+
    '<div id="shres">'+shiftResults(shQ)+'</div>'+
    '<div id="shall"'+(shQ.trim()?' style="display:none"':'')+'>'+chips+(slots.length?'<div class="shlist">'+cards+'</div>':'<div class="empty">Noch keine Schichten.</div>')+'</div>'+
    '<p style="margin-top:22px;text-align:center"><button class="btn ghost sm" data-act="shLock">Bereich wieder sperren</button></p></div></main>'+nav()}

/* ---------- admin views ---------- */
function vLogin(){
  return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Orga-Bereich</h1><p>Anmelden, um den Börde-Cup zu pflegen.</p>'+
  '<form id="lf" autocomplete="on"><label class="f" for="lu">Nutzername</label><input class="in" id="lu" autocomplete="username" autocapitalize="none" required>'+
  '<label class="f" for="lp">Passwort</label><input class="in" id="lp" type="password" autocomplete="current-password" required>'+
  '<button class="btn red" style="width:100%;margin-top:18px" type="submit">Anmelden</button><div class="err" id="lerr" role="alert"></div></form>'+
  '<p style="margin-top:18px"><button class="btn ghost sm" data-go="home">Zur Startseite</button></p></div></main>';
}
var ATABS=[["results","Ergebnisse"],["gold","Thekengold"],["teams","Teams"],["info","Infos"],["shifts","Schichten"],["food","Essen & Getränke"],["general","Allgemein"]];
function numIn(id,v,label){return '<input class="in sc" id="'+id+'" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="'+(v==null?"":v)+'" aria-label="'+label+'">'}
function aResults(){
  var c=C(),gs=c.games.filter(function(g){return g.day===resDay});
  var done=c.games.filter(function(g){return g.played}).length;
  var head='<div class="card"><p class="hint" style="margin:0 0 10px">Ergebnisse werden pro Spiel mit „Speichern“ sofort veröffentlicht. Paarungen der Platzierungsspiele, Tabellen und Endstand rechnet die App automatisch. Leere Felder bedeuten: noch nicht gespielt.</p>'+
    '<div class="row" style="flex-wrap:wrap"><span class="badge">'+done+' von '+GAME_COUNT+' Ergebnissen</span><span class="badge'+(c.completeA?' ok':'')+'">Gruppe A '+(c.completeA?'komplett':'läuft')+'</span><span class="badge'+(c.completeB?' ok':'')+'">Gruppe B '+(c.completeB?'komplett':'läuft')+'</span><span class="badge'+(c.completeD?' ok':'')+'">Damen-Gruppe '+(c.completeD?'komplett':'läuft')+'</span></div></div>'+
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
  return block("A","Herren Gruppe A",c.tabA,c.completeA)+block("B","Herren Gruppe B",c.tabB,c.completeB)+block("D","Damen",c.tabD,c.completeD);
}
function aTeams(D){
  function row(t){return '<div class="card"><div class="row"><span class="seed">'+esc(seedLabel(t))+'</span><input class="in grow" data-k="team.name" data-id="'+t.id+'" value="'+esc(t.name)+'" aria-label="Teamname '+esc(seedLabel(t))+'"></div>'+
    '<div class="row" style="margin-top:8px"><div class="upl">'+logo(t,44)+'<label class="btn ghost sm">'+(LOGOS[t.id]?'Logo ändern':'Logo hochladen')+'<input type="file" accept="image/png,image/jpeg" data-logo="'+t.id+'"></label>'+(LOGOS[t.id]?'<button class="btn icon sm" data-act="delLogo" data-id="'+t.id+'">Entfernen</button>':'')+'</div></div></div>'}
  return '<p class="hint">Die Plätze A1–A4 und B1–B4 (Herren) und 1–6 (Damen) kommen aus der Auslosung und legen den Spielplan fest. Hier nur die Namen eintragen. Logos als PNG oder JPG sind sofort live.</p>'+
    '<h2 class="sec">Herren – Gruppe A</h2><div class="rows">'+D.teams.filter(function(t){return t.cat==="H"&&String(t.seed).charAt(0)==="A"}).map(row).join("")+'</div>'+
    '<h2 class="sec">Herren – Gruppe B</h2><div class="rows">'+D.teams.filter(function(t){return t.cat==="H"&&String(t.seed).charAt(0)==="B"}).map(row).join("")+'</div>'+
    '<h2 class="sec">Damen</h2><div class="rows">'+D.teams.filter(function(t){return t.cat==="D"}).map(row).join("")+'</div>';
}
function aInfo(D){
  return '<p class="hint">Diese Abschnitte erscheinen auf der Startseite hinter dem „i“ oben rechts. Absätze mit einer Leerzeile trennen, Links (https://…) werden anklickbar.</p><div class="rows">'+
    D.info.map(function(s,i){return '<div class="card"><div class="row"><input class="in grow" style="font-weight:800" data-k="info.title" data-id="'+s.id+'" value="'+esc(s.title)+'" placeholder="Überschrift" aria-label="Überschrift">'+
      '<button class="btn icon" data-act="infoUp" data-id="'+s.id+'" aria-label="Nach oben"'+(i?'':' disabled')+'>↑</button><button class="btn icon" data-act="infoDown" data-id="'+s.id+'" aria-label="Nach unten"'+(i<D.info.length-1?'':' disabled')+'>↓</button><button class="btn icon" data-act="infoDel" data-id="'+s.id+'" aria-label="Abschnitt löschen">✕</button></div>'+
      '<textarea class="in ta" data-k="info.text" data-id="'+s.id+'" rows="7" placeholder="Text" aria-label="Text">'+esc(s.text)+'</textarea></div>'}).join("")+
    '</div><button class="btn ghost" data-act="infoAdd">Abschnitt hinzufügen</button>'+
    '<div class="card" style="margin-top:22px"><h2 class="sec">Shuttle-Abholzeiten (Samstag)</h2><p class="hint">Erscheinen auf der Infoseite im Abschnitt, dessen Überschrift „Shuttle“ enthält. Eine Zeile pro Team, Reihenfolge mit den Pfeilen. Mehrere Abfahrten mit „ · “ trennen, dann stehen sie untereinander.</p><button class="btn ghost sm" data-act="shLoad" style="margin-bottom:10px">Shuttle-Plan vom '+SHUTTLE_STAND+' übernehmen (3 Taxis)</button><div class="rows">'+
    D.shuttle.map(function(r,i){return '<div style="border-top:1px solid var(--line);padding-top:8px"><div class="row"><input class="in grow" style="font-weight:700" data-k="sh.team" data-id="'+r.id+'" value="'+esc(r.team)+'" placeholder="Team" aria-label="Team">'+
      '<button class="btn icon" data-act="shUp" data-id="'+r.id+'" aria-label="Nach oben"'+(i?'':' disabled')+'>↑</button><button class="btn icon" data-act="shDown" data-id="'+r.id+'" aria-label="Nach unten"'+(i<D.shuttle.length-1?'':' disabled')+'>↓</button><button class="btn icon" data-act="shDel" data-id="'+r.id+'" aria-label="Zeile löschen">✕</button></div>'+
      '<div class="row" style="margin-top:6px"><input class="in" style="width:42%" data-k="sh.place" data-id="'+r.id+'" value="'+esc(r.place)+'" placeholder="Abholort" aria-label="Abholort"><input class="in grow" data-k="sh.time" data-id="'+r.id+'" value="'+esc(r.time)+'" placeholder="z. B. 19:00 Taxi 1 (8 Pers.) · 19:20 Taxi 2 (2 Pers.)" aria-label="Abfahrt"></div></div>'}).join("")+
    '</div><button class="btn ghost sm" data-act="shAdd" style="margin-top:10px">Zeile hinzufügen</button></div>';
}
function aFood(D){
  return '<p class="hint">Kategorien, Angebote und Preise. Mit den Pfeilen änderst du die Reihenfolge. Ausverkauftes bleibt sichtbar, aber durchgestrichen.</p>'+D.menu.map(function(c,ci){
    return '<div class="card"><div class="row"><input class="in grow" style="font-weight:800" data-k="cat.name" data-id="'+c.id+'" value="'+esc(c.name)+'" aria-label="Kategorie">'+
    '<button class="btn icon" data-act="catUp" data-id="'+c.id+'" aria-label="Kategorie nach oben"'+(ci?'':' disabled')+'>↑</button><button class="btn icon" data-act="catDown" data-id="'+c.id+'" aria-label="Kategorie nach unten"'+(ci<D.menu.length-1?'':' disabled')+'>↓</button>'+
    '<button class="btn icon" data-act="delCat" data-id="'+c.id+'" aria-label="Kategorie löschen">✕</button></div><div class="rows" style="margin-top:10px">'+
    c.items.map(function(i,ii){return '<div style="border-top:1px solid var(--line);padding-top:8px"><div class="row"><input class="in grow" data-k="it.name" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+esc(i.name)+'" aria-label="Name">'+
     '<button class="btn icon" data-act="itUp" data-cid="'+c.id+'" data-id="'+i.id+'" aria-label="Angebot nach oben"'+(ii?'':' disabled')+'>↑</button><button class="btn icon" data-act="itDown" data-cid="'+c.id+'" data-id="'+i.id+'" aria-label="Angebot nach unten"'+(ii<c.items.length-1?'':' disabled')+'>↓</button>'+
     '</div><div class="row" style="margin-top:6px"><input class="in" style="width:86px;text-align:right" inputmode="decimal" data-k="it.price" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+String(i.price).replace(".",",")+'" aria-label="Preis in Euro"><span>€</span><input class="in grow" data-k="it.note" data-cid="'+c.id+'" data-id="'+i.id+'" value="'+esc(i.note)+'" placeholder="Hinweis" aria-label="Hinweis"><label class="row" style="font-size:.85rem;gap:4px"><input type="checkbox" data-k="it.out" data-cid="'+c.id+'" data-id="'+i.id+'"'+(i.out?' checked':'')+'>aus</label><button class="btn icon" data-act="delItem" data-cid="'+c.id+'" data-id="'+i.id+'" aria-label="Angebot löschen">✕</button></div></div>'}).join("")+
    '</div><button class="btn ghost sm" data-act="addItem" data-id="'+c.id+'" style="margin-top:10px">Angebot hinzufügen</button></div>'}).join("")+
   '<button class="btn ghost" data-act="addCat">Kategorie hinzufügen</button>';
}
function aGold(D){
  var tot={};goldTotals().forEach(function(r){tot[r.g.id]=r.v});
  if(gsel&&!D.goldTeams.some(function(g){return g.id===gsel}))gsel="";
  var last=D.goldLog[D.goldLog.length-1],lastG=last&&D.goldTeams.find(function(g){return g.id===last.g});
  var sum=D.goldLog.reduce(function(s,e){return s+(+e.a||0)},0);
  var log=D.goldLog.slice(-15).reverse().map(function(e){var g=D.goldTeams.find(function(x){return x.id===e.g});
    return '<div><time>'+new Date(e.ts).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+'</time><span>'+esc(g?gtName(g):"gelöschtes Team")+(e.n?'<small class="lgn"> · '+esc(e.n)+'</small>':'')+'</span><b>'+eur(e.a)+'</b><button class="btn icon sm" data-act="delBook" data-id="'+e.id+'" aria-label="Buchung löschen">✕</button></div>'}).join("");
  return '<div class="card"><h2 class="sec">Verzehrkarte buchen</h2><p class="hint">Team wählen, dann Betrag tippen. Jede Buchung ist sofort live. Im Frontend sieht man nur die Platzierung, keine Beträge.</p>'+
   (D.goldTeams.length?'<div class="gteams">'+D.goldTeams.map(function(g){return '<button class="gbtn" data-act="gsel" data-id="'+g.id+'" aria-pressed="'+(g.id===gsel)+'">'+logo(gtLogoObj(g),30)+'<span>'+esc(gtName(g))+'<small>'+eur(tot[g.id]||0)+'</small></span></button>'}).join("")+'</div>'
     :'<div class="empty">Füge unten zuerst Teams zum Thekengold hinzu.</div>')+
   '<label class="f" style="margin-top:16px">Getränke</label><div class="amts drinks">'+D.goldQuick.filter(function(q){return (q.label||"").trim()&&q.price>0}).map(function(q){return '<button class="amt dk" data-act="bookQ" data-id="'+q.id+'"'+(gsel?'':' disabled')+'>'+esc(q.label)+'<small>'+eur(q.price)+'</small></button>'}).join("")+'</div>'+
   '<label class="f" style="margin-top:16px">Verzehrkarte</label><div class="amts">'+[10,20,30,50].map(function(a){return '<button class="amt" data-act="book" data-a="'+a+'"'+(gsel?'':' disabled')+'>'+a+' €</button>'}).join("")+'</div>'+
   '<div class="row" style="margin-top:10px"><input class="in grow" id="custom" inputmode="decimal" placeholder="Eigener Betrag in €" aria-label="Eigener Betrag"><button class="btn red" data-act="bookCustom"'+(gsel?'':' disabled')+'>Buchen</button></div>'+
   '<button class="btn ghost" data-act="undo" style="width:100%;margin-top:12px"'+(last?'':' disabled')+'>'+(last?'Rückgängig: '+esc(lastG?gtName(lastG):"Team")+(last.n?' ('+esc(last.n)+')':'')+', '+eur(last.a):'Nichts rückgängig zu machen')+'</button></div>'+
   '<div class="card"><h2 class="sec">Letzte Buchungen</h2>'+(log?'<div class="log">'+log+'</div><p class="hint" style="margin:10px 0 0">Gesamt '+eur(sum)+' aus '+D.goldLog.length+' Buchungen.</p>':'<p class="hint" style="margin:0">Noch keine Buchungen.</p>')+'</div>'+
   '<div class="card"><h2 class="sec">Teams im Thekengold</h2><p class="hint">Turnierteams übernehmen Name und Logo automatisch. Zusätzliche Teams kannst du frei anlegen.</p><div class="rows">'+
   D.goldTeams.map(function(g){var t=gtTeam(g);return '<div class="row">'+logo(gtLogoObj(g),34)+(t?'<span class="grow" style="font-weight:650">'+esc(t.name)+'</span>':'<input class="in grow" data-k="gt.name" data-id="'+g.id+'" value="'+esc(g.name)+'" aria-label="Teamname">')+'<button class="btn icon" data-act="delGt" data-id="'+g.id+'" aria-label="Aus Thekengold entfernen">✕</button></div>'}).join("")+
   '</div><div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn ghost sm" data-act="addGt">Team hinzufügen</button><button class="btn ghost sm" data-act="importGt">Turnierteams übernehmen</button></div></div>'+
   '<div class="card"><h2 class="sec">Getränke-Buttons bearbeiten</h2><p class="hint">Name und Preis der Schnellbuttons oben. Reihenfolge mit den Pfeilen, Änderungen mit „Veröffentlichen“ speichern.</p><div class="rows">'+
   D.goldQuick.map(function(q,i){return '<div style="border-top:1px solid var(--line);padding-top:8px"><div class="row"><input class="in grow" style="font-weight:700" data-k="gq.label" data-id="'+q.id+'" value="'+esc(q.label)+'" placeholder="Getränk" aria-label="Getränk">'+
     '<input class="in" style="width:84px;text-align:right" inputmode="decimal" data-k="gq.price" data-id="'+q.id+'" value="'+String(q.price).replace(".",",")+'" aria-label="Preis in Euro"><span>€</span></div>'+
     '<div class="row" style="margin-top:6px;justify-content:flex-end"><button class="btn icon" data-act="gqUp" data-id="'+q.id+'" aria-label="Nach oben"'+(i?'':' disabled')+'>↑</button><button class="btn icon" data-act="gqDown" data-id="'+q.id+'" aria-label="Nach unten"'+(i<D.goldQuick.length-1?'':' disabled')+'>↓</button><button class="btn icon" data-act="gqDel" data-id="'+q.id+'" aria-label="Button löschen">✕</button></div></div>'}).join("")+
   '</div><button class="btn ghost sm" data-act="gqAdd" style="margin-top:10px">Button hinzufügen</button></div>';
}
function aShifts(D){
  var slots=shiftSlots(shDay),sh=D.shifts,open=0,tot=0;
  var cards=slots.map(function(h){
    return '<div class="card"><h2 class="sec" style="margin-bottom:8px">'+hh(h)+' – '+hh(h+1)+' Uhr</h2>'+AREAS.map(function(a){
      var ak=areaKey(shDay,h,a.id);
      if(D.shiftsOff[ak])return '<div class="row shoff" style="margin-top:8px"><span class="grow"><b>'+esc(a.name)+'</b> – keine Schicht</span><button class="btn ghost sm" data-act="shOn" data-id="'+ak+'">Wiederherstellen</button></div>';
      var ins='';for(var i=0;i<a.n;i++){var k=shiftKey(shDay,h,a.id,i),v=sh[k]||"";tot++;if(!v.trim())open++;
        ins+='<input class="in grow" data-k="shift" data-id="'+k+'" value="'+esc(v)+'" placeholder="Name" aria-label="'+esc(a.name)+' '+hh(h)+' Person '+(i+1)+'">'}
      return '<div style="margin-top:8px"><div class="row" style="justify-content:space-between;margin-bottom:4px"><label class="f" style="margin:0">'+esc(a.name)+'</label><button class="btn icon sm" data-act="shOff" data-id="'+ak+'" aria-label="Schicht '+esc(a.name)+' '+hh(h)+' entfernen" title="Schicht entfernen">✕</button></div><div class="row">'+ins+'</div></div>'}).join("")+'</div>'}).join("");
  return '<p class="hint">Schichten je volle Stunde, passend zum Spielplan des Tages. Cafeteria und Grill- und Bierstand mit je zwei Personen, Sprecherkabine mit einer. Ist ein Bereich in einer Stunde nicht geöffnet, die Schicht mit ✕ entfernen. Mit „Veröffentlichen“ speichern. Im Frontend unten auf der Startseite unter „Schichtpläne“, Passwort '+SHIFT_PW+'.</p>'+
    '<div class="chips" role="group" aria-label="Tag"><button class="chip" data-shday="1" aria-pressed="'+(shDay===1)+'">Samstag</button><button class="chip" data-shday="2" aria-pressed="'+(shDay===2)+'">Sonntag</button></div>'+
    '<p class="hint"><span class="badge" id="shbadge">'+(tot-open)+' von '+tot+' Plätzen belegt</span></p><div class="rows">'+cards+'</div>'}
function aGeneral(D){
  var s=D.settings,c=compute(s,D.teams,RESULTS),g=c.games;
  function f(k,lab,type,extra){return '<div><label class="f" for="s-'+k+'">'+lab+'</label><input class="in" id="s-'+k+'" type="'+type+'" data-k="set.'+k+'" value="'+esc(s[k])+'"'+(extra||'')+'></div>'}
  return '<div class="card"><h2 class="sec">Turniertage und Uhrzeiten</h2><p class="hint">Aus diesen Angaben berechnet die App alle Anstoßzeiten und die Live-Anzeige.</p>'+
   '<div class="mgrid" style="grid-template-columns:1fr 1fr">'+f("day1","Samstag (Datum)","date")+f("start1","Beginn Samstag","time")+f("day2","Sonntag (Datum)","date")+f("start2","Beginn Sonntag","time")+'</div></div>'+
   '<div class="card"><h2 class="sec">Spielzeiten</h2><div class="mgrid" style="grid-template-columns:1fr 1fr">'+f("durG","Spielzeit Gruppenspiele","number",' min="1"')+f("chgG","Wechselzeit","number",' min="0"')+f("durK","Spielzeit Platzierungsspiele","number",' min="1"')+f("chgK","Wechselzeit Platzierungsspiele","number",' min="0"')+'</div>'+
   '<p class="hint" style="margin:12px 0 0">Ende Samstag: '+fmtEnd(lastOf(g,1))+' Uhr. Sonntag: Platzierungsspiele ab '+g.filter(function(x){return x.ko})[0].time+' Uhr, Ende '+fmtEnd(lastOf(g,2))+' Uhr.</p></div>'+
   '<div class="card">'+f("refFirst","Schiedsrichter im ersten Spiel des Tages","text")+f("date","Datum als Text auf der Startseite","text",' placeholder="z. B. 24. und 25. Oktober 2026"')+f("place","Ort","text")+'</div>'+
   '<p class="hint">Veröffentlichte Änderungen erscheinen bei allen Besuchern sofort, ohne Neuladen.</p>';
}
function lastOf(gs,d){return gs.filter(function(x){return x.day===d}).slice(-1)[0]}
function fmtEnd(g){var m=g.start+g.dur;return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function vMigrate(){
  return '<div class="card"><h2 class="sec">Neuer Turniermodus</h2><p class="hint">Die Datenbank enthält noch den Spielplan mit 7 Herren-Teams. Mit dem Umstellen gilt der neue Plan: Herren in zwei Gruppen (A1–A4, B1–B4), Damen als 6er-Gruppe, am Sonntag werden alle Plätze ausgespielt. Die Teams werden nach der aktuellen Auslosung eingetragen, Logos und Thekengold-Buchungen werden per Teamname übernommen. Getränkekarte und Infos bleiben erhalten, der Abschnitt „Turnierkonzept“ wird aktualisiert und die Shuttle-Abholzeiten werden angelegt. Ergebnisse werden zurückgesetzt.</p>'+
    '<button class="btn red" data-act="migrate">Auf neuen Turniermodus umstellen</button></div>';
}
function pick(s){var o={};MAIN_FIELDS.forEach(function(k){o[k]=s[k]});return o}
function isDirty(){return !!DRAFT&&!!STATE&&JSON.stringify(pick(DRAFT))!==JSON.stringify(pick(STATE))}
function vAdmin(){
  var D=DRAFT,d=isDirty();
  var body=!isB2()?vMigrate():({results:aResults,teams:aTeams,food:aFood,gold:aGold,info:aInfo,shifts:aShifts,general:aGeneral}[atab]||aResults)(D);
  var draftTab=["teams","food","info","general","shifts"].indexOf(atab)>=0||(atab==="gold");
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
  else{DRAFT=null;app.innerHTML=({home:vHome,plan:vPlan,teams:vTeams,table:vTable,food:vFood,gold:vGold,info:vInfo,shifts:vShifts}[route]||vHome)()}
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
  if(e.target.id==="shq"){shQ=e.target.value;document.getElementById("shres").innerHTML=shiftResults(shQ);document.getElementById("shall").style.display=shQ.trim()?"none":"";return}
  var el=e.target,k=el.dataset.k;if(!k||!DRAFT)return;var id=el.dataset.id,v=el.type==="checkbox"?el.checked:el.value;
  if(k==="team.name")DRAFT.teams.find(function(t){return t.id===id}).name=v;
  else if(k.indexOf("it.")===0){var c=findC(el.dataset.cid),it=c.items.find(function(i){return i.id===id}),g=k.slice(3);
    if(g==="price"){var p=parseNum(v);it.price=p===null?0:p}else it[g]=v}
  else if(k==="cat.name")findC(id).name=v;
  else if(k==="gt.name")DRAFT.goldTeams.find(function(g){return g.id===id}).name=v;
  else if(k==="info.title")DRAFT.info.find(function(s){return s.id===id}).title=v;
  else if(k==="info.text")DRAFT.info.find(function(s){return s.id===id}).text=v;
  else if(k==="shift"){if(String(v).trim())DRAFT.shifts[id]=v;else delete DRAFT.shifts[id];var ins=document.querySelectorAll('[data-k="shift"]'),fil=0;ins.forEach(function(x){if(x.value.trim())fil++});var bd=document.getElementById("shbadge");if(bd)bd.textContent=fil+" von "+ins.length+" Plätzen belegt"}
  else if(k==="gq.label")DRAFT.goldQuick.find(function(q){return q.id===id}).label=v;
  else if(k==="gq.price"){var gp=parseNum(v);DRAFT.goldQuick.find(function(q){return q.id===id}).price=gp===null?0:gp}
  else if(k.indexOf("sh.")===0)DRAFT.shuttle.find(function(r){return r.id===id})[k.slice(3)]=v;
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
  if(g.code==="HA"||g.code==="HB")return c.games.some(function(x){return x.ko&&x.cat==="H"&&(x.played||x.partial)});
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
  var c=C(),rows={A:c.tabA,B:c.tabB,D:c.tabD}[key],o={};
  for(var i=0;i<rows.length;i++){var r=rows[i];if(!r.tie)continue;var v=parseScore("los-"+key+"-"+r.t.id);
    if(typeof v==="number"&&isNaN(v)){toast("Bitte nur Zahlen eintragen.");return}o[r.t.id]=v===null?deleteField():v}
  var los={};los[key]=o;
  setDoc(refs.results,{los:los},{merge:true}).then(function(){toast("Losentscheid gespeichert")}).catch(writeErr);
}
function book(a,n){
  if(!gsel||!(a>0))return;var g=DRAFT.goldTeams.find(function(x){return x.id===gsel});
  var e={id:uid("b"),g:gsel,a:Math.round(a*100)/100,ts:Date.now()};if(n)e.n=n;
  updateDoc(refs.gold,{log:arrayUnion(e),updated:new Date().toISOString()}).catch(writeErr);
  var c=document.getElementById("custom");if(c)c.value="";
  toast("Gebucht: "+gtName(g)+(n?", "+n:"")+", "+eur(a));
}

app.addEventListener("click",function(e){
  var t=e.target.closest("[data-go],[data-filter],[data-atab],[data-act],[data-team],[data-resday],[data-shday]");if(!t)return;
  if(t.dataset.shday){shDay=+t.dataset.shday;render(true);return}
  if(t.dataset.go){go(t.dataset.go);return}
  if(t.dataset.team){filter="team:"+t.dataset.team;go("plan");return}
  if(t.dataset.filter){filter=t.dataset.filter;saveResume();render(true);return}
  if(t.dataset.atab){atab=t.dataset.atab;saveResume();render(false);window.scrollTo(0,0);return}
  if(t.dataset.resday){resDay=+t.dataset.resday;saveResume();render(false);return}
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="shOff"||a==="shOn"){var p=id.split("|"),ar=AREAS.find(function(x){return x.id===p[1]});
    if(a==="shOff"){var has=false;for(var i=0;i<ar.n;i++){if(DRAFT.shifts[id+"|"+i])has=true}
      if(has&&!confirm("Schicht "+ar.name+" entfernen? Die eingetragenen Namen werden gelöscht."))return;
      for(var j=0;j<ar.n;j++)delete DRAFT.shifts[id+"|"+j];DRAFT.shiftsOff[id]=true}
    else delete DRAFT.shiftsOff[id];
    markDirty();render(true);return}
  if(a==="shLock"){lsSet("bc-shifts",null);render(false);return}
  if(a==="logout"){signOut(auth);DRAFT=null;go("home");return}
  if(a==="publish"){publish();return}
  if(a==="reset"){if(confirm("Alle unveröffentlichten Änderungen verwerfen?")){lsSet("bc-draft",null);DRAFT=norm(clone(STATE));render(true)}return}
  if(a==="seed"){seed();return}
  if(a==="migrate"){if(confirm("Jetzt auf den neuen Spielplan (2 Herren-Gruppen) umstellen? Ergebnisse werden zurückgesetzt."))migrate();return}
  if(a==="saveRes"){saveRes(+t.dataset.nr,false);return}
  if(a==="clrRes"){if(confirm("Ergebnis von Spiel "+t.dataset.nr+" wirklich löschen?"))saveRes(+t.dataset.nr,true);return}
  if(a==="saveLos"){saveLos(t.dataset.key);return}
  if(a==="gsel"){gsel=gsel===id?"":id;saveResume();render(true);return}
  if(a==="book"){book(+t.dataset.a);return}
  if(a==="bookCustom"){var v=parseNum(document.getElementById("custom").value);if(!(v>0)){toast("Bitte einen Betrag über 0 € eingeben.");return}book(v);return}
  if(a==="bookQ"){var q=DRAFT.goldQuick.find(function(x){return x.id===id});if(q&&q.price>0)book(q.price,q.label);return}
  if(a==="undo"){var l=STATE.goldLog[STATE.goldLog.length-1];if(!l)return;var lg=STATE.goldTeams.find(function(x){return x.id===l.g});
    updateDoc(refs.gold,{log:arrayRemove(l),updated:new Date().toISOString()}).then(function(){toast("Rückgängig: "+(lg?gtName(lg):"Team")+", "+eur(l.a))}).catch(writeErr);return}
  if(a==="delBook"){if(!confirm("Diese Buchung löschen?"))return;var bk=STATE.goldLog.find(function(x){return x.id===id});if(bk)updateDoc(refs.gold,{log:arrayRemove(bk),updated:new Date().toISOString()}).then(function(){toast("Buchung gelöscht")}).catch(writeErr);return}
  if(a==="delLogo"){var up={};up[id]=deleteField();updateDoc(refs.logos,up).then(function(){toast("Logo entfernt")}).catch(writeErr);return}
  var I=DRAFT&&DRAFT.info,ix=I?I.findIndex(function(s){return s.id===id}):-1;
  if(a==="infoAdd"){DRAFT.info.push({id:uid("s"),title:"Neuer Abschnitt",text:""})}
  else if(a==="infoDel"){if(!confirm("Abschnitt „"+(I[ix].title||"")+"“ löschen?"))return;I.splice(ix,1)}
  else if(a==="infoUp"&&ix>0){I.splice(ix-1,0,I.splice(ix,1)[0])}
  else if(a==="infoDown"&&ix>=0&&ix<I.length-1){I.splice(ix+1,0,I.splice(ix,1)[0])}
  else if(a==="gqAdd"){DRAFT.goldQuick.push({id:uid("q"),label:"",price:0})}
  else if(a==="gqDel"){DRAFT.goldQuick=DRAFT.goldQuick.filter(function(q){return q.id!==id})}
  else if(a==="gqUp"||a==="gqDown"){var Q=DRAFT.goldQuick,qi=Q.findIndex(function(q){return q.id===id}),qj=qi+(a==="gqUp"?-1:1);if(qi<0||qj<0||qj>=Q.length)return;Q.splice(qj,0,Q.splice(qi,1)[0])}
  else if(a==="shLoad"){if(!confirm("Die Abholzeiten durch den Shuttle-Plan vom "+SHUTTLE_STAND+" (3 Taxis) ersetzen? Danach noch „Veröffentlichen“ tippen."))return;DRAFT.shuttle=clone(DEFAULT_SHUTTLE)}
  else if(a==="shAdd"){DRAFT.shuttle.push({id:uid("t"),team:"",place:"Stadthalle",time:""})}
  else if(a==="shDel"){DRAFT.shuttle=DRAFT.shuttle.filter(function(r){return r.id!==id})}
  else if(a==="shUp"||a==="shDown"){var Sh=DRAFT.shuttle,si=Sh.findIndex(function(r){return r.id===id}),sj=si+(a==="shUp"?-1:1);if(si<0||sj<0||sj>=Sh.length)return;Sh.splice(sj,0,Sh.splice(si,1)[0])}
  else if(a==="catUp"||a==="catDown"){var M=DRAFT.menu,ci=M.findIndex(function(c){return c.id===id}),cj=ci+(a==="catUp"?-1:1);if(ci<0||cj<0||cj>=M.length)return;M.splice(cj,0,M.splice(ci,1)[0])}
  else if(a==="itUp"||a==="itDown"){var it=findC(t.dataset.cid).items,ii=it.findIndex(function(x){return x.id===id}),ij=ii+(a==="itUp"?-1:1);if(ii<0||ij<0||ij>=it.length)return;it.splice(ij,0,it.splice(ii,1)[0])}
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
app.addEventListener("submit",function(e){
  if(e.target.id!=="shf")return;e.preventDefault();
  var v=document.getElementById("shpw").value.trim();
  if(v===SHIFT_PW){lsSet("bc-shifts",SHIFT_PW);render(false)}else{document.getElementById("sherr").textContent="Das Passwort stimmt nicht."}
});
app.addEventListener("keydown",function(e){
  if((e.key==="Enter"||e.key===" ")&&e.target.matches("img[data-go]")){e.preventDefault();go(e.target.dataset.go)}
  if(e.key==="Escape"&&route==="info")go("home");
  if(e.key==="Enter"&&e.target.classList.contains("sc")){var card=e.target.closest(".rres");if(card){var b=card.querySelector('[data-act="saveRes"]');if(b)b.click()}}
});

/* ---------- welcome ---------- */
function welcome(done){
  // Intro bei jedem Öffnen der Seite (nicht im Orga-Bereich und nicht auf der Infoseite)
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var w=document.createElement("div");w.id="welcome";w.setAttribute("role","dialog");w.setAttribute("aria-label","Willkommen zum 40. Soester Börde-Cup");
  w.innerHTML='<canvas></canvas><div class="w-inner"><img class="w-logo" src="'+LOGO+'" alt="Logo Soester Hockey-Club"><p class="w-num">40.</p><p class="w-title">Soester Börde-Cup</p><p class="w-sub">Schön, dass ihr da seid</p></div>';
  document.body.appendChild(w);done();
  var fin=false;function close(){if(fin)return;fin=true;w.classList.add("out");setTimeout(function(){w.remove()},650)}
  w.addEventListener("click",close);
  var cv=w.querySelector("canvas"),ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1);
  var vw=Math.max(innerWidth||0,document.documentElement.clientWidth||0,320),vh=Math.max(innerHeight||0,document.documentElement.clientHeight||0,480);
  cv.width=vw*dpr;cv.height=vh*dpr;
  var cols=["#FFFFFF","#000000","#F4D27A","#1C4E9E","#FFFFFF"],P=[];
  if(reduce){
    // "Bewegung reduzieren" ist am Gerät aktiv: Konfetti ohne Bewegung, damit es trotzdem festlich aussieht
    for(var i=0;i<140;i++){ctx.save();ctx.translate(Math.random()*cv.width,Math.random()*cv.height);ctx.rotate(Math.random()*6.3);ctx.fillStyle=cols[i%cols.length];
      if(Math.random()<.25){ctx.beginPath();ctx.arc(0,0,(3+Math.random()*3)*dpr,0,6.3);ctx.fill()}else ctx.fillRect(-5*dpr,-2.5*dpr,(7+Math.random()*6)*dpr,(3+Math.random()*4)*dpr);ctx.restore()}
    setTimeout(close,2600);return}
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
function vSetup(){return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Ersteinrichtung</h1><p>Die Datenbank ist noch leer. Lege die Startdaten an: 8 Herren- und 6 Damen-Teams, den Spielplan für beide Tage, eine Beispielkarte und Infotexte.</p><button class="btn red" style="width:100%" data-act="seed">Startdaten anlegen</button><p style="margin-top:14px"><button class="btn ghost sm" data-act="logout">Abmelden</button></p></div></main>'}
var DEFAULT_MENU=[{"id":"c1","name":"Getränke","items":[{"id":"i1","name":"Bier 0,3 l","price":2.5,"note":"","out":false},{"id":"i2","name":"Radler 0,3 l","price":2.5,"note":"","out":false},{"id":"i3","name":"Softdrinks 0,3 l","price":2,"note":"Cola, Fanta, Sprite","out":false},{"id":"i4","name":"Wasser 0,5 l","price":1.5,"note":"","out":false},{"id":"i5","name":"Kaffee","price":1.5,"note":"","out":false}]},{"id":"c2","name":"Essen","items":[{"id":"i6","name":"Bratwurst im Brötchen","price":3.5,"note":"","out":false},{"id":"i7","name":"Pommes","price":3,"note":"Mayo oder Ketchup","out":false},{"id":"i8","name":"Kuchen","price":2,"note":"selbst gebacken","out":false}]}];
var CONCEPT_TEXT="Damen (6 Teams)\nJede gegen jede, also 5 Gruppenspiele pro Team (12 Spiele am Samstag, 3 am Sonntagmorgen). Danach Halbfinale (1. gegen 4., 2. gegen 3.), Spiel um Platz 5 (5. gegen 6.), Spiel um Platz 3 und Finale.\n\nHerren (8 Teams)\nZwei Gruppen mit je 4 Teams, jede gegen jede, also 3 Gruppenspiele pro Team, alle am Samstag. Am Sonntag: Halbfinale 1. A gegen 2. B und 1. B gegen 2. A, Überkreuzspiele 3. A gegen 4. B und 3. B gegen 4. A. Danach Spiele um Platz 7, 5 und 3 und das Finale, es werden alle Plätze ausgespielt.\n\nSpielzeiten\nGruppenspiele: 20 Minuten Spielzeit, 5 Minuten Wechsel. Platzierungsspiele am Sonntag: 17 Minuten Spielzeit, 5 Minuten Wechsel. Samstag von 9:00 bis ca. 18:55 Uhr, Sonntag von 9:00 bis ca. 15:00 Uhr.\n\nWertung\nSieg 3 Punkte, Unentschieden 1 Punkt. Bei Punktgleichheit entscheiden Tordifferenz, dann mehr erzielte Tore, zuletzt das Los. Platzierungsspiele werden bei Unentschieden im 7m-Schießen entschieden.\n\nSchiedsrichter\nDas erste Spiel am Samstag und am Sonntag pfeifen zwei Schiedsrichter aus Soest, danach pfeifen immer die beiden Teams aus dem vorherigen Spiel. Bitte bleibt nach eurem Spiel direkt am Platz.";
var DEFAULT_INFO=[
 {id:"s1",title:"Turnierkonzept",text:CONCEPT_TEXT},
 {id:"s2",title:"Party",text:"Die Infos zur Party folgen."},
 {id:"s3",title:"Allgemeines und Infos zum Shuttle",text:"Adresse und Ansprechpartner folgen."}];
// Auslosung (Stand 13.10.2026, Spielplan_Modell2_final.xlsx)
var DRAW={H:{A1:"Soester HC",A2:"Steglitzer TK",A3:"Schlick Town and Friends",A4:"THC Münster",B1:"Dortmunder Kronen",B2:"Wilde 13",B3:"HC Kopinnacken",B4:"TG Heimfeld"},
  D:{1:"Soester HC",2:"Wilde 13",3:"Kamucitas",4:"Dortmunder Kronen",5:"HC Buer",6:"HC Drömelig"}};
// Shuttle Samstag zur Schützenhalle Ampen (2 Großraumtaxis, Stand 13.10.2026)
// Shuttle Samstag zur Schützenhalle Ampen (3 Taxis, Stand 15.10.2026)
var SHUTTLE_STAND="15.10.";
var DEFAULT_SHUTTLE=[
 ["Steglitzer TK","City Motel","19:00 Taxi 3 (5 Pers.) · 19:40 Taxi 3 (3 Pers.)"],
 ["Wilde 13 Herren","Hotel am Wall","19:00 Taxi 1 (8 Pers.) · 19:20 Taxi 1 (2 Pers.)"],
 ["Dortmunder Kronen Herren","Hotel am Wall","19:00 Taxi 2 (8 Pers.)"],
 ["THC Münster","Hanse-Hotel","19:15 Taxi 3 (5 Pers.) · 19:25 Taxi 3 (5 Pers.)"],
 ["Wilde 13 Damen","Hotel am Wall","19:20 Taxi 1 (6 Pers.) · 19:20 Taxi 2 (4 Pers.)"],
 ["HC Drömelig","Hotel am Wall","19:20 Taxi 2 (4 Pers.) · 19:40 Taxi 1 (6 Pers.)"],
 ["Schlick Town and Friends","Hotel am Wall","19:40 Taxi 1 (2 Pers.) · 19:40 Taxi 2 (8 Pers.)"],
 ["TG Heimfeld","City Motel","19:40 Taxi 3 (2 Pers.) · 20:00 Taxi 3 (5 Pers.)"],
 ["HC Kopinnacken","Hotel am Wall","20:00 Taxi 1 (8 Pers.) · 20:00 Taxi 2 (3 Pers.)"],
 ["HC Buer","Hotel am Wall","20:00 Taxi 2 (5 Pers.) · 20:20 Taxi 1 (5 Pers.)"],
 ["Kamucitas","Hanse-Hotel","20:25 Taxi 3 (5 Pers.) · 20:35 Taxi 3 (5 Pers.)"],
 ["Dortmunder Kronen Damen","Hotel am Wall","20:40 Taxi 1 (8 Pers.) · 20:40 Taxi 2 (3 Pers.)"],
 ["Soester HC Herren und Damen","–","eigene Anreise"]].map(function(r,i){return {id:"t"+(i+1),team:r[0],place:r[1],time:r[2]}});
function nkey(n){return String(n||"").toLowerCase().replace(/[^a-z0-9äöüß]/g,"")}
function newMain(old){
  var teams=defaultTeams();teams.forEach(function(t){var n=t.cat==="H"?DRAW.H[t.seed]:DRAW.D[t.seed];if(n)t.name=n});
  var keepGold=(old&&old.goldTeams||[]).filter(function(g){return !g.teamId});
  var s=Object.assign({},DEFAULT_SETTINGS);if(old&&old.settings){["place","date","day1","day2","start1","start2","refFirst"].forEach(function(k){if(old.settings[k])s[k]=old.settings[k]})}
  var info=(old&&old.info&&old.info.length)?clone(old.info):clone(DEFAULT_INFO);
  var ci=info.findIndex(function(x){return /turnierkonzept/i.test(x.title||"")});if(ci>=0)info[ci].text=CONCEPT_TEXT;else info.unshift({id:"s1",title:"Turnierkonzept",text:CONCEPT_TEXT});
  return {mode:MODE,settings:s,teams:teams,menu:(old&&old.menu&&old.menu.length)?old.menu:DEFAULT_MENU,
    goldTeams:teams.map(function(t){return {id:"g"+t.id,teamId:t.id,name:""}}).concat(keepGold),
    info:info,shuttle:clone(DEFAULT_SHUTTLE),shuttleStand:SHUTTLE_STAND,updated:new Date().toISOString()};
}
async function seed(){
  if(STATE||!mainLoaded)return;
  try{await setDoc(refs.main,newMain(null));await setDoc(refs.results,{games:{},los:{}});
    await setDoc(refs.gold,{log:[],updated:""});await setDoc(refs.logos,{});toast("Startdaten angelegt")}
  catch(err){writeErr(err)}
}
async function migrate(){
  var old=STATE,oldTeams=(old&&old.teams)||[],oldGold=(old&&old.goldTeams)||[],log=(old&&old.goldLog)||[],m=newMain(old),nl={};
  // Logos und Thekengold-Teams per Teamname übernehmen (Buchungen hängen an der Thekengold-ID)
  m.goldTeams=m.teams.map(function(t){
    var o=oldTeams.find(function(x){return x.cat===t.cat&&nkey(x.name)===nkey(t.name)});
    if(o&&LOGOS[o.id])nl[t.id]=LOGOS[o.id];
    var og=o&&oldGold.find(function(g){return g.teamId===o.id});
    return {id:og?og.id:"g"+t.id,teamId:t.id,name:""}}).concat(oldGold.filter(function(g){return !g.teamId}));
  oldGold.forEach(function(g){if(g.teamId&&!m.goldTeams.some(function(x){return x.id===g.id})&&log.some(function(e){return e.g===g.id})){
    var o=oldTeams.find(function(x){return x.id===g.teamId});m.goldTeams.push({id:g.id,teamId:"",name:o?o.name:"Team"})}});
  try{await setDoc(refs.main,m);await setDoc(refs.results,{games:{},los:{}});
    if(Object.keys(LOGOS).length)await setDoc(refs.logos,nl);
    lsSet("bc-draft",null);DRAFT=null;toast("Neuer Spielplan ist live")}
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
  var fb=initializeApp(c),db=initializeFirestore(fb,{experimentalAutoDetectLongPolling:true});auth=getAuth(fb);
  restFallback(c);
  refs={main:doc(db,"boerdecup","main"),gold:doc(db,"boerdecup","gold"),logos:doc(db,"boerdecup","logos"),results:doc(db,"boerdecup","results")};
  var goldLog=[],goldUpdated="";
  onAuthStateChanged(auth,function(u){USER=u;authReady=true;if(!u)DRAFT=null;render(true)});
  onSnapshot(refs.main,function(snap){
    if(!snap.exists()&&snap.metadata&&snap.metadata.fromCache)return;
    var wasDirty=isDirty();mainLoaded=true;if(!(snap.metadata&&snap.metadata.fromCache)){liveOK=true;if(restTimer)clearInterval(restTimer)}
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
/* ---------- Notlauf: Daten per REST laden, falls die Live-Verbindung auf einem Gerät nicht zustande kommt ---------- */
var liveOK=false,restTimer=null;
function fsVal(v){
  if(!v||typeof v!=="object")return null;
  if("stringValue" in v)return v.stringValue;
  if("integerValue" in v)return Number(v.integerValue);
  if("doubleValue" in v)return Number(v.doubleValue);
  if("booleanValue" in v)return v.booleanValue;
  if("nullValue" in v)return null;
  if("timestampValue" in v)return v.timestampValue;
  if("mapValue" in v){var o={},f=v.mapValue.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k])});return o}
  if("arrayValue" in v)return (v.arrayValue.values||[]).map(fsVal);
  return null}
async function restGet(c,name){
  var r=await fetch("https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(c.projectId)+"/databases/(default)/documents/boerdecup/"+name+"?key="+encodeURIComponent(c.apiKey),{cache:"no-store"});
  if(r.status===404)return null;if(!r.ok)throw new Error("HTTP "+r.status);
  var j=await r.json(),o={},f=j.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k])});return o}
function restFallback(c){
  async function load(){
    if(liveOK){clearInterval(restTimer);return}
    try{
      var m=await restGet(c,"main"),rs=await restGet(c,"results"),g=await restGet(c,"gold"),l=await restGet(c,"logos");
      if(liveOK)return;
      mainLoaded=true;slowLoad=false;
      var gl=((g&&g.log)||[]).slice().sort(function(a,b){return a.ts-b.ts});
      STATE=m?norm(m):null;if(STATE){STATE.goldLog=gl;STATE.goldUpdated=(g&&g.updated)||""}
      RESULTS={games:(rs&&rs.games)||{},los:(rs&&rs.los)||{}};LOGOS=l||{};
      safeRender();
    }catch(e){console.error("REST",e)}
  }
  setTimeout(function(){if(!liveOK){load();restTimer=setInterval(load,15000)}},5000);
}
/* ---------- start ---------- */
setInterval(function(){if((route==="plan"||route==="home")&&!document.querySelector("#welcome"))render(true)},20000);
window.addEventListener("pagehide",saveResume);window.addEventListener("beforeunload",saveResume);
var res=lsGet("bc-resume");
if(res&&Date.now()-res.t<90e3){route=res.route||"home";atab=res.atab||atab;gsel=res.gsel||"";filter=res.filter||"Alle";if(typeof res.resDay==="number")resDay=res.resDay}
if(ATABS.every(function(x){return x[0]!==atab}))atab="results";
if(location.hash==="#orga")route="admin";
if(location.hash==="#info")route="info";
if(location.hash==="#schichten")route="shifts";
if(route==="admin"||route==="info"){done0()}else welcome(done0);
function done0(){render(false)}
startFirebase();

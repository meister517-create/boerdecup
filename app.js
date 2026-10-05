
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,doc,onSnapshot,setDoc,updateDoc,arrayUnion,arrayRemove,deleteField} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

var CFG=window.BC_CONFIG||{};
var LOGO="logo.png";
var app=document.getElementById("app");
var STATE=null, LOGOS={}, USER=null, authReady=false, DRAFT=null, route="home", filter="Alle", atab="gold", gsel="", publishing=false, pendingRender=false;
var MAIN_FIELDS=["settings","teams","matches","menu","goldTeams"];

function norm(s){s.settings=s.settings||{};s.teams=s.teams||[];s.matches=s.matches||[];s.menu=s.menu||[];s.goldTeams=s.goldTeams||[];s.goldLog=s.goldLog||[];delete s.gold;return s}

/* ---------- storage helpers ---------- */
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function authed(){return !!USER}
function saveResume(){lsSet("bc-resume",{route:route,atab:atab,gsel:gsel,filter:filter,t:Date.now()})}

/* ---------- utils ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function uid(p){return p+Math.random().toString(36).slice(2,9)}
function eur(n){return Number(n||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}
function clone(o){return JSON.parse(JSON.stringify(o))}
function S(){return DRAFT||STATE||norm({})}
function teamById(id){return id?S().teams.find(function(t){return t.id===id}):null}
function hasScore(m){return m.hs!=null&&m.hs!==""&&m.as!=null&&m.as!==""}
function gl(g){return /^[A-Za-z0-9]{1,2}$/.test(g)?"Gruppe "+g:g}
function groups(){var g=[];S().teams.forEach(function(t){if(t.group&&g.indexOf(t.group)<0)g.push(t.group)});return g.sort()}
function mday(m){return m.day||S().settings.day||""}
function sortedMatches(){return S().matches.slice().sort(function(a,b){return mday(a).localeCompare(mday(b))||(a.time||"").localeCompare(b.time||"")||String(a.pitch).localeCompare(String(b.pitch))})}
function dur(){return Math.max(1,+S().settings.dur||20)}
function matchStart(m){var d=mday(m);if(!d||!m.time)return null;var p=d.split("-"),h=m.time.split(":");return new Date(+p[0],p[1]-1,+p[2],+h[0],+h[1]||0).getTime()}
function liveInfo(m){if(hasScore(m))return null;var s=matchStart(m);if(s===null)return null;var n=Date.now(),D=dur()*60e3;if(n<s||n>=s+D)return null;return{min:Math.floor((n-s)/60e3)+1,p:(n-s)/D}}
function liveMatches(){return sortedMatches().filter(function(m){return liveInfo(m)})}
function nextMatch(){return sortedMatches().find(function(m){return !hasScore(m)&&!liveInfo(m)})}
function fmtDay(d,o){if(!d)return"";var p=d.split("-");return new Date(+p[0],p[1]-1,+p[2]).toLocaleDateString("de-DE",o||{weekday:"long",day:"numeric",month:"long"})}
function multiDay(){var s={};S().matches.forEach(function(m){s[mday(m)]=1});return Object.keys(s).length>1}
function dayText(){var d=S().settings.day;if(!d)return"";var p=d.split("-");return new Date(+p[0],p[1]-1,+p[2]).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function initials(n){var w=String(n||"?").replace(/[^\p{L}\p{N} ]/gu,"").trim().split(/\s+/);return ((w[0]||"?")[0]+(w[1]?w[1][0]:(w[0]||"")[1]||"")).toUpperCase()}
function logo(team,size,ph){
  var st=size?' style="--s:'+size+'px"':'';
  if(!team)return '<span class="lg nil"'+st+' aria-hidden="true">?</span>';
  var src=team.logo||(team.id&&LOGOS[team.id]);
  if(src)return '<span class="lg"'+st+'><img src="'+esc(src)+'" alt="" loading="lazy"></span>';
  return '<span class="lg ini"'+st+' aria-hidden="true">'+esc(initials(team.name))+'</span>';
}
function sideName(m,side){var t=teamById(m[side]);return t?t.name:(m[side==="home"?"hn":"an"]||"offen")}
function gtTeam(g){return g.teamId?teamById(g.teamId):null}
function gtName(g){var t=gtTeam(g);return t?t.name:(g.name||"Team")}
function gtLogoObj(g){var t=gtTeam(g);return t||{name:g.name}}

/* ---------- icons & nav ---------- */
var ICON={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/></svg>',
 teams:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
 table:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V10h5v11M9 21V4h6v17M15 21v-8h5v8M2 21h20"/></svg>',
 food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v8a3 3 0 0 0 6 0V2M9 2v20M17 2c-2 2-3 5-3 8h4v12"/></svg>',
 gold:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 10h2.5a2.5 2.5 0 0 1 0 5H15M5 8a3 3 0 0 1 2.5-4 3 3 0 0 1 5 0A3 3 0 0 1 15 8M8.5 12v5M11.5 12v5"/></svg>'
};
var NAV=[["home","Start"],["plan","Spielplan"],["teams","Teams"],["table","Tabelle"],["food","Essen"],["gold","Thekengold"]];
function nav(){return '<nav class="bn" aria-label="Hauptnavigation"><div class="wrap">'+NAV.map(function(p){
  return '<button data-go="'+p[0]+'"'+(route===p[0]?' aria-current="page"':'')+'>'+ICON[p[0]]+'<span>'+p[1]+'</span></button>'}).join("")+'</div></nav>'}
function pageHead(t){return '<div class="ph"><div class="wrap"><img src="'+LOGO+'" alt="Zur Startseite" role="button" tabindex="0" data-go="home"><h1>'+t+'</h1></div></div>'}

/* ---------- data ---------- */
function standings(g){
  var rows={};
  S().teams.filter(function(t){return t.group===g}).forEach(function(t){rows[t.id]={t:t,sp:0,s:0,u:0,n:0,tf:0,tg:0,p:0}});
  S().matches.forEach(function(m){
    if(m.group!==g||!hasScore(m))return;var h=rows[m.home],a=rows[m.away];if(!h||!a)return;
    var hs=+m.hs,as=+m.as;h.sp++;a.sp++;h.tf+=hs;h.tg+=as;a.tf+=as;a.tg+=hs;
    if(hs>as){h.s++;a.n++;h.p+=3}else if(hs<as){a.s++;h.n++;a.p+=3}else{h.u++;a.u++;h.p++;a.p++}});
  return Object.keys(rows).map(function(k){return rows[k]}).sort(function(a,b){return b.p-a.p||(b.tf-b.tg)-(a.tf-a.tg)||b.tf-a.tf||a.t.name.localeCompare(b.t.name)});
}
function goldTotals(){
  var tot={};S().goldTeams.forEach(function(g){tot[g.id]=0});
  S().goldLog.forEach(function(e){if(e.g in tot)tot[e.g]+=+e.a||0});
  return S().goldTeams.map(function(g){return{g:g,v:tot[g.id]}}).sort(function(a,b){return b.v-a.v||gtName(a.g).localeCompare(gtName(b.g))});
}

/* ---------- frontend views ---------- */
var PITCH='<svg class="pitch" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" stroke-width="2"><rect x="-20" y="20" width="440" height="560"/><path d="M60 300a140 140 0 0 1 280 0"/><path d="M95 300a105 105 0 0 1 210 0" stroke-dasharray="8 10"/><path d="M-20 150h440" opacity=".6"/><circle cx="200" cy="240" r="3" fill="#fff"/><path d="M170 300v-14h60v14"/></svg>';
function hero(){
  var st=S().settings,meta=[st.date||dayText(),st.place].filter(Boolean).map(esc).join(", ");
  return '<header class="hero">'+PITCH+'<div class="wrap"><div class="hero-top"><img src="'+LOGO+'" alt="Logo Soester Hockey-Club"><div class="club">Soester Hockey-Club e.V.<br>seit 1996</div></div>'+
   '<div class="hero-num"><span class="n" aria-hidden="true">40</span><span class="lbl">Auflage<br>des Turniers</span></div><h1>Soester Börde-Cup</h1>'+(meta?'<p class="meta">'+meta+'</p>':'')+'</div></header>';
}
function tile(k,t,body,cls){return '<button class="tile '+cls+'" data-go="'+k+'"><div class="t-head"><h2>'+t+'</h2>'+ICON[k]+'</div><div class="t-body">'+body+'</div></button>'}
function vHome(){
  var nm=nextMatch(),gs=groups(),gr=goldTotals().filter(function(r){return r.v>0}),items=[].concat.apply([],S().menu.map(function(c){return c.items||[]}));
  var lv=liveMatches();
  var wd=function(m){return multiDay()?fmtDay(mday(m),{weekday:'long'})+' ':''};
  var plan=lv.length?'<span class="lvtag"><i></i>Live'+(lv.length>1?', '+lv.length+' Spiele':'')+'</span><span>'+liveInfo(lv[0]).min+'. Minute, Platz '+esc(lv[0].pitch)+'</span><strong>'+esc(sideName(lv[0],"home"))+'<span class="vs">gegen</span>'+esc(sideName(lv[0],"away"))+'</strong>'
    :nm?'<span>Als Nächstes '+esc(wd(nm))+'um '+esc(nm.time)+' Uhr, Platz '+esc(nm.pitch)+'</span><strong>'+esc(sideName(nm,"home"))+'<span class="vs">gegen</span>'+esc(sideName(nm,"away"))+'</strong>'
    :(S().matches.length?'<strong>Alle Spiele sind gespielt</strong>':'<strong>Der Spielplan folgt</strong>');
  var leaders=gs.map(function(g){var s=standings(g);return s.length&&s[0].sp?esc(gl(g))+': '+esc(s[0].t.name):''}).filter(Boolean);
  var tbl=leaders.length?'<strong>'+leaders[0]+'</strong>'+(leaders[1]?'<span>'+leaders[1]+'</span>':''):'<strong>Noch keine Ergebnisse</strong>';
  var ch=items.filter(function(i){return !i.out}).sort(function(a,b){return a.price-b.price})[0];
  var food=items.length?'<strong>'+items.length+' Angebote</strong><span>'+(ch?'ab '+eur(ch.price):'')+'</span>':'<strong>Karte folgt</strong>';
  var tm=S().teams;
  var teams='<div class="lgs">'+tm.slice(0,6).map(function(t){return logo(t)}).join("")+'</div><strong>'+tm.length+' Teams</strong>';
  var gold=gr.length?'<strong>'+esc(gtName(gr[0].g))+'</strong><span>liegt an der Theke vorn</span>':'<strong>Wer holt das Gold?</strong><span>Die Theke ist eröffnet</span>';
  return hero()+'<main><div class="wrap"><div class="tiles">'+tile("plan","Spielplan",plan,"big")+tile("table","Tabelle",tbl,"")+tile("food","Essen & Getränke",food,"")+tile("teams","Teams",teams,"")+tile("gold","Thekengold",gold,"gold")+
   '</div><p class="foot">40. Soester Börde-Cup des Soester Hockey-Club e.V.<br><button data-go="admin">Orga-Bereich</button></p></div></main>'+nav();
}
function gameHTML(m,nx){
  var sc=hasScore(m),hs=+m.hs,as=+m.as,t1=teamById(m.home),t2=teamById(m.away),lv=liveInfo(m);
  var mid='<div class="mid">'+(lv?'<span class="pill lv"><i></i>LIVE</span>':nx?'<span class="pill">Als Nächstes</span>':'')+'<div class="grp">'+esc(m.group?gl(m.group):(m.round||"Finalrunde"))+'</div>'+
    (lv?'<div class="min">'+lv.min+'. Min.</div><div class="prog" aria-hidden="true"><b style="--p:'+(lv.p*100).toFixed(1)+'%"></b></div><div class="small">seit '+esc(m.time)+' Uhr, Platz '+esc(m.pitch)+'</div>'
    :sc?'<div class="score">'+hs+':'+as+'</div><div class="small">'+esc(m.time)+' Uhr, Platz '+esc(m.pitch)+'</div>'
       :'<div class="vs">vs.</div><div class="clock">'+esc(m.time)+'</div><div class="small">Platz '+esc(m.pitch)+'</div>')+'</div>';
  function side(t,s,won){return '<div class="side">'+logo(t,56)+'<span class="nm'+(t?'':' ph-t')+(won?' won':'')+'">'+esc(s)+'</span></div>'}
  return '<div class="game'+(lv?' live':nx?' next':'')+'">'+side(t1,sideName(m,"home"),sc&&hs>as)+mid+side(t2,sideName(m,"away"),sc&&as>hs)+'</div>';
}
function vPlan(){
  var gs=groups(),opts=["Alle"].concat(gs.map(gl)).concat(S().matches.some(function(m){return !m.group})?["Finalrunde"]:[]);
  var teamF=filter.indexOf("team:")===0?teamById(filter.slice(5)):null;
  if(!teamF&&opts.indexOf(filter)<0)filter="Alle";
  var nm=nextMatch();
  var ms=sortedMatches().filter(function(m){
    if(teamF)return m.home===teamF.id||m.away===teamF.id;
    if(filter==="Alle")return true;if(filter==="Finalrunde")return !m.group;return gl(m.group)===filter});
  var chips=(teamF?'<button class="chip" data-filter="Alle" aria-pressed="true">'+esc(teamF.name)+' ✕</button>':'')+opts.map(function(o){return '<button class="chip" data-filter="'+esc(o)+'" aria-pressed="'+(!teamF&&o===filter)+'">'+esc(o)+'</button>'}).join("");
  var md=multiDay(),cur=null;var body=ms.length?'<div class="games">'+ms.map(function(m){var h='';if(md&&mday(m)!==cur){cur=mday(m);h='<h2 class="dayh">'+esc(fmtDay(cur))+'</h2>'}return h+gameHTML(m,nm&&nm.id===m.id)}).join("")+'</div>':'<div class="empty">In dieser Auswahl gibt es keine Spiele.</div>';
  return pageHead("Spielplan")+'<main><div class="wrap"><div class="chips" role="group" aria-label="Filter">'+chips+'</div>'+body+'</div></main>'+nav();
}
function vTeams(){
  var gs=groups(),tm=S().teams,rest=tm.filter(function(t){return !t.group});
  function grid(list){return '<div class="tgrid">'+list.map(function(t){return '<button class="tcard" data-team="'+t.id+'">'+logo(t,84)+'<span class="nm">'+esc(t.name)+'</span></button>'}).join("")+'</div>'}
  var body=tm.length?gs.map(function(g){return '<h2 class="sec">'+esc(gl(g))+'</h2>'+grid(tm.filter(function(t){return t.group===g}))}).join("")+(rest.length?'<h2 class="sec">Weitere Teams</h2>'+grid(rest):'')
    :'<div class="empty">Die Teams werden bald bekannt gegeben.</div>';
  return pageHead("Teams")+'<main><div class="wrap"><p class="hint" style="margin-top:0">Tippe auf ein Team, um seine Spiele zu sehen.</p>'+body+'</div></main>'+nav();
}
function vTable(){
  var gs=groups();
  var body=gs.length?gs.map(function(g){var s=standings(g);
    return '<h2 class="sec">'+esc(gl(g))+'</h2><div class="tbl-wrap"><table><thead><tr><th>#</th><th class="team">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>'+
     s.map(function(r,i){return '<tr class="'+(i===0&&r.sp?'lead':'')+'"><td class="pos">'+(i+1)+'</td><td class="team"><span class="tc">'+logo(r.t,28)+esc(r.t.name)+'</span></td><td>'+r.sp+'</td><td>'+r.s+'</td><td>'+r.u+'</td><td>'+r.n+'</td><td>'+r.tf+':'+r.tg+'</td><td class="pts">'+r.p+'</td></tr>'}).join("")+'</tbody></table></div>'}).join("")
   :'<div class="empty">Sobald Teams einer Gruppe zugeordnet sind, erscheint hier die Tabelle.</div>';
  return pageHead("Tabelle")+'<main><div class="wrap">'+body+'<p class="hint">Sieg 3 Punkte, Unentschieden 1 Punkt. Bei Gleichstand zählt die Tordifferenz, dann die erzielten Tore.</p></div></main>'+nav();
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

/* ---------- admin views ---------- */
function vLogin(){
  return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Orga-Bereich</h1><p>Anmelden, um den Börde-Cup zu pflegen.</p>'+
  '<form id="lf" autocomplete="on"><label class="f" for="lu">Nutzername</label><input class="in" id="lu" autocomplete="username" autocapitalize="none" required>'+
  '<label class="f" for="lp">Passwort</label><input class="in" id="lp" type="password" autocomplete="current-password" required>'+
  '<button class="btn red" style="width:100%;margin-top:18px" type="submit">Anmelden</button><div class="err" id="lerr" role="alert"></div></form>'+
  '<p style="margin-top:18px"><button class="btn ghost sm" data-go="home">Zur Startseite</button></p></div></main>';
}
var ATABS=[["gold","Thekengold"],["teams","Teams"],["plan","Spielplan"],["food","Essen & Getränke"],["general","Allgemein"]];
function opt(v,l,sel){return '<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(l)+'</option>'}
function aTeams(D){
  return '<p class="hint">Namen hier ändern, der Spielplan übernimmt sie automatisch. Gruppe als Buchstabe (z. B. A) oder frei (z. B. Herren A). Logos als PNG oder JPG, sie werden einheitlich zugeschnitten und sind sofort sichtbar. Neue Teams erst veröffentlichen, dann Logo hochladen.</p><div class="rows">'+
   D.teams.map(function(t){return '<div class="card"><div class="row"><input class="in grow" data-k="team.name" data-id="'+t.id+'" value="'+esc(t.name)+'" aria-label="Teamname"><input class="in" style="width:96px" data-k="team.group" data-id="'+t.id+'" value="'+esc(t.group)+'" aria-label="Gruppe" placeholder="Gruppe"></div>'+
    '<div class="row" style="margin-top:8px;justify-content:space-between"><div class="upl">'+logo(t,44)+'<label class="btn ghost sm">'+(LOGOS[t.id]?'Logo ändern':'Logo hochladen')+'<input type="file" accept="image/png,image/jpeg" data-logo="'+t.id+'"></label>'+(LOGOS[t.id]?'<button class="btn icon sm" data-act="delLogo" data-id="'+t.id+'">Entfernen</button>':'')+'</div>'+
    '<button class="btn icon" data-act="delTeam" data-id="'+t.id+'" aria-label="Team löschen">✕</button></div></div>'}).join("")+
   '</div><button class="btn ghost" data-act="addTeam" style="margin-top:4px">Team hinzufügen</button>';
}
function aPlan(D){
  var teamOpts=function(sel){return opt("","— offen / Platzhalter —",sel)+D.teams.map(function(t){return opt(t.id,t.name+(t.group?" ("+t.group+")":""),sel)}).join("")};
  return '<div class="card"><h2 class="sec">Gruppenspiele erzeugen</h2><p class="hint">Erstellt jeder gegen jeden innerhalb der Gruppen und ersetzt alle bisherigen Gruppenspiele. Finalspiele bleiben erhalten.</p>'+
   '<div class="mgrid" style="grid-template-columns:1fr 1fr 1fr"><div><label class="f" for="gs">Beginn</label><input class="in" id="gs" type="time" value="09:00"></div><div><label class="f" for="gd">Takt (Min.)</label><input class="in" id="gd" type="number" min="5" value="20"></div><div><label class="f" for="gp">Plätze</label><input class="in" id="gp" type="number" min="1" value="1"></div></div>'+
   '<button class="btn ghost sm" data-act="gen" style="margin-top:12px">Gruppenspiele erzeugen</button></div>'+
   '<p class="hint">Ergebnisse eintragen und unten veröffentlichen. Leere Torfelder bedeuten: noch nicht gespielt.</p><div class="rows">'+
   sortedMatches().map(function(m){
    return '<div class="card"><input class="in" type="date" data-k="m.day" data-id="'+m.id+'" value="'+esc(mday(m))+'" aria-label="Spieltag" style="margin-bottom:8px"><div class="mgrid"><input class="in" type="time" data-k="m.time" data-id="'+m.id+'" value="'+esc(m.time)+'" aria-label="Uhrzeit"><input class="in" data-k="m.pitch" data-id="'+m.id+'" value="'+esc(m.pitch)+'" aria-label="Platz" placeholder="Platz">'+
    '<div class="row"><input class="in" style="width:70px" data-k="m.group" data-id="'+m.id+'" value="'+esc(m.group)+'" placeholder="Gr." aria-label="Gruppe"><input class="in grow" data-k="m.round" data-id="'+m.id+'" value="'+esc(m.round)+'" placeholder="z. B. Finale" aria-label="Runde"></div></div>'+
    '<div class="mteams"><select class="in" data-k="m.home" data-id="'+m.id+'" aria-label="Heimteam">'+teamOpts(m.home)+'</select><input class="in" inputmode="numeric" data-k="m.hs" data-id="'+m.id+'" value="'+(m.hs==null?"":m.hs)+'" aria-label="Tore Heim" style="text-align:center">'+
    (m.home?'':'<input class="in" data-k="m.hn" data-id="'+m.id+'" value="'+esc(m.hn)+'" placeholder="Platzhalter, z. B. 1. Gruppe A" aria-label="Platzhalter Heim"><span></span>')+
    '<span class="vsl">gegen</span><select class="in" data-k="m.away" data-id="'+m.id+'" aria-label="Gastteam">'+teamOpts(m.away)+'</select><input class="in" inputmode="numeric" data-k="m.as" data-id="'+m.id+'" value="'+(m.as==null?"":m.as)+'" aria-label="Tore Gast" style="text-align:center">'+
    (m.away?'':'<input class="in" data-k="m.an" data-id="'+m.id+'" value="'+esc(m.an)+'" placeholder="Platzhalter, z. B. Sieger HF 1" aria-label="Platzhalter Gast"><span></span>')+
    '</div><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn icon sm" data-act="delMatch" data-id="'+m.id+'">Spiel löschen</button></div></div>'}).join("")+
   '</div><button class="btn ghost" data-act="addMatch">Spiel hinzufügen</button>';
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
  return '<div class="card"><h2 class="sec">Live-Anzeige</h2><p class="hint">Mit Turniertag und Spieldauer erkennt der Spielplan anhand der echten Uhrzeit, welche Spiele gerade laufen. Sobald ein Ergebnis eingetragen ist, gilt ein Spiel als beendet.</p>'+
   '<div class="mgrid" style="grid-template-columns:1fr 1fr"><div><label class="f" for="sday" style="margin-top:0">Erster Turniertag</label><input class="in" id="sday" type="date" data-k="set.day" value="'+esc(D.settings.day||"")+'"></div>'+
   '<div><label class="f" for="sdur" style="margin-top:0">Spieldauer (Min.)</label><input class="in" id="sdur" type="number" min="1" data-k="set.dur" value="'+esc(D.settings.dur||20)+'"></div></div></div><div class="card"><label class="f" for="sd" style="margin-top:0">Datum als Text (optional)</label><input class="in" id="sd" data-k="set.date" value="'+esc(D.settings.date)+'" placeholder="leer lassen für Turniertag">'+
   '<label class="f" for="sp">Ort</label><input class="in" id="sp" data-k="set.place" value="'+esc(D.settings.place)+'"></div>'+
   '<p class="hint">Veröffentlichte Änderungen erscheinen bei allen Besuchern sofort, ohne Neuladen.</p>';
}
function pick(s){var o={};MAIN_FIELDS.forEach(function(k){o[k]=s[k]});return o}
function isDirty(){return !!DRAFT&&!!STATE&&JSON.stringify(pick(DRAFT))!==JSON.stringify(pick(STATE))}
function vAdmin(){
  var D=DRAFT,body={teams:aTeams,plan:aPlan,food:aFood,gold:aGold,general:aGeneral}[atab](D),d=isDirty();
  return '<div class="ph"><div class="wrap"><img src="'+LOGO+'" alt="Zur Startseite" role="button" tabindex="0" data-go="home"><h1>Orga</h1><button class="btn ghost sm out" data-act="logout">Abmelden</button></div>'+
   '<div class="wrap"><div class="atabs">'+ATABS.map(function(a){return '<button class="chip" data-atab="'+a[0]+'" aria-pressed="'+(a[0]===atab)+'">'+a[1]+'</button>'}).join("")+'</div></div></div>'+
   '<main style="padding-bottom:120px"><div class="wrap">'+body+'</div></main>'+
   '<div class="savebar"><div class="wrap"><span class="st'+(d?' dirty':'')+'" id="st">'+(publishing?'Wird veröffentlicht …':d?'Ungespeicherte Änderungen':'Alles veröffentlicht')+'</span><button class="btn ghost sm" data-act="reset"'+(d?'':' disabled')+'>Verwerfen</button><button class="btn red sm" data-act="publish"'+(d&&!publishing?'':' disabled')+'>Veröffentlichen</button></div></div>';
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
  else if(!STATE){app.innerHTML=vWaiting()}
  else{DRAFT=null;app.innerHTML=({home:vHome,plan:vPlan,teams:vTeams,table:vTable,food:vFood,gold:vGold}[route]||vHome)()}
  if(keep)window.scrollTo(0,y);
}
function go(r){route=r;saveResume();render(false);window.scrollTo(0,0);if(r==="plan"){var g=document.querySelector(".game.live")||document.querySelector(".game.next");if(g&&g.getBoundingClientRect().top>innerHeight*.6)g.scrollIntoView({block:"center"})}}
function loadDraft(){var d=lsGet("bc-draft"),s=clone(STATE);if(d&&d.base===STATE.updated&&d.state){MAIN_FIELDS.forEach(function(k){if(d.state[k])s[k]=d.state[k]})}return s}
function saveDraft(){if(STATE&&DRAFT)lsSet("bc-draft",{base:STATE.updated,state:pick(DRAFT)})}
function markDirty(){saveDraft();var st=document.getElementById("st"),d=isDirty();
  if(st){st.textContent=publishing?'Wird veröffentlicht …':d?'Ungespeicherte Änderungen':'Alles veröffentlicht';st.className='st'+(d?' dirty':'')}
  document.querySelectorAll('[data-act="publish"],[data-act="reset"]').forEach(function(b){b.disabled=!d||publishing})}
function toast(t){var o=document.querySelector(".toast");if(o)o.remove();var d=document.createElement("div");d.className="toast";d.setAttribute("role","status");d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},3000)}

function bindLogin(){document.getElementById("lf").addEventListener("submit",async function(e){e.preventDefault();
  var u=document.getElementById("lu").value.trim().toLowerCase(),btn=e.target.querySelector("button");btn.disabled=true;
  var email=u.indexOf("@")>0?u:u+"@"+(CFG.loginDomain||"soester-boerdecup.de");
  try{await signInWithEmailAndPassword(auth,email,document.getElementById("lp").value)}
  catch(err){btn.disabled=false;document.getElementById("lerr").textContent=(err&&err.code==="auth/too-many-requests")?"Zu viele Versuche. Bitte kurz warten.":"Nutzername oder Passwort stimmt nicht."}})}

function findM(id){return DRAFT.matches.find(function(m){return m.id===id})}
function findC(id){return DRAFT.menu.find(function(c){return c.id===id})}
function parseNum(v){v=String(v).trim().replace(",",".");if(v==="")return null;var n=parseFloat(v);return isNaN(n)?null:n}

app.addEventListener("input",function(e){
  var el=e.target,k=el.dataset.k;if(!k||!DRAFT)return;var id=el.dataset.id,v=el.type==="checkbox"?el.checked:el.value;
  if(k==="team.name")DRAFT.teams.find(function(t){return t.id===id}).name=v;
  else if(k==="team.group")DRAFT.teams.find(function(t){return t.id===id}).group=v.trim().length<=2?v.trim().toUpperCase():v;
  else if(k.indexOf("m.")===0){var m=findM(id),f=k.slice(2);
    if(f==="hs"||f==="as"){var n=parseNum(v);m[f]=n===null?null:Math.max(0,Math.round(n))}
    else if(f==="group")m.group=v.trim().length<=2?v.trim().toUpperCase():v;else m[f]=v;
    if(f==="home"||f==="away"){markDirty();render(true);return}}
  else if(k.indexOf("it.")===0){var c=findC(el.dataset.cid),it=c.items.find(function(i){return i.id===id}),g=k.slice(3);
    if(g==="price"){var p=parseNum(v);it.price=p===null?0:p}else it[g]=v}
  else if(k==="cat.name")findC(id).name=v;
  else if(k==="gt.name")DRAFT.goldTeams.find(function(g){return g.id===id}).name=v;
  else if(k.indexOf("set.")===0)DRAFT.settings[k.slice(4)]=v;
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

function pad(n){return String(n).padStart(2,"0")}
function roundRobin(ids){var t=ids.slice();if(t.length%2)t.push(null);var n=t.length,out=[];
  for(var r=0;r<n-1;r++){for(var i=0;i<n/2;i++){var a=t[i],b=t[n-1-i];if(a&&b)out.push(r%2?[b,a]:[a,b])}t.splice(1,0,t.pop())}return out}
function generate(){
  var st=(document.getElementById("gs").value||"10:00").split(":"),start=(+st[0])*60+(+st[1]||0);
  var dur=Math.max(5,+document.getElementById("gd").value||20),pitches=Math.max(1,+document.getElementById("gp").value||1);
  var queues=groups().map(function(g){return roundRobin(DRAFT.teams.filter(function(t){return t.group===g}).map(function(t){return t.id})).map(function(p){return{g:g,p:p}})});
  var list=[],more=true;while(more){more=false;queues.forEach(function(q){if(q.length){list.push(q.shift());more=true}})}
  DRAFT.matches=list.map(function(x,k){var t=start+Math.floor(k/pitches)*dur;
    return{id:uid("m"),day:S().settings.day||"",time:pad(Math.floor(t/60)%24)+":"+pad(t%60),pitch:String(k%pitches+1),group:x.g,round:"",home:x.p[0],away:x.p[1],hn:"",an:"",hs:null,as:null}})
   .concat(DRAFT.matches.filter(function(m){return !m.group}));
}

/* ---------- publish ---------- */
function writeErr(err){console.error(err);toast(err&&err.code==="permission-denied"?"Keine Berechtigung. Bitte neu anmelden.":"Speichern fehlgeschlagen. Internetverbindung prüfen.")}
async function publish(){
  if(publishing||!DRAFT)return;publishing=true;markDirty();
  var data=clone(pick(DRAFT));data.updated=new Date().toISOString();
  try{await updateDoc(refs.main,data);lsSet("bc-draft",null);publishing=false;DRAFT=null;toast("Veröffentlicht");render(true)}
  catch(err){publishing=false;markDirty();writeErr(err)}
}
function book(a){
  if(!gsel||!(a>0))return;var g=DRAFT.goldTeams.find(function(x){return x.id===gsel});
  var e={id:uid("b"),g:gsel,a:Math.round(a*100)/100,ts:Date.now()};
  updateDoc(refs.gold,{log:arrayUnion(e),updated:new Date().toISOString()}).catch(writeErr);
  var c=document.getElementById("custom");if(c)c.value="";
  toast("Gebucht: "+gtName(g)+", "+eur(a));
}

app.addEventListener("click",function(e){
  var t=e.target.closest("[data-go],[data-filter],[data-atab],[data-act],[data-team]");if(!t)return;
  if(t.dataset.go){go(t.dataset.go);return}
  if(t.dataset.team){filter="team:"+t.dataset.team;go("plan");return}
  if(t.dataset.filter){filter=t.dataset.filter;saveResume();render(true);return}
  if(t.dataset.atab){atab=t.dataset.atab;saveResume();render(false);window.scrollTo(0,0);return}
  var a=t.dataset.act,id=t.dataset.id;
  if(a==="logout"){signOut(auth);DRAFT=null;go("home");return}
  if(a==="publish"){publish();return}
  if(a==="reset"){if(confirm("Alle unveröffentlichten Änderungen verwerfen?")){lsSet("bc-draft",null);DRAFT=clone(STATE);render(true)}return}
  if(a==="gsel"){gsel=gsel===id?"":id;saveResume();render(true);return}
  if(a==="book"){book(+t.dataset.a);return}
  if(a==="bookCustom"){var v=parseNum(document.getElementById("custom").value);if(!(v>0)){toast("Bitte einen Betrag über 0 € eingeben.");return}book(v);return}
  if(a==="undo"){var l=STATE.goldLog[STATE.goldLog.length-1];if(!l)return;var lg=STATE.goldTeams.find(function(x){return x.id===l.g});
    updateDoc(refs.gold,{log:arrayRemove(l),updated:new Date().toISOString()}).then(function(){toast("Rückgängig: "+(lg?gtName(lg):"Team")+", "+eur(l.a))}).catch(writeErr);return}
  if(a==="delBook"){if(!confirm("Diese Buchung löschen?"))return;var bk=STATE.goldLog.find(function(x){return x.id===id});if(bk)updateDoc(refs.gold,{log:arrayRemove(bk),updated:new Date().toISOString()}).then(function(){toast("Buchung gelöscht")}).catch(writeErr);return}
  if(a==="seed"){seed();return}
  if(a==="addTeam"){var g=groups();DRAFT.teams.push({id:uid("t"),name:"Neues Team",group:g[0]||"A"})}
  else if(a==="delTeam"){var tm=DRAFT.teams.find(function(x){return x.id===id});if(!confirm("„"+tm.name+"“ löschen? Spiele dieses Teams bleiben als offen stehen."))return;
    DRAFT.teams=DRAFT.teams.filter(function(x){return x.id!==id});DRAFT.matches.forEach(function(m){if(m.home===id)m.home="";if(m.away===id)m.away=""});
    DRAFT.goldTeams.forEach(function(g){if(g.teamId===id){g.teamId="";g.name=tm.name}})}
  else if(a==="delLogo"){var up={};up[id]=deleteField();updateDoc(refs.logos,up).then(function(){toast("Logo entfernt")}).catch(writeErr);return}
  else if(a==="addMatch"){var last=sortedMatches().slice(-1)[0];DRAFT.matches.push({id:uid("m"),day:last?mday(last):"",time:last?last.time:"09:00",pitch:"1",group:"",round:"",home:"",away:"",hn:"",an:"",hs:null,as:null})}
  else if(a==="delMatch"){if(!confirm("Dieses Spiel löschen?"))return;DRAFT.matches=DRAFT.matches.filter(function(m){return m.id!==id})}
  else if(a==="gen"){if(!confirm("Alle Gruppenspiele neu erzeugen? Eingetragene Ergebnisse der Gruppenspiele gehen verloren."))return;generate();toast("Gruppenspiele erzeugt")}
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
app.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.matches("img[data-go]")){e.preventDefault();go(e.target.dataset.go)}});

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
  else if(slowLoad)msg='Die Verbindung zur Datenbank dauert ungewöhnlich lange. Prüfe in Firebase, ob die Firestore-Datenbank angelegt ist und die Werte in config.js stimmen.';
  else{msg='Die Seite wird geladen …';btn=''}
  return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>40. Soester Börde-Cup</h1><p>'+msg+'</p>'+btn+'</div></main>'}
function vSetup(){return '<main><div class="login"><img src="'+LOGO+'" alt=""><h1>Ersteinrichtung</h1><p>Die Datenbank ist noch leer. Lege die Startdaten an: 16 Beispielteams, den Spielplan für beide Tage und eine Beispielkarte.</p><button class="btn red" style="width:100%" data-act="seed">Startdaten anlegen</button><p style="margin-top:14px"><button class="btn ghost sm" data-act="logout">Abmelden</button></p></div></main>'}
var SEED={"settings": {"date": "24. und 25. Oktober 2026", "place": "", "day": "2026-10-24", "dur": 17}, "teams": [{"id": "tA1", "name": "Team A1", "group": "A"}, {"id": "tA2", "name": "Team A2", "group": "A"}, {"id": "tA3", "name": "Team A3", "group": "A"}, {"id": "tA4", "name": "Team A4", "group": "A"}, {"id": "tB1", "name": "Team B1", "group": "B"}, {"id": "tB2", "name": "Team B2", "group": "B"}, {"id": "tB3", "name": "Team B3", "group": "B"}, {"id": "tB4", "name": "Team B4", "group": "B"}, {"id": "tC1", "name": "Team C1", "group": "C"}, {"id": "tC2", "name": "Team C2", "group": "C"}, {"id": "tC3", "name": "Team C3", "group": "C"}, {"id": "tC4", "name": "Team C4", "group": "C"}, {"id": "tD1", "name": "Team D1", "group": "D"}, {"id": "tD2", "name": "Team D2", "group": "D"}, {"id": "tD3", "name": "Team D3", "group": "D"}, {"id": "tD4", "name": "Team D4", "group": "D"}], "matches": [{"id": "m0", "day": "2026-10-24", "time": "09:00", "pitch": "1", "group": "A", "round": "", "home": "tA1", "away": "tA2", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m1", "day": "2026-10-24", "time": "09:20", "pitch": "1", "group": "B", "round": "", "home": "tB1", "away": "tB2", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m2", "day": "2026-10-24", "time": "09:40", "pitch": "1", "group": "C", "round": "", "home": "tC1", "away": "tC2", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m3", "day": "2026-10-24", "time": "10:00", "pitch": "1", "group": "D", "round": "", "home": "tD1", "away": "tD2", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m4", "day": "2026-10-24", "time": "10:20", "pitch": "1", "group": "A", "round": "", "home": "tA3", "away": "tA4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m5", "day": "2026-10-24", "time": "10:40", "pitch": "1", "group": "B", "round": "", "home": "tB3", "away": "tB4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m6", "day": "2026-10-24", "time": "11:00", "pitch": "1", "group": "C", "round": "", "home": "tC3", "away": "tC4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m7", "day": "2026-10-24", "time": "11:20", "pitch": "1", "group": "D", "round": "", "home": "tD3", "away": "tD4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m8", "day": "2026-10-24", "time": "11:40", "pitch": "1", "group": "A", "round": "", "home": "tA1", "away": "tA3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m9", "day": "2026-10-24", "time": "12:00", "pitch": "1", "group": "B", "round": "", "home": "tB1", "away": "tB3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m10", "day": "2026-10-24", "time": "12:20", "pitch": "1", "group": "C", "round": "", "home": "tC1", "away": "tC3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m11", "day": "2026-10-24", "time": "12:40", "pitch": "1", "group": "D", "round": "", "home": "tD1", "away": "tD3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m12", "day": "2026-10-24", "time": "13:00", "pitch": "1", "group": "A", "round": "", "home": "tA2", "away": "tA4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m13", "day": "2026-10-24", "time": "13:20", "pitch": "1", "group": "B", "round": "", "home": "tB2", "away": "tB4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m14", "day": "2026-10-24", "time": "13:40", "pitch": "1", "group": "C", "round": "", "home": "tC2", "away": "tC4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m15", "day": "2026-10-24", "time": "14:00", "pitch": "1", "group": "D", "round": "", "home": "tD2", "away": "tD4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m16", "day": "2026-10-24", "time": "14:20", "pitch": "1", "group": "A", "round": "", "home": "tA1", "away": "tA4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m17", "day": "2026-10-24", "time": "14:40", "pitch": "1", "group": "B", "round": "", "home": "tB1", "away": "tB4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m18", "day": "2026-10-24", "time": "15:00", "pitch": "1", "group": "C", "round": "", "home": "tC1", "away": "tC4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m19", "day": "2026-10-24", "time": "15:20", "pitch": "1", "group": "D", "round": "", "home": "tD1", "away": "tD4", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m20", "day": "2026-10-24", "time": "15:40", "pitch": "1", "group": "A", "round": "", "home": "tA2", "away": "tA3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m21", "day": "2026-10-24", "time": "16:00", "pitch": "1", "group": "B", "round": "", "home": "tB2", "away": "tB3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m22", "day": "2026-10-24", "time": "16:20", "pitch": "1", "group": "C", "round": "", "home": "tC2", "away": "tC3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m23", "day": "2026-10-24", "time": "16:40", "pitch": "1", "group": "D", "round": "", "home": "tD2", "away": "tD3", "hn": "", "an": "", "hs": null, "as": null}, {"id": "m24", "day": "2026-10-24", "time": "17:00", "pitch": "1", "group": "", "round": "Platzierung 9–16 (P1)", "home": "", "away": "", "hn": "3. Gruppe A", "an": "4. Gruppe B", "hs": null, "as": null}, {"id": "m25", "day": "2026-10-24", "time": "17:20", "pitch": "1", "group": "", "round": "Platzierung 9–16 (P2)", "home": "", "away": "", "hn": "3. Gruppe B", "an": "4. Gruppe A", "hs": null, "as": null}, {"id": "m26", "day": "2026-10-24", "time": "17:40", "pitch": "1", "group": "", "round": "Platzierung 9–16 (P3)", "home": "", "away": "", "hn": "3. Gruppe C", "an": "4. Gruppe D", "hs": null, "as": null}, {"id": "m27", "day": "2026-10-24", "time": "18:00", "pitch": "1", "group": "", "round": "Platzierung 9–16 (P4)", "home": "", "away": "", "hn": "3. Gruppe D", "an": "4. Gruppe C", "hs": null, "as": null}, {"id": "m28", "day": "2026-10-24", "time": "18:20", "pitch": "1", "group": "", "round": "Viertelfinale 1", "home": "", "away": "", "hn": "1. Gruppe A", "an": "2. Gruppe B", "hs": null, "as": null}, {"id": "m29", "day": "2026-10-24", "time": "18:40", "pitch": "1", "group": "", "round": "Viertelfinale 2", "home": "", "away": "", "hn": "1. Gruppe B", "an": "2. Gruppe A", "hs": null, "as": null}, {"id": "m30", "day": "2026-10-25", "time": "09:00", "pitch": "1", "group": "", "round": "Viertelfinale 3", "home": "", "away": "", "hn": "1. Gruppe C", "an": "2. Gruppe D", "hs": null, "as": null}, {"id": "m31", "day": "2026-10-25", "time": "09:20", "pitch": "1", "group": "", "round": "Viertelfinale 4", "home": "", "away": "", "hn": "1. Gruppe D", "an": "2. Gruppe C", "hs": null, "as": null}, {"id": "m32", "day": "2026-10-25", "time": "09:40", "pitch": "1", "group": "", "round": "Platz 13–16, Spiel 1", "home": "", "away": "", "hn": "Verlierer P1", "an": "Verlierer P2", "hs": null, "as": null}, {"id": "m33", "day": "2026-10-25", "time": "10:00", "pitch": "1", "group": "", "round": "Platz 13–16, Spiel 2", "home": "", "away": "", "hn": "Verlierer P3", "an": "Verlierer P4", "hs": null, "as": null}, {"id": "m34", "day": "2026-10-25", "time": "10:20", "pitch": "1", "group": "", "round": "Platz 9–12, Spiel 1", "home": "", "away": "", "hn": "Sieger P1", "an": "Sieger P2", "hs": null, "as": null}, {"id": "m35", "day": "2026-10-25", "time": "10:40", "pitch": "1", "group": "", "round": "Platz 9–12, Spiel 2", "home": "", "away": "", "hn": "Sieger P3", "an": "Sieger P4", "hs": null, "as": null}, {"id": "m36", "day": "2026-10-25", "time": "11:00", "pitch": "1", "group": "", "round": "Platz 5–8, Spiel 1", "home": "", "away": "", "hn": "Verlierer VF 1", "an": "Verlierer VF 2", "hs": null, "as": null}, {"id": "m37", "day": "2026-10-25", "time": "11:20", "pitch": "1", "group": "", "round": "Platz 5–8, Spiel 2", "home": "", "away": "", "hn": "Verlierer VF 3", "an": "Verlierer VF 4", "hs": null, "as": null}, {"id": "m38", "day": "2026-10-25", "time": "11:40", "pitch": "1", "group": "", "round": "Halbfinale 1", "home": "", "away": "", "hn": "Sieger VF 1", "an": "Sieger VF 2", "hs": null, "as": null}, {"id": "m39", "day": "2026-10-25", "time": "12:00", "pitch": "1", "group": "", "round": "Halbfinale 2", "home": "", "away": "", "hn": "Sieger VF 3", "an": "Sieger VF 4", "hs": null, "as": null}, {"id": "m40", "day": "2026-10-25", "time": "12:20", "pitch": "1", "group": "", "round": "Spiel um Platz 15", "home": "", "away": "", "hn": "Verlierer 13–16/1", "an": "Verlierer 13–16/2", "hs": null, "as": null}, {"id": "m41", "day": "2026-10-25", "time": "12:40", "pitch": "1", "group": "", "round": "Spiel um Platz 13", "home": "", "away": "", "hn": "Sieger 13–16/1", "an": "Sieger 13–16/2", "hs": null, "as": null}, {"id": "m42", "day": "2026-10-25", "time": "13:00", "pitch": "1", "group": "", "round": "Spiel um Platz 11", "home": "", "away": "", "hn": "Verlierer 9–12/1", "an": "Verlierer 9–12/2", "hs": null, "as": null}, {"id": "m43", "day": "2026-10-25", "time": "13:20", "pitch": "1", "group": "", "round": "Spiel um Platz 9", "home": "", "away": "", "hn": "Sieger 9–12/1", "an": "Sieger 9–12/2", "hs": null, "as": null}, {"id": "m44", "day": "2026-10-25", "time": "13:40", "pitch": "1", "group": "", "round": "Spiel um Platz 7", "home": "", "away": "", "hn": "Verlierer 5–8/1", "an": "Verlierer 5–8/2", "hs": null, "as": null}, {"id": "m45", "day": "2026-10-25", "time": "14:00", "pitch": "1", "group": "", "round": "Spiel um Platz 5", "home": "", "away": "", "hn": "Sieger 5–8/1", "an": "Sieger 5–8/2", "hs": null, "as": null}, {"id": "m46", "day": "2026-10-25", "time": "14:20", "pitch": "1", "group": "", "round": "Spiel um Platz 3", "home": "", "away": "", "hn": "Verlierer HF 1", "an": "Verlierer HF 2", "hs": null, "as": null}, {"id": "m47", "day": "2026-10-25", "time": "14:40", "pitch": "1", "group": "", "round": "Finale", "home": "", "away": "", "hn": "Sieger HF 1", "an": "Sieger HF 2", "hs": null, "as": null}], "menu": [{"id": "c1", "name": "Getränke", "items": [{"id": "i1", "name": "Bier 0,3 l", "price": 2.5, "note": "", "out": false}, {"id": "i2", "name": "Radler 0,3 l", "price": 2.5, "note": "", "out": false}, {"id": "i3", "name": "Softdrinks 0,3 l", "price": 2.0, "note": "Cola, Fanta, Sprite", "out": false}, {"id": "i4", "name": "Wasser 0,5 l", "price": 1.5, "note": "", "out": false}, {"id": "i5", "name": "Kaffee", "price": 1.5, "note": "", "out": false}]}, {"id": "c2", "name": "Essen", "items": [{"id": "i6", "name": "Bratwurst im Brötchen", "price": 3.5, "note": "", "out": false}, {"id": "i7", "name": "Pommes", "price": 3.0, "note": "Mayo oder Ketchup", "out": false}, {"id": "i8", "name": "Kuchen", "price": 2.0, "note": "selbst gebacken", "out": false}]}], "goldTeams": [{"id": "gtA1", "teamId": "tA1", "name": ""}, {"id": "gtA2", "teamId": "tA2", "name": ""}, {"id": "gtA3", "teamId": "tA3", "name": ""}, {"id": "gtA4", "teamId": "tA4", "name": ""}, {"id": "gtB1", "teamId": "tB1", "name": ""}, {"id": "gtB2", "teamId": "tB2", "name": ""}, {"id": "gtB3", "teamId": "tB3", "name": ""}, {"id": "gtB4", "teamId": "tB4", "name": ""}, {"id": "gtC1", "teamId": "tC1", "name": ""}, {"id": "gtC2", "teamId": "tC2", "name": ""}, {"id": "gtC3", "teamId": "tC3", "name": ""}, {"id": "gtC4", "teamId": "tC4", "name": ""}, {"id": "gtD1", "teamId": "tD1", "name": ""}, {"id": "gtD2", "teamId": "tD2", "name": ""}, {"id": "gtD3", "teamId": "tD3", "name": ""}, {"id": "gtD4", "teamId": "tD4", "name": ""}]};
async function seed(){
  if(STATE||!mainLoaded)return;
  try{await setDoc(refs.main,Object.assign(clone(SEED),{updated:new Date().toISOString()}));
    await setDoc(refs.gold,{log:[],updated:""});await setDoc(refs.logos,{});toast("Startdaten angelegt")}
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
  refs={main:doc(db,"boerdecup","main"),gold:doc(db,"boerdecup","gold"),logos:doc(db,"boerdecup","logos")};
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
if(res&&Date.now()-res.t<90e3){route=res.route||"home";atab=res.atab||atab;gsel=res.gsel||"";filter=res.filter||"Alle"}
if(location.hash==="#orga")route="admin";
if(route==="admin"){done0()}else welcome(done0);
function done0(){render(false)}
startFirebase();


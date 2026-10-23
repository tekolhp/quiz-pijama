// ======================= REALTIME QUIZ (host + teams) =======================
// Transport: WebRTC via PeerJS. The host device is the server; phones connect straight to it.
// No database, no backend of ours — only PeerJS's public signaling server to find each other.
const PEER_PREFIX = "festa-pijama-";
// Original pajama crew: each joining device becomes one of these (name + color)
const CREW = [
  { name:"Polvinho",       color:"#8e5ad6", sprite:"octo" },
  { name:"Baiacu",         color:"#ffd04a", sprite:"puffer" },
  { name:"Cavalinho",      color:"#58d68d", sprite:"horse" },
  { name:"Gelatina",       color:"#ff8ad4", sprite:"jelly" },
  { name:"Seu Caranguejo", color:"#ff6f61", sprite:"crab" },
  { name:"Fantasminha",    color:"#cfd8ff", sprite:"ghost" },
  { name:"Tartaruguinha",  color:"#4fb3ff", sprite:"horse" },
  { name:"Camarão",        color:"#ffa54f", sprite:"crab" },
  { name:"Ostra",          color:"#b8f0e0", sprite:"jelly" },
  { name:"Lula Roxa",      color:"#c77dff", sprite:"octo" },
  { name:"Peixe-Palhaço",  color:"#ff8c42", sprite:"puffer" },
  { name:"Estrelinha",     color:"#ffe08a", sprite:"jelly" },
];

const $ = s => document.querySelector(s);
const shuffle = a => { for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const LETTERS = ["A","B","C","D"];
const SCREENS = ["home","hostLobby","hostGame","hostEnd","playerJoin","playerWait","playerGame","playerEnd"];
function show(id){ SCREENS.forEach(s=>$("#"+s).hidden = s!==id); window.scrollTo({top:0}); }
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function roomCode(){ const C="ABCDEFGHJKLMNPQRSTUVWXYZ"; let s=""; for(let i=0;i<4;i++) s+=C[Math.floor(Math.random()*C.length)]; return s; }
function store(k,v){ try{ v===undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function msg(sel,t){ const m=$(sel); m.textContent=t; m.hidden=!t; }
function teamChip(t, extra){ const c=el("span","chip"+(extra||"")); c.style.setProperty("--team", t.color); c.append(el("i","dot"), el("span",null,t.name)); return c; }

let peer = null;            // this device's Peer
let conns = {};             // host: peerId -> DataConnection
let hostConn = null;        // player: connection to the host
let handlers = {};
function dispatch(ev, payload){ if(handlers[ev]) handlers[ev](payload); }
function newPeer(id){
  if(peer){ try{ peer.destroy(); }catch(e){} }
  peer = id ? new Peer(id, { debug:1 }) : new Peer({ debug:1 });
  return new Promise((res,rej)=>{ peer.on("open", ()=>res(peer)); peer.on("error", e=>rej(e)); });
}
// host side
async function openHost(code, h){
  handlers=h; conns={};
  await newPeer(PEER_PREFIX+code);
  peer.on("connection", c=>{
    c.on("open", ()=>{ conns[c.peer]=c; });
    c.on("data", d=>{ if(d && d.ev) dispatch(d.ev, d.payload); });
    c.on("close", ()=>{ delete conns[c.peer]; });
    c.on("error", ()=>{ delete conns[c.peer]; });
  });
  peer.on("error", e=>{ if(e.type==="unavailable-id") msg("#lobbyMsg","Esse código já está em uso. Cria a sala de novo."); });
}
// player side
async function openPlayer(code, h){
  handlers=h;
  await newPeer(null);
  return new Promise((res,rej)=>{
    const c = peer.connect(PEER_PREFIX+code, { reliable:true });
    const t = setTimeout(()=>rej(new Error("timeout")), 12000);
    c.on("open", ()=>{ clearTimeout(t); hostConn=c; res(); });
    c.on("data", d=>{ if(d && d.ev) dispatch(d.ev, d.payload); });
    c.on("close", ()=>{ hostConn=null; reconnectLoop(code); });
    peer.on("error", e=>{ clearTimeout(t); rej(e); });
  });
}
let reconnecting=false;
async function reconnectLoop(code){
  if(reconnecting || !player.code) return; reconnecting=true;
  $("#waitTitle").textContent="Reconectando…"; $("#waitText").textContent="O host recarregou ou a rede oscilou. Segura aí."; show("playerWait");
  const until=Date.now()+90e3;
  while(Date.now()<until && player.code){
    try{ await openPlayer(code, handlers); send("join",{ id:player.id }); reconnecting=false; return; }catch(e){}
    await new Promise(r=>setTimeout(r,3000));
  }
  reconnecting=false;
  $("#waitTitle").textContent="Não deu pra reconectar"; $("#waitText").textContent="Pede pro host retomar a sala e toca em Sair pra entrar de novo.";
}
function send(ev, payload){
  const m={ev,payload};
  if(hostConn){ try{ hostConn.send(m); }catch(e){} }
  else Object.values(conns).forEach(c=>{ try{ c.send(m); }catch(e){} });
}
const params = new URLSearchParams(location.search);

// ======================= CUSTOM QUESTIONS (made by the host, saved on this device) =======================
const CUSTOM_THEME = "Perguntas da família";
const CUSTOM_KEY = "quiz.custom";
function loadCustom(){ const c=load(CUSTOM_KEY); return Array.isArray(c)?c:[]; }
function syncCustom(){ const c=loadCustom(); if(c.length) BANK[CUSTOM_THEME]=c; else delete BANK[CUSTOM_THEME]; }
function renderCustom(){
  const box=$("#customList"); box.innerHTML="";
  const c=loadCustom();
  c.forEach((q,i)=>{
    const row=el("div","arow"); row.style.setProperty("--team","var(--accent)");
    row.append(el("span","ans", q[0]+" → "+q[1]));
    const rm=el("button","btn ghost","✕"); rm.type="button"; rm.setAttribute("aria-label","Remover pergunta");
    rm.addEventListener("click", ()=>{ const c=loadCustom(); c.splice(i,1); store(CUSTOM_KEY,c); syncCustom(); renderCustom(); renderThemes(); });
    row.append(rm); box.append(row);
  });
  $("#customCount").textContent = c.length ? c.length+" pergunta(s)" : "";
}
$("#addCustom").addEventListener("click", ()=>{
  const q=$("#customQ").value.trim(), a=$("#customA").value.trim();
  if(!q||!a) return;
  const c=loadCustom(); c.push([q,a]); store(CUSTOM_KEY,c); syncCustom();
  $("#customQ").value=""; $("#customA").value=""; $("#customQ").focus();
  if(!host.themes.includes(CUSTOM_THEME)) host.themes.push(CUSTOM_THEME);
  renderCustom(); renderThemes(); saveHost();
});
syncCustom();

// ======================= HOST =======================
const host = { code:null, teams:{}, themes:[], count:15, secs:30, deck:[], idx:0, answers:{}, timer:null, left:0, phase:"lobby" };
const playing = () => Object.entries(host.teams).filter(([,t])=>t.ok);

const HOST_KEY="quiz.host";
function saveHost(){ try{ store(HOST_KEY,{ code:host.code, teams:host.teams, themes:host.themes, count:host.count, secs:host.secs, deck:host.deck, idx:host.idx, answers:host.answers, marks:host.marks, phase:host.phase, savedAt:Date.now() }); }catch(e){} }
function clearHost(){ store(HOST_KEY, undefined); }
const savedHost = load(HOST_KEY);
if(savedHost && savedHost.code && Date.now()-savedHost.savedAt < 6*3600e3){
  const b=$("#btnResume"); b.hidden=false; b.textContent="Retomar sala "+savedHost.code;
}
$("#btnResume").addEventListener("click", ()=>startHost(savedHost));
$("#btnHost").addEventListener("click", ()=>startHost(null));
async function startHost(saved){
  if(saved){ Object.assign(host, { code:saved.code, teams:saved.teams||{}, themes:saved.themes||[], count:saved.count||15, secs:saved.secs||30, deck:saved.deck||[], idx:saved.idx||0, answers:saved.answers||{}, marks:saved.marks||{}, phase:saved.phase||"lobby" }); if(host.phase==="question") host.phase="ready"; }
  else host.code = roomCode();
  $("#btnHost").disabled=true; $("#btnHost").textContent="Abrindo sala…";
  try{ await openHost(host.code, {
    join: p => {
      if(!p.id) return;
      if(!host.teams[p.id]){
        const used = new Set(Object.values(host.teams).map(t=>t.name));
        const c = CREW.find(c=>!used.has(c.name)) || CREW[Object.keys(host.teams).length % CREW.length];
        host.teams[p.id] = { name:c.name, color:c.color, sprite:c.sprite, ok:false, score:0 };
        makeSay(pick(actors), c.name+" chegou!", 120);
      }
      broadcastTeams(); if(host.phase!=="lobby") sendCurrentState();
    },
    answer: p => {
      if(host.phase!=="question" || p.idx!==host.idx || !host.teams[p.id]?.ok) return;
      const first = host.answers[p.id]==null;
      host.answers[p.id] = String(p.text||"").slice(0,80);
      renderHostAnswers(); saveHost();
      if(first) makeSay(pick(actors), host.teams[p.id].name+" respondeu!", 100);
    },
  });
  }catch(e){ $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)"; return msg("#homeMsg","Não consegui abrir a sala. Confere a internet e tenta de novo."); }
  $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)";
  $("#roomCode").textContent = host.code;
  $("#joinUrl").textContent = location.origin + location.pathname + "?sala=" + host.code;
  renderThemes(); renderTeamList(); renderCustom();
  $("#count").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", +x.dataset.n===host.count));
  $("#timer").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", +x.dataset.t===host.secs));
  if(saved && host.deck.length && host.phase!=="lobby"){
    if(host.phase==="end") hostEnd();
    else if(host.phase==="reveal"){ show("hostGame"); loadQuestionView(); host.phase="reveal"; revealView(); }
    else { show("hostGame"); loadQuestion(); }
  } else show("hostLobby");
  saveHost();
}
function broadcastTeams(){ send("teams", { teams: host.teams }); renderTeamList(); saveHost(); }
function renderTeamList(){
  const box=$("#teamList"); box.innerHTML="";
  const ids=Object.keys(host.teams);
  if(!ids.length){ box.append(el("p","lead","Nenhum celular ainda. Manda o código ou o link pro pessoal.")); }
  ids.forEach(id=>{
    const t=host.teams[id]; const lab=el("label","theme team"); lab.style.setProperty("--team", t.color);
    const cb=el("input"); cb.type="checkbox"; cb.id="ok-"+id; cb.checked=t.ok;
    cb.addEventListener("change", ()=>{ t.ok=cb.checked; broadcastTeams(); });
    lab.append(cb, el("i","dot"), document.createTextNode(t.name)); box.append(lab);
  });
  $("#btnStart").disabled = !playing().length;
  $("#confirmedCount").textContent = playing().length+" confirmada(s) de "+ids.length;
}
function renderThemes(){
  const box = $("#themes"); box.innerHTML="";
  Object.keys(BANK).forEach((t,i)=>{
    const lab = el("label","theme");
    const cb = el("input"); cb.type="checkbox"; cb.id="theme-"+i; cb.value=t; cb.checked = host.themes.includes(t);
    cb.addEventListener("change", ()=>{ host.themes = [...box.querySelectorAll("input:checked")].map(x=>x.value); saveHost(); });
    lab.append(cb, document.createTextNode(t)); box.append(lab);
  });
}
$("#mixAll").addEventListener("click", ()=>{ const all=Object.keys(BANK); host.themes = host.themes.length===all.length ? [] : all.slice(); renderThemes(); });
$("#count").addEventListener("click", e=>{ const b=e.target.closest("button[data-n]"); if(!b) return; host.count=+b.dataset.n; saveHost(); $("#count").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); });
$("#timer").addEventListener("click", e=>{ const b=e.target.closest("button[data-t]"); if(!b) return; host.secs=+b.dataset.t; saveHost(); $("#timer").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); });
$("#copyUrl").addEventListener("click", async ()=>{
  const t=$("#joinUrl").textContent;
  try{ await navigator.clipboard.writeText(t); $("#copyUrl").textContent="Copiado!"; }catch(e){ const r=document.createRange(); r.selectNodeContents($("#joinUrl")); getSelection().removeAllRanges(); getSelection().addRange(r); }
  setTimeout(()=>$("#copyUrl").textContent="Copiar link",1500);
});

$("#btnStart").addEventListener("click", ()=>{
  if(!host.themes.length) return msg("#lobbyMsg","Escolhe pelo menos um tema (ou mistura tudo).");
  if(!playing().length) return msg("#lobbyMsg","Confirma pelo menos uma equipe.");
  msg("#lobbyMsg","");
  const pool=[]; host.themes.forEach(t=>BANK[t].forEach(q=>pool.push({theme:t,q}))); shuffle(pool);
  host.deck=[]; while(host.deck.length<host.count) host.deck.push(...pool); host.deck=host.deck.slice(0,host.count);
  Object.values(host.teams).forEach(t=>t.score=0);
  host.idx=0; show("hostGame"); loadQuestion();
});

function loadQuestion(){
  host.marks={}; host.answers={}; host.phase="ready"; stopTimer(); host.left=host.secs;
  loadQuestionView();
  send("ready", { idx:host.idx, total:host.deck.length, scores:scoreList() });
  saveHost();
}
function loadQuestionView(){
  const item=host.deck[host.idx]; const [text,correct]=item.q; item.correct=correct;
  $("#hqNum").textContent = `Pergunta ${host.idx+1} de ${host.deck.length} · só você vê. Dá play quando quiser.`;
  $("#hqTheme").textContent=item.theme; $("#hqText").textContent=text;
  $("#hCorrect").textContent = correct;
  $("#hClock").textContent=host.secs+"s"; $("#hClock").classList.remove("warn"); $("#htbar").style.width="100%"; $("#htbar").classList.remove("warn");
  $("#btnPlay").hidden=false; $("#btnReveal").hidden=true; $("#btnNext").hidden=true; $("#hFeedback").hidden=true;
  renderHostAnswers();
}
function questionPayload(){ const it=host.deck[host.idx]; return { idx:host.idx, total:host.deck.length, theme:it.theme, text:it.q[0], secs:host.secs, left:host.left, teams:host.teams }; }
const norm = t => String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function lev(a,b){ const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let prev=Array.from({length:n+1},(_,j)=>j); for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++){ cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1)); } prev=cur; } return prev[n]; }
function close(a,c){ if(a===c) return true; const tol = c.length<=4 ? 0 : c.length<=7 ? 1 : 2; return lev(a,c)<=tol; }
// Accepts: exact match, small typos (Madrid/Madri, Himalaya), the answer contained in a longer reply ("é Madri"),
// every significant word of the reply appearing in the answer ("Deodoro" for "Deodoro da Fonseca"), and listed alternatives.
function autoOk(answer, correct, alts){
  const a=norm(answer); if(!a) return false;
  const targets=[correct, ...(alts||[])].map(norm).filter(Boolean);
  for(const c of targets){
    if(close(a,c)) return true;
    if(c.length>=4 && a.includes(c)) return true;
    const aw=a.split(" ").filter(w=>w.length>2), cw=c.split(" ").filter(w=>w.length>2);
    if(cw.length && aw.length && aw.every(w=>cw.some(x=>close(w,x)))) return true;
  }
  return false;
}
function sendCurrentState(){
  if(host.phase==="ready") send("ready",{ idx:host.idx, total:host.deck.length, scores:scoreList() });
  else if(host.phase==="question") send("question", questionPayload());
  else if(host.phase==="reveal") send("reveal", revealPayload());
  else if(host.phase==="end") send("end", { scores: scoreList() });
}
$("#btnPlay").addEventListener("click", ()=>{
  host.phase="question"; host.left=host.secs; $("#btnPlay").hidden=true; $("#btnReveal").hidden=false;
  $("#hqNum").textContent = `Pergunta ${host.idx+1} de ${host.deck.length} · valendo!`;
  send("question", questionPayload());
  host.timer=setInterval(tick,1000);
  makeSay(pick(actors), "VALENDO!", 90);
});
function stopTimer(){ if(host.timer){ clearInterval(host.timer); host.timer=null; } }
function tick(){
  host.left=Math.max(0,host.left-1);
  const warn=host.left<=5;
  $("#hClock").textContent=host.left+"s"; $("#hClock").classList.toggle("warn",warn);
  $("#htbar").style.width=(host.left/host.secs*100)+"%"; $("#htbar").classList.toggle("warn",warn);
  send("tick",{ left:host.left, idx:host.idx });
  if(host.left<=0){ $("#hClock").textContent="TEMPO!"; actors.forEach(a=>{a.state="jump";a.t=0;}); makeSay(pick(actors),"ACABOU O TEMPO!",150); reveal(); }
}
function renderHostAnswers(){
  const box=$("#hAnswers"); box.innerHTML="";
  const revealing = host.phase==="reveal";
  playing().forEach(([id,t])=>{
    const row=el(revealing?"button":"div","arow"+(revealing?" btn":"")+(revealing && host.marks[id]?" hit":"")); row.style.setProperty("--team",t.color);
    if(revealing){ row.type="button"; row.addEventListener("click", ()=>{ host.marks[id]=!host.marks[id]; renderHostAnswers(); saveHost(); }); }
    const a=host.answers[id];
    row.append(el("i","dot"), el("b",null,t.name), el("span","ans", a==null ? (revealing?"— não respondeu":"… pensando") : a), el("em",null,t.score+(revealing?(host.marks[id]?" +1":""):"")));
    box.append(row);
  });
  $("#hAnswersLabel").textContent = revealing ? "Toca pra corrigir quem acertou" : `Respostas (${Object.keys(host.answers).length}/${playing().length})`;
}
function revealPayload(){
  const it=host.deck[host.idx]; const results={};
  playing().forEach(([id])=>{ results[id]={ answer:host.answers[id]??null, ok:!!host.marks[id] }; });
  return { idx:host.idx, correct:it.correct, results, scores:scoreList() };
}
function scoreList(){ return playing().map(([id,t])=>({id,team:t.name,color:t.color,score:t.score})).sort((a,b)=>b.score-a.score); }
function reveal(){
  if(host.phase!=="question") return;
  stopTimer(); host.phase="reveal";
  const it=host.deck[host.idx];
  playing().forEach(([id])=>{ host.marks[id]=autoOk(host.answers[id], it.correct, it.q.slice(2)); });
  host.marks = {...host.marks};
  const anyOk=Object.values(host.marks).some(Boolean);
  revealView(); sceneReact(anyOk);
  send("reveal", revealPayload()); saveHost();
}
function revealView(){
  const f=$("#hFeedback"); f.hidden=false; f.className="feedback ok"; f.textContent="Tempo encerrado. Confere as respostas e vai pra próxima.";
  $("#btnPlay").hidden=true; $("#btnReveal").hidden=true; $("#btnNext").hidden=false;
  $("#btnNext").textContent = host.idx+1>=host.deck.length ? "Fechar e ver resultado" : "Pontuar e ir pra próxima";
  $("#hClock").textContent="TEMPO!"; $("#htbar").style.width="0%";
  renderHostAnswers();
}
$("#btnReveal").addEventListener("click", ()=>{ host.left=0; tick(); });
$("#btnNext").addEventListener("click", ()=>{
  playing().forEach(([id,t])=>{ if(host.marks[id]) t.score++; });
  send("reveal", revealPayload()); saveHost();
  host.idx++; if(host.idx>=host.deck.length) return hostEnd(); loadQuestion();
});
function hostEnd(){
  host.phase="end"; const list=scoreList();
  renderRank($("#hRank"), list); $("#hWinner").textContent=winnerText(list);
  show("hostEnd"); sceneReact(true); send("end",{ scores:list }); saveHost();
}
function winnerText(list){ if(!list.length) return "Ninguém jogou"; const top=list[0].score; const w=list.filter(x=>x.score===top).map(x=>x.team); return w.length>1 ? "Empate: "+w.join(" e ") : w[0]+" venceu!"; }
function renderRank(ol, list){
  ol.innerHTML="";
  list.forEach((x,i)=>{ const li=el("li"); li.style.setProperty("--team",x.color); li.append(el("span","pos",(i+1)+"º"), el("i","dot"), el("span",null,x.team), el("span","pts",x.score+" pts")); ol.append(li); });
}
$("#btnAgain").addEventListener("click", ()=>{ host.phase="lobby"; host.deck=[]; saveHost(); send("lobby",{}); renderThemes(); renderTeamList(); show("hostLobby"); });
$("#btnBackLobby").addEventListener("click", ()=>{ stopTimer(); host.phase="lobby"; host.deck=[]; saveHost(); send("lobby",{}); renderTeamList(); show("hostLobby"); });

// ======================= PLAYER =======================
const player = { id: load("quiz.pid") || Math.random().toString(36).slice(2,10), code:null, me:null, idx:-1, sent:null, open:false, secs:30, shownIdx:-1 };
store("quiz.pid", player.id);

$("#btnJoin").addEventListener("click", ()=>{ $("#inCode").value=(params.get("sala")||"").toUpperCase(); show("playerJoin"); $("#inCode").focus(); });
if(params.get("sala")){ $("#inCode").value=params.get("sala").toUpperCase(); show("playerJoin"); }

$("#btnEnter").addEventListener("click", async ()=>{
  const code=$("#inCode").value.trim().toUpperCase();
  if(code.length!==4) return msg("#joinMsg","Código tem 4 letras.");
  msg("#joinMsg",""); player.code=code; $("#pRoom").textContent=code;
  $("#btnEnter").disabled=true; $("#btnEnter").textContent="Conectando…";
  try{ await openPlayer(code, {
    teams: p => applyTeams(p.teams),
    ready: p => { if(!player.me?.ok) return; player.idx=p.idx; player.sent=null; player.open=false; $("#pAnswer").value=""; $("#pSent").textContent=""; $("#waitTitle").textContent=`Pergunta ${p.idx+1} de ${p.total}`; $("#waitText").textContent="Esperando o host dar play…"; renderPlayerScores(p.scores); show("playerWait"); },
    question: p => { if(p.teams) applyTeams(p.teams); if(player.me?.ok) playerQuestion(p); },
    tick: p => { if(p.idx!==player.idx) return; setPlayerClock(p.left, true); },
    reveal: p => playerReveal(p),
    end: p => { renderRank($("#pRank"), p.scores); $("#pWinner").textContent=winnerText(p.scores); show("playerEnd"); sceneReact(true); },
    lobby: () => { player.idx=-1; waitLobby(); },
  }); }catch(e){ $("#btnEnter").disabled=false; $("#btnEnter").textContent="Entrar"; return msg("#joinMsg","Não achei essa sala. Confere o código e se o host já criou a sala."); }
  $("#btnEnter").disabled=false; $("#btnEnter").textContent="Entrar";
  send("join",{ id:player.id });
  $("#waitTitle").textContent="Entrando…"; $("#waitText").textContent="Esperando o host te ver.";
  show("playerWait");
});
function applyTeams(teams){
  const me = teams?.[player.id]; const was = player.me;
  player.me = me || null;
  if(me){
    document.documentElement.style.setProperty("--team", me.color);
    document.body.classList.add("teamed");
    $("#pTeamName").textContent=me.name; $("#pTeamName").hidden=false;
    if(!was || was.name!==me.name) makeSay(actors.find(a=>a.name===me.sprite)||pick(actors), "vocês são "+me.name+"!", 180);
    if(!was?.ok && me.ok){ sceneReact(true); }
  }
  if(player.idx<0) waitLobby();
  const box=$("#pTeams"); box.innerHTML="";
  Object.entries(teams||{}).forEach(([id,t])=>{ box.append(teamChip(t, (id===player.id?" active":"")+(t.ok?" hit":""))); });
}
function waitLobby(){
  if(!player.me){ $("#waitTitle").textContent="Entrando…"; $("#waitText").textContent="Esperando o host te ver."; }
  else if(!player.me.ok){ $("#waitTitle").textContent="Vocês são "+player.me.name; $("#waitText").textContent="Esperando o host confirmar a equipe."; }
  else { $("#waitTitle").textContent="Equipe "+player.me.name+" confirmada!"; $("#waitText").textContent="Esperando o host começar."; }
  show("playerWait");
}
function renderPlayerScores(list){
  const box=$("#pScores"); box.innerHTML="";
  (list||[]).forEach(x=>{ const c=teamChip({name:x.team,color:x.color}, x.id===player.id?" active":""); c.append(el("em",null,x.score)); box.append(c); });
}
function setPlayerClock(left, running){
  const c=$("#pClock"); const warn=left<=5 && running;
  c.textContent = running ? (left<=0?"TEMPO!":left+"s") : "";
  c.classList.toggle("warn",warn);
  $("#ptbar").style.width = (running? left/Math.max(1,player.secs)*100 : 100)+"%"; $("#ptbar").classList.toggle("warn",warn);
}
function playerQuestion(p){
  const fresh = p.idx!==player.shownIdx;
  player.idx=p.idx; player.shownIdx=p.idx; player.secs=p.secs; player.open=true;
  if(fresh){ player.sent=null; $("#pAnswer").value=""; }
  $("#pqNum").textContent=`Pergunta ${p.idx+1} de ${p.total}`; $("#pqTheme").textContent=p.theme; $("#pqText").textContent=p.text;
  $("#pFeedback").hidden=true; $("#pAnswer").disabled=false; $("#btnSend").disabled=false;
  $("#pSent").textContent = player.sent ? "Enviado: "+player.sent : "";
  setPlayerClock(p.left, true);
  show("playerGame");
  if(fresh){ makeSay(pick(actors), pick(["combina aí!","pensa bem...","eu sei essa!"]), 120); setTimeout(()=>$("#pAnswer").focus(),50); }
}
function sendAnswer(){
  if(!player.open) return;
  const t=$("#pAnswer").value.trim(); if(!t) return;
  player.sent=t; send("answer",{ id:player.id, idx:player.idx, text:t });
  $("#pSent").textContent="Enviado: "+t+" · pode mudar até acabar o tempo";
  makeSay(pick(actors), pick(["enviou!","boa escolha? veremos","tá valendo"]), 120);
}
$("#btnSend").addEventListener("click", sendAnswer);
$("#pAnswer").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); sendAnswer(); } });
function playerReveal(p){
  if(p.idx!==player.idx || !player.me?.ok) return;
  if($("#playerGame").hidden) return;
  const wasOpen = player.open; player.open=false;
  $("#pAnswer").disabled=true; $("#btnSend").disabled=true;
  const me=p.results[player.id]; const f=$("#pFeedback"); f.hidden=false;
  if(me && me.ok){ f.className="feedback ok"; f.textContent="Acertou! +1 ponto · resposta: "+p.correct; if(wasOpen) sceneReact(true); }
  else { f.className="feedback no"; f.textContent = (me && me.answer==null ? "Não respondeu a tempo. " : "Não valeu. ")+"Resposta: "+p.correct; if(wasOpen) sceneReact(false); }
  setPlayerClock(0,false); $("#pClock").textContent="tempo encerrado";
  renderPlayerScores(p.scores);
}
$("#btnLeave").addEventListener("click", ()=>{ if(hostConn){ try{hostConn.close();}catch(e){} hostConn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; } document.body.classList.remove("teamed"); $("#pTeamName").hidden=true; player.me=null; player.idx=-1; player.code=null; show("home"); });

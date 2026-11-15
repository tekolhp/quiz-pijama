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
  { name:"Guaxinauta",     color:"#9fb4d9", sprite:"racc" },
  { name:"Camarão",        color:"#ffa54f", sprite:"crab" },
  { name:"Ostra",          color:"#b8f0e0", sprite:"jelly" },
  { name:"Lula Roxa",      color:"#c77dff", sprite:"octo" },
  { name:"Peixe-Palhaço",  color:"#ff8c42", sprite:"puffer" },
  { name:"Estrelinha",     color:"#7fe0c8", sprite:"star" },
];

const $ = s => document.querySelector(s);
const shuffle = a => { for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const LETTERS = ["A","B","C","D"];
const SCREENS = ["home","hostLobby","hostGame","hostRev","hostEnd","playerJoin","playerWait","playerGame","playerRev","playerEnd"];
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
function dispatch(ev, payload, conn){ if(handlers[ev]) handlers[ev](payload, conn); }
const PEER_OPTS = { debug:1, pingInterval:3000 };
function newPeer(id){
  if(peer){ try{ peer.destroy(); }catch(e){} }
  peer = id ? new Peer(id, PEER_OPTS) : new Peer(PEER_OPTS);
  return new Promise((res,rej)=>{ peer.on("open", ()=>res(peer)); peer.on("error", e=>rej(e)); });
}
// Keep this device registered on the signaling server: if the socket drops (background tab, wifi blink), reconnect.
function keepRegistered(){
  if(!peer) return;
  peer.on("disconnected", ()=>{ if(peer && !peer.destroyed){ setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} }, 500); } });
}
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && peer && peer.disconnected && !peer.destroyed){ try{ peer.reconnect(); }catch(e){} } });
async function withRetry(fn, tries, delayMs){ let err; for(let i=0;i<tries;i++){ try{ return await fn(); }catch(e){ err=e; await new Promise(r=>setTimeout(r,delayMs)); } } throw err; }
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && host.timer) tick(); });
// host side
async function openHost(code, h){
  handlers=h; conns={};
  await withRetry(()=>newPeer(PEER_PREFIX+code), 4, 2500);   // a stale id from a reload clears within seconds
  keepRegistered();
  peer.on("connection", c=>{
    c.on("open", ()=>{ conns[c.peer]=c; c._seen=Date.now(); });
    c.on("data", d=>{ c._seen=Date.now(); if(d && d.ev==="hb") c._hb=true; if(d && d.ev && d.ev!=="hb") dispatch(d.ev, d.payload, c); });
    c.on("close", ()=>{ delete conns[c.peer]; });
    c.on("error", ()=>{ delete conns[c.peer]; });
  });
  peer.on("error", e=>{ if(e.type==="unavailable-id") msg("#lobbyMsg","Esse código já está em uso. Cria a sala de novo."); });
  $("#hostStatus").textContent="Sala online";
  peer.on("disconnected", ()=>{ $("#hostStatus").textContent="Reconectando a sala…"; });

  peer.on("open", ()=>{ $("#hostStatus").textContent="Sala online"; });
}
function startHostWatch(){
  // The game itself runs phone-to-tablet, so a dropped signaling socket goes unnoticed until a new phone
  // can't find the room. Check every 4s and re-register; if the id was lost, recreate the peer with it.
  if(window._hostWatch) return; window._hostWatch=setInterval(async ()=>{
    if(!host.code || hostConn) return;
    if(peer && peer.disconnected && !peer.destroyed){ try{ peer.reconnect(); }catch(e){} return; }
    if((!peer || peer.destroyed || !peer.open) && !window._hostReopen){ window._hostReopen=true; try{ await openHost(host.code, handlers); }catch(e){} window._hostReopen=false; }
  }, 4000);
}
// player side
async function openPlayer(code, h){
  handlers=h;
  await withRetry(()=>newPeer(null), 3, 1500);
  keepRegistered();
  return withRetry(()=>new Promise((res,rej)=>{
    const c = peer.connect(PEER_PREFIX+code, { reliable:true });
    const t = setTimeout(()=>rej(new Error("timeout")), 8000);
    c.on("open", ()=>{ clearTimeout(t); hostConn=c; res(); });
    c.on("data", d=>{ player.hostSeen=Date.now(); if(!d || !d.ev) return;
      if(d.ev==="hb"){ onHostBeat(d.payload); return; }
      dispatch(d.ev, d.payload);
      const k=stateKeyFor(d.ev, d.payload); if(k && player.me?.ok) player.stateKey=k; });
    c.on("close", ()=>{ if(hostConn===c){ hostConn=null; reconnectLoop(code); } });
    const onErr = e=>{ clearTimeout(t); peer.off("error", onErr); rej(e); };
    peer.on("error", onErr);
  }), 4, 2000);
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
// Heartbeat: the host beats every 2s with its current state. A phone that missed a message (screen locked,
// wifi blink) notices the mismatch and asks for a resync; a phone that hears nothing for 20s rebuilds the link.
function stateKeyFor(ev, p){
  if(ev==="ready") return "ready:"+p.idx; if(ev==="question") return "question:"+p.idx; if(ev==="pause") return "paused:"+p.idx;
  if(ev==="closed") return "closed:"+p.idx; if(ev==="rev") return "reveal:"+p.i; if(ev==="end") return "end"; if(ev==="lobby") return "lobby";
  return null;
}
function hostStateKey(){
  const ph=host.phase; if(ph==="reveal") return "reveal:"+host.ridx; if(ph==="end"||ph==="lobby") return ph; return ph+":"+host.idx;
}
function onHostBeat(p){
  if(!p || !player.me?.ok || p.key==="lobby" || p.key===player.stateKey) return;
  if(Date.now()-(player.syncAt||0) < 3000) return;
  player.syncAt=Date.now(); send("sync",{ id:player.id });
}
setInterval(()=>{
  if(peer && host.code && !hostConn){   // host
    const now=Date.now(), m={ev:"hb",payload:{ key:hostStateKey() }};
    Object.entries(conns).forEach(([id,c])=>{ if(c._hb && now-c._seen>20000){ try{ c.close(); }catch(e){} delete conns[id]; return; } try{ c.send(m); }catch(e){} });
  } else if(hostConn && player.code){    // player
    try{ hostConn.send({ev:"hb"}); }catch(e){}
    if(player.hostSeen && Date.now()-player.hostSeen>20000 && !reconnecting){ const c=hostConn; hostConn=null; player.hostSeen=0; try{ c.close(); }catch(e){} reconnectLoop(player.code); }
  }
}, 2000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && hostConn && player.me?.ok){ player.syncAt=Date.now(); send("sync",{ id:player.id }); } });
function sendTo(c, ev, payload){ try{ c.send({ev,payload}); }catch(e){} }
function send(ev, payload){
  const m={ev,payload};
  if(hostConn){ try{ hostConn.send(m); }catch(e){} }
  else Object.values(conns).forEach(c=>{ try{ c.send(m); }catch(e){} });
}
const params = new URLSearchParams(location.search);

// Entry shape: [question, answer, ...alts, level]; custom (host-made) entries have no level and count as every level.
const qLevel = q => (typeof q[q.length-1]==="number") ? q[q.length-1] : 0;
const qAlts = q => q.slice(2).filter(x=>typeof x==="string");

// ======================= CUSTOM QUESTIONS (made by the host, saved on this device) =======================
const CUSTOM_THEME = "Perguntas da família";
const CUSTOM_KEY = "quiz.custom";
function loadCustom(){ const c=load(CUSTOM_KEY); return Array.isArray(c)?c:[]; }
const FAMILY_FIXED = (BANK[CUSTOM_THEME]||[]).slice();
function syncCustom(){ const all=FAMILY_FIXED.concat(loadCustom()); if(all.length) BANK[CUSTOM_THEME]=all; else delete BANK[CUSTOM_THEME]; }
let editingCustom = -1;
function renderCustom(){
  const box=$("#customList"); box.innerHTML="";
  const c=loadCustom();
  c.forEach((q,i)=>{
    const row=el("div","arow"); row.style.setProperty("--team","var(--accent)");
    const alts=q.slice(2).filter(x=>typeof x==="string");
    row.append(el("span","ans", q[0]+" → "+q[1]+(alts.length?" ("+alts.join(", ")+")":"")));
    const ed=el("button","btn ghost","✎"); ed.type="button"; ed.setAttribute("aria-label","Editar pergunta");
    ed.addEventListener("click", ()=>{ editingCustom=i; $("#customQ").value=q[0]; $("#customA").value=q[1]; $("#customAlt").value=alts.join(", "); $("#addCustom").textContent="Salvar alteração"; $("#cancelCustom").hidden=false; $("#customQ").focus(); });
    const rm=el("button","btn ghost","✕"); rm.type="button"; rm.setAttribute("aria-label","Remover pergunta");
    rm.addEventListener("click", ()=>{ const c=loadCustom(); c.splice(i,1); store(CUSTOM_KEY,c); syncCustom(); if(editingCustom===i) resetCustomForm(); renderCustom(); renderThemes(); });
    row.append(ed, rm); box.append(row);
  });
  $("#customCount").textContent = c.length ? c.length+" pergunta(s)" : "";
}
function resetCustomForm(){ editingCustom=-1; $("#customQ").value=""; $("#customA").value=""; $("#customAlt").value=""; $("#addCustom").textContent="+ adicionar pergunta"; $("#cancelCustom").hidden=true; }
$("#cancelCustom").addEventListener("click", resetCustomForm);
$("#addCustom").addEventListener("click", ()=>{
  const q=$("#customQ").value.trim(), a=$("#customA").value.trim();
  const alts=$("#customAlt").value.split(",").map(x=>x.trim()).filter(Boolean);
  if(!q||!a) return;
  const c=loadCustom(); const entry=[q,a,...alts];
  if(editingCustom>=0 && c[editingCustom]) c[editingCustom]=entry; else c.push(entry);
  store(CUSTOM_KEY,c); syncCustom(); resetCustomForm(); $("#customQ").focus();
  if(!host.themes.includes(CUSTOM_THEME)) host.themes.push(CUSTOM_THEME);
  renderCustom(); renderThemes(); saveHost();
});
$("#exportCustom").addEventListener("click", async ()=>{
  const text=loadCustom().map(q=>q[0]+" | "+q[1]+(q.length>2?" | "+q.slice(2).join(", "):"")).join("\n");
  try{ await navigator.clipboard.writeText(text); $("#exportCustom").textContent="Copiado!"; }catch(e){ const t=$("#customPaste"); t.hidden=false; t.value=text; t.select(); }
  setTimeout(()=>$("#exportCustom").textContent="Copiar lista",1500);
});
$("#importCustom").addEventListener("click", ()=>{
  const t=$("#customPaste");
  if(t.hidden){ t.hidden=false; t.value=""; t.placeholder="Cola aqui e toca em Colar lista de novo"; t.focus(); return; }
  const lines=t.value.split("\n").map(l=>l.trim()).filter(Boolean); if(!lines.length){ t.hidden=true; return; }
  const c=loadCustom(); const have=new Set(c.map(q=>norm(q[0])));
  lines.forEach(l=>{ const parts=l.split("|").map(x=>x.trim()); if(parts.length<2||!parts[0]||!parts[1]) return; if(have.has(norm(parts[0]))) return; const alts=(parts[2]||"").split(",").map(x=>x.trim()).filter(Boolean); c.push([parts[0],parts[1],...alts]); have.add(norm(parts[0])); });
  store(CUSTOM_KEY,c); syncCustom(); t.hidden=true; renderCustom(); renderThemes();
  if(c.length && !host.themes.includes(CUSTOM_THEME)) host.themes.push(CUSTOM_THEME); saveHost();
});
syncCustom();

// QR code for the join link (vendor/qrcode.js, MIT, Kazuhiko Arase)
function renderJoinQr(url){
  const box=$("#joinQr"); box.innerHTML="";
  if(typeof qrcode!=="function"){ box.hidden=true; return; }
  try{
    const q=qrcode(0,"M"); q.addData(url); q.make();
    const n=q.getModuleCount(); let d="";
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(q.isDark(y,x)) d+=`M${x} ${y}h1v1h-1z`;
    box.innerHTML=`<svg viewBox="0 0 ${n} ${n}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code"><path d="${d}" fill="#0b1a3a"/></svg>`;
    box.hidden=false;
  }catch(e){ box.hidden=true; }
}

// ======================= HOST =======================
// Answers are kept secret during the game (host.log[idx].answers) and only revealed, question by question, at the end.
const host = { code:null, teams:{}, themes:[], count:3, secs:30, levels:[1,2,3], deck:[], idx:0, answers:{}, log:[], ridx:0, timer:null, left:0, phase:"lobby" };
const playing = () => Object.entries(host.teams).filter(([,t])=>t.ok);

const HOST_KEY="quiz.host";
function saveHost(){ try{ store(HOST_KEY,{ code:host.code, teams:host.teams, themes:host.themes, count:host.count, secs:host.secs, levels:host.levels, deck:host.deck, gameId:host.gameId, rounds:host.rounds, idx:host.idx, answers:host.answers, log:host.log, ridx:host.ridx, phase:host.phase, savedAt:Date.now() }); }catch(e){} }
function clearHost(){ store(HOST_KEY, undefined); }
const savedHost = load(HOST_KEY);
if(savedHost && savedHost.code && Date.now()-savedHost.savedAt < 6*3600e3){
  const b=$("#btnResume"); b.hidden=false; b.textContent="Retomar sala "+savedHost.code;
}
$("#btnResume").addEventListener("click", ()=>startHost(savedHost));
$("#btnHost").addEventListener("click", ()=>startHost(null));
let startingHost=false;
async function startHost(saved){
  if(startingHost) return; startingHost=true;
  if(saved){ if(saved.phase==="paused") saved.phase="ready"; Object.assign(host, { code:saved.code, teams:saved.teams||{}, themes:saved.themes||[], count:(saved.count && saved.count<=8) ? saved.count : 3, secs:saved.secs||30, levels:saved.levels||[1,2,3], deck:saved.deck||[], gameId:saved.gameId||0, rounds:saved.rounds||0, idx:saved.idx||0, answers:saved.answers||{}, log:saved.log||[], ridx:saved.ridx||0, phase:saved.phase||"lobby" }); if(host.phase==="question") host.phase="ready"; }
  else host.code = roomCode();
  $("#btnHost").disabled=true; $("#btnHost").textContent="Abrindo sala…";
  const H = {
    join: p => {
      if(!p.id) return;
      if(!host.teams[p.id]){
        const used = new Set(Object.values(host.teams).map(t=>t.name));
        const c = CREW.find(c=>!used.has(c.name)) || CREW[Object.keys(host.teams).length % CREW.length];
        host.teams[p.id] = { name:c.name, color:c.color, sprite:c.sprite, ok:host.phase!=="lobby", score:0 };   // mid-match joiners play right away (the team list is not on the game screen)
        makeSay(pick(actors), c.name+" chegou!", 120);
      }
      broadcastTeams(); if(host.phase!=="lobby") sendCurrentState();
    },
    sync: (p, c) => {
      if(!p.id || !host.teams[p.id] || !c) return;
      sendTo(c, "teams", { teams: host.teams });
      if(host.phase==="lobby") sendTo(c, "lobby", {}); else sendCurrentState(c);
    },
    answer: p => {
      if((host.phase!=="question" && host.phase!=="paused") || p.idx!==host.idx || !host.teams[p.id]?.ok) return;
      const first = host.answers[p.id]==null;
      host.answers[p.id] = String(p.text||"").slice(0,80);
      renderHostAnswers(); saveHost();
      if(first) makeSay(pick(actors), host.teams[p.id].name+" respondeu!", 100);
    },
  };
  try{ await openHost(host.code, H); }
  catch(e){
    // A resumed match never waits on the network: the saved game opens right away and the room keeps
    // retrying in the background (another tab may still hold the room id for a few seconds).
    if(!saved){ startingHost=false; $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)"; return msg("#homeMsg","Não consegui abrir a sala. Confere a internet e tenta de novo."); }
    handlers=H; $("#hostStatus").textContent="Reconectando a sala…";
  }
  startHostWatch(); startingHost=false;
  $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)";
  $("#roomCode").textContent = host.code;
  $("#joinUrl").textContent = location.origin + location.pathname + "?sala=" + host.code;
  renderJoinQr($("#joinUrl").textContent);
  renderThemes(); renderTeamList(); renderCustom(); renderHistory();
  $("#count").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", +x.dataset.n===host.count));
  $("#timer").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", +x.dataset.t===host.secs));
  renderLevels(); renderRoundsInfo();
  if(saved && host.deck.length && host.phase!=="lobby"){
    if(host.phase==="end") hostEnd();
    else if(host.phase==="reveal") showReveal(host.ridx);
    else if(host.phase==="closed"){ show("hostGame"); loadQuestionView(); closedView(); }
    else { const keep=host.answers||{}; show("hostGame"); loadQuestion(); host.answers=keep; renderHostAnswers(); saveHost(); }   // a reload mid-question keeps the answers already sent
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
  $("#btnStart").disabled = false; renderFinishLobby();
  $("#confirmedCount").textContent = playing().length+" confirmada(s) de "+ids.length;
}
function renderThemes(){
  const box = $("#themes"); box.innerHTML="";
  Object.keys(BANK).forEach((t,i)=>{
    const lab = el("label","theme");
    const cb = el("input"); cb.type="checkbox"; cb.id="theme-"+i; cb.value=t; cb.checked = host.themes.includes(t);
    cb.addEventListener("change", ()=>{ host.themes = [...box.querySelectorAll("input:checked")].map(x=>x.value); saveHost(); renderRoundsInfo(); });
    lab.append(cb, document.createTextNode(t)); box.append(lab);
  });
}
$("#mixAll").addEventListener("click", ()=>{ const all=Object.keys(BANK); host.themes = host.themes.length===all.length ? [] : all.slice(); renderThemes(); renderRoundsInfo(); });
// host.count = number of rounds; every round asks one question from each selected theme
$("#count").addEventListener("click", e=>{ const b=e.target.closest("button[data-n]"); if(!b) return; host.count=+b.dataset.n; saveHost(); $("#count").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); renderRoundsInfo(); });
function renderRoundsInfo(){ const n=host.themes.length, r=host.count;
  $("#roundsInfo").textContent = n ? `${r} rodada${r>1?"s":""} × ${n} tema${n>1?"s":""} = ${r*n} perguntas. Cada rodada tem uma pergunta de cada tema.` : "Cada rodada tem uma pergunta de cada tema marcado."; }
$("#level").addEventListener("click", e=>{
  const b=e.target.closest("button[data-l]"); if(!b) return;
  const l=b.dataset.l;
  if(l==="all") host.levels=[1,2,3];
  else { const v=+l; host.levels = host.levels.includes(v) ? host.levels.filter(x=>x!==v) : [...host.levels, v]; if(!host.levels.length) host.levels=[v]; }
  renderLevels(); saveHost();
});
function renderLevels(){ $("#level").querySelectorAll("button[data-l]").forEach(x=>{ const l=x.dataset.l; x.setAttribute("aria-pressed", l==="all" ? host.levels.length===3 : host.levels.includes(+l)); }); }
$("#timer").addEventListener("click", e=>{ const b=e.target.closest("button[data-t]"); if(!b) return; host.secs=+b.dataset.t; saveHost(); $("#timer").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); });
$("#copyUrl").addEventListener("click", async ()=>{
  const t=$("#joinUrl").textContent;
  try{ await navigator.clipboard.writeText(t); $("#copyUrl").textContent="Copiado!"; }catch(e){ const r=document.createRange(); r.selectNodeContents($("#joinUrl")); getSelection().removeAllRanges(); getSelection().addRange(r); }
  setTimeout(()=>$("#copyUrl").textContent="Copiar link",1500);
});

$("#btnStart").addEventListener("click", ()=>{
  if(!host.themes.length) return msg("#lobbyMsg","Escolhe pelo menos um tema (ou mistura tudo).");
  if(!playing().length) { msg("#lobbyMsg","Marca a caixinha da equipe lá em cima pra confirmar ela no jogo."); $("#teamList").scrollIntoView({behavior:"smooth",block:"center"}); return; }
  msg("#lobbyMsg","");
  // one shuffled pool per theme; each round takes one question from every theme (in a fresh random order)
  const seen=new Set(), pools={};
  host.themes.forEach(t=>{ pools[t]=shuffle((BANK[t]||[]).filter(q=>{ const l=qLevel(q), k=norm(q[0]); if(seen.has(k) || !(l===0 || host.levels.includes(l))) return false; seen.add(k); return true; })); });
  host.deck=[];
  for(let r=0;r<host.count;r++) shuffle(host.themes.slice()).forEach(t=>{ const q=pools[t].pop(); if(q) host.deck.push({ theme:t, q, round:r+1 }); });
  if(!host.deck.length) return msg("#lobbyMsg","Nenhuma pergunta com essa combinação de temas e dificuldade.");
  host.gameId = Date.now(); host.rounds = host.count;
  Object.values(host.teams).forEach(t=>t.score=0);
  host.log=[]; host.ridx=0; host.idx=0; show("hostGame"); loadQuestion();
});

function loadQuestion(){
  host.answers={}; host.phase="ready"; stopTimer(); host.left=host.secs;
  loadQuestionView();
  send("ready", { idx:host.idx, total:host.deck.length, label:roundLabel(host.idx) });
  saveHost();
}
function loadQuestionView(){
  const item=host.deck[host.idx]; const [text,correct]=item.q; item.correct=correct;
  $("#hqNum").textContent = `${roundLabel(host.idx)} · só você vê. Dá play quando quiser.`;
  $("#hqTheme").textContent=item.theme + (["","  ·  fácil","  ·  médio","  ·  difícil"][qLevel(item.q)]||""); $("#hqText").textContent=text;
  $("#hCorrect").textContent = correct; $("#hCorrectRow").hidden = true; $("#btnPeek").textContent = "Ver resposta (só pra mim)";
  $("#hClock").textContent=host.secs+"s"; $("#hClock").classList.remove("warn"); $("#htbar").style.width="100%"; $("#htbar").classList.remove("warn");
  setPlayButton("play"); $("#hClock").classList.remove("paused"); $("#btnReveal").hidden=true; $("#btnNext").hidden=true; $("#hFeedback").hidden=true;
  renderHostAnswers();
}
function roundLabel(i){ const it=host.deck[i]; return it && it.round ? `Rodada ${it.round} de ${host.rounds||host.count} · pergunta ${i+1} de ${host.deck.length}` : `Pergunta ${i+1} de ${host.deck.length}`; }
function questionPayload(){ const it=host.deck[host.idx]; return { idx:host.idx, total:host.deck.length, label:roundLabel(host.idx), theme:it.theme, text:it.q[0], secs:host.secs, left:Math.max(0,Math.ceil((host.endsAt-Date.now())/1000)), teams:host.teams }; }
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
function sendCurrentState(to){
  const send = to ? (ev,p)=>sendTo(to,ev,p) : window.send;
  if(host.phase==="ready") send("ready",{ idx:host.idx, total:host.deck.length, label:roundLabel(host.idx) });
  else if(host.phase==="question") send("question", questionPayload());
  else if(host.phase==="paused") send("pause",{ idx:host.idx, left:host.left });
  else if(host.phase==="closed") send("closed", { idx:host.idx, total:host.deck.length, answers:host.answers });
  else if(host.phase==="reveal") send("rev", revPayload(host.ridx));
  else if(host.phase==="end") send("end", { scores: scoreList() });
}
function setPlayButton(mode){ // "play" | "running" | "paused"
  const b=$("#btnPlay"); b.hidden=false; b.className="btn primary play "+(mode==="play"?"":mode);
  const icon = mode==="running" ? '<svg viewBox="0 0 12 12" width="34" height="34" aria-hidden="true"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 12 12" width="34" height="34" aria-hidden="true"><path d="M3 1h2v2h2v2h2v2H7v2H5v2H3z" fill="currentColor"/></svg>';
  const label = mode==="running" ? "PAUSAR<small>para o tempo em todos os celulares</small>" : mode==="paused" ? "CONTINUAR<small>o tempo volta a correr pra todo mundo</small>" : "PLAY<small>libera a pergunta e o tempo pra todo mundo</small>";
  b.innerHTML = icon+"<span>"+label+"</span>";
}
$("#btnPlay").addEventListener("click", ()=>{
  if(host.phase==="ready"){
    host.phase="question"; host.left=host.secs; host.endsAt=Date.now()+host.secs*1000; $("#btnReveal").hidden=false;
    $("#hqNum").textContent = `${roundLabel(host.idx)} · valendo!`;
    send("question", questionPayload());
    host.timer=setInterval(tick,250); setPlayButton("running");
    makeSay(pick(actors), "VALENDO!", 90);
  } else if(host.phase==="question"){
    host.phase="paused"; stopTimer(); host.left=Math.max(0,Math.ceil((host.endsAt-Date.now())/1000));
    $("#hClock").textContent=host.left+"s · pausado"; $("#hClock").classList.add("paused");
    send("pause",{ idx:host.idx, left:host.left }); setPlayButton("paused"); saveHost();
    makeSay(pick(actors), "pausa pra pensar...", 120);
  } else if(host.phase==="paused"){
    host.phase="question"; host.endsAt=Date.now()+host.left*1000; $("#hClock").classList.remove("paused");
    send("question", questionPayload()); host.timer=setInterval(tick,250); setPlayButton("running");
    makeSay(pick(actors), "VALENDO de novo!", 90);
  }
});
function stopTimer(){ if(host.timer){ clearInterval(host.timer); host.timer=null; } }
function tick(){
  const left=Math.max(0, Math.ceil((host.endsAt-Date.now())/1000));
  if(left===host.left && left>0) return;
  host.left=left;
  const warn=host.left<=5;
  $("#hClock").textContent=host.left+"s"; $("#hClock").classList.toggle("warn",warn);
  $("#htbar").style.width=(host.left/host.secs*100)+"%"; $("#htbar").classList.toggle("warn",warn);
  send("tick",{ left:host.left, idx:host.idx });
  if(host.left<=0){ $("#hClock").textContent="TEMPO!"; actors.forEach(a=>{a.state="jump";a.t=0;}); makeSay(pick(actors),"ACABOU O TEMPO!",150); closeQuestion(); }
}
// during the game the host only sees WHO answered, never what
function renderHostAnswers(){
  const box=$("#hAnswers"); box.innerHTML="";
  const closed = host.phase==="closed";
  playing().forEach(([id,t])=>{
    const row=el("div","arow"+(host.answers[id]!=null?" hit":"")); row.style.setProperty("--team",t.color);
    row.append(el("i","dot"), el("b",null,t.name), el("span","ans", host.answers[id]!=null ? "✓ respondeu" : (closed ? "— não respondeu" : "… pensando")));
    box.append(row);
  });
  $("#hAnswersLabel").textContent = `Responderam: ${Object.keys(host.answers).length} de ${playing().length}`;
}
function scoreList(){ return playing().map(([id,t])=>({id,team:t.name,color:t.color,score:t.score})).sort((a,b)=>b.score-a.score); }
function closeQuestion(){
  if(host.phase!=="question" && host.phase!=="paused") return;
  stopTimer(); host.phase="closed";
  host.log[host.idx] = { answers:{...host.answers} };
  closedView();
  send("closed", { idx:host.idx, total:host.deck.length, answers:host.answers }); saveHost();
}
function closedView(){
  const f=$("#hFeedback"); f.hidden=false; f.className="feedback ok"; f.textContent="Tempo encerrado. As respostas ficam guardadas em segredo até o final.";
  $("#btnPlay").hidden=true; $("#btnReveal").hidden=true; $("#btnNext").hidden=false;
  $("#btnNext").textContent = host.idx+1>=host.deck.length ? "Acabaram as perguntas! Ir pra revelação" : "Próxima pergunta";
  $("#hClock").textContent="TEMPO!"; $("#htbar").style.width="0%";
  renderHostAnswers();
}
$("#btnReveal").addEventListener("click", ()=>{ host.endsAt=Date.now(); host.phase="question"; tick(); });
$("#btnPeek").addEventListener("click", ()=>{ const r=$("#hCorrectRow"); r.hidden=!r.hidden; $("#btnPeek").textContent = r.hidden ? "Ver resposta (só pra mim)" : "Esconder resposta"; });
$("#btnNext").addEventListener("click", ()=>{
  if(!host.log[host.idx]) host.log[host.idx] = { answers:{...host.answers} };
  host.idx++; saveHost();
  if(host.idx>=host.deck.length) return startReveal();
  loadQuestion();
});

// ======================= FINAL REVEAL: one question at a time, then the scoreboard =======================
// End the match early: questions already played (the current one included if it was released) go to the reveal and scoring.
let finishArmed=null;
function armFinish(b){
  if(!finishArmed){ b.dataset.label=b.textContent; b.textContent="Toca de novo pra encerrar (vai pra revelação)"; finishArmed=setTimeout(()=>{ finishArmed=null; b.textContent=b.dataset.label; },4000); return false; }
  clearTimeout(finishArmed); finishArmed=null; b.textContent=b.dataset.label; return true;
}
function playedCount(){ let n=0; host.log.forEach((L,i)=>{ if(L) n=Math.max(n,i+1); }); return n; }
function renderFinishLobby(){ const b=$("#btnFinishLobby"); if(b) b.hidden = !(playedCount()>0 && host.phase!=="end"); }
$("#btnFinishLobby").addEventListener("click", ()=>{
  if(!armFinish($("#btnFinishLobby"))) return;
  const n=playedCount(); host.deck=host.deck.slice(0,n); host.log=host.log.slice(0,n);
  // older builds wiped the question list when going back to the lobby; the answers survive, so rebuild
  // placeholder questions and let the host mark right/wrong by tapping during the reveal
  for(let i=0;i<n;i++) if(!host.deck[i]) host.deck[i]={ theme:"Pergunta "+(i+1), q:["(o texto dessa pergunta se perdeu — toca nas equipes que acertaram)", "—"], round:1 };
  show("hostGame"); startReveal();
});
$("#btnFinish").addEventListener("click", ()=>{
  if(!armFinish($("#btnFinish"))) return;
  stopTimer();
  const released = host.phase==="question" || host.phase==="paused" || host.phase==="closed";
  if((host.phase==="question" || host.phase==="paused") && !host.log[host.idx]) host.log[host.idx]={ answers:{...host.answers} };
  const played = host.idx + (released ? 1 : 0);
  if(played<=0){ host.deck=[]; host.phase="end"; saveHost(); return hostEnd(); }
  host.deck = host.deck.slice(0, played); host.log = host.log.slice(0, played);
  startReveal();
});
function startReveal(){
  host.deck.forEach((it,i)=>{                       // auto-mark every answer once; the host can fix marks while revealing
    const L = host.log[i] || (host.log[i] = { answers:{} });
    if(!L.marks){ L.marks={}; playing().forEach(([id])=>{ L.marks[id]=autoOk(L.answers[id], it.q[1], qAlts(it.q)); }); }
  });
  host.phase="reveal"; host.ridx=0; saveHost(); showReveal(0);
  makeSay(pick(actors), "hora da verdade!", 150);
}
function revPayload(i){
  const it=host.deck[i], L=host.log[i]||{answers:{},marks:{}}, results={};
  playing().forEach(([id,t])=>{ results[id]={ name:t.name, color:t.color, answer:L.answers[id]??null, ok:!!(L.marks||{})[id] }; });
  return { i, total:host.deck.length, label:roundLabel(i), theme:it.theme, text:it.q[0], correct:it.q[1], results };
}
function showReveal(i){
  host.ridx=i; const p=revPayload(i);
  show("hostRev");
  $("#rNum").textContent=`Revelação · ${roundLabel(i)}`;
  $("#rTheme").textContent=p.theme; $("#rText").textContent=p.text; $("#rCorrect").textContent=p.correct;
  const box=$("#rAnswers"); box.innerHTML="";
  Object.entries(p.results).forEach(([id,r])=>{
    const row=el("button","arow btn"+(r.ok?" hit":"")); row.type="button"; row.style.setProperty("--team",r.color);
    row.addEventListener("click", ()=>{ const L=host.log[i]; L.marks[id]=!L.marks[id]; saveHost(); showReveal(i); });
    row.append(el("i","dot"), el("b",null,r.name), el("span","ans", r.answer==null ? "— não respondeu" : r.answer), el("em",null, r.ok ? "✓ +1" : "✗"));
    box.append(row);
  });
  $("#btnRevPrev").disabled = i===0;
  $("#btnRevNext").textContent = i+1>=p.total ? "Ver placar final 🏆" : "Próxima resposta";
  send("rev", p); saveHost();
}
$("#btnRevPrev").addEventListener("click", ()=>{ if(host.ridx>0) showReveal(host.ridx-1); });
$("#btnRevNext").addEventListener("click", ()=>{
  if(host.ridx+1<host.deck.length){ showReveal(host.ridx+1); return; }
  Object.values(host.teams).forEach(t=>t.score=0);
  host.log.forEach(L=>Object.entries((L&&L.marks)||{}).forEach(([id,ok])=>{ if(ok && host.teams[id]) host.teams[id].score++; }));
  hostEnd();
});
// ======================= MATCH HISTORY (saved on the host's device) =======================
const HISTORY_KEY="quiz.history";
function loadHistory(){ const h=load(HISTORY_KEY); return Array.isArray(h)?h:[]; }
function recordMatch(list){
  if(!host.gameId) return;
  const h=loadHistory(); if(h.some(m=>m.id===host.gameId)) return;     // once per match (reloads, re-renders)
  const top=list.length?list[0].score:0;
  h.unshift({ id:host.gameId, at:Date.now(), rounds:host.rounds||host.count, questions:host.deck.length, themes:host.themes.slice(), levels:host.levels.slice(),
    winners:list.filter(x=>x.score===top).map(x=>x.team), scores:list.map(x=>({ team:x.team, color:x.color, score:x.score })) });
  store(HISTORY_KEY, h.slice(0,50)); renderHistory();
}
function renderHistory(){
  const h=loadHistory(), box=$("#historyList"); box.innerHTML=""; $("#historyCard").hidden=!h.length;
  h.slice(0,20).forEach(m=>{ const li=el("li");
    const d=new Date(m.at);
    li.append(el("span","when", d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+" · "+m.rounds+" rodada"+(m.rounds>1?"s":"")+" · "+m.themes.join(", ")));
    li.append(el("span","who", "🏆 "+(m.winners.length>1?"Empate: "+m.winners.join(" e "):m.winners[0]||"—")));
    li.append(el("span","pts", m.scores.map(x=>x.team+" "+x.score).join(" · ")));
    box.append(li); });
}
$("#btnClearHistory").addEventListener("click", ()=>{ const b=$("#btnClearHistory"); if(b.dataset.armed){ store(HISTORY_KEY,undefined); renderHistory(); delete b.dataset.armed; b.textContent="Apagar"; return; } b.dataset.armed="1"; b.textContent="Confirma apagar"; setTimeout(()=>{ delete b.dataset.armed; b.textContent="Apagar"; },5000); });
function hostEnd(){
  host.phase="end"; const list=scoreList(); recordMatch(list);
  renderRank($("#hRank"), list); $("#hWinner").textContent=winnerText(list);
  show("hostEnd"); sceneReact(true); send("end",{ scores:list }); saveHost();
}
function winnerText(list){ if(!list.length) return "Ninguém jogou"; const top=list[0].score; const w=list.filter(x=>x.score===top).map(x=>x.team); return w.length>1 ? "Empate: "+w.join(" e ") : w[0]+" venceu!"; }
function renderRank(ol, list){
  ol.innerHTML="";
  list.forEach((x,i)=>{ const li=el("li"); li.style.setProperty("--team",x.color); li.append(el("span","pos",(i+1)+"º"), el("i","dot"), el("span",null,x.team), el("span","pts",x.score+" pts")); ol.append(li); });
}
$("#btnDissolve").addEventListener("click", ()=>{ $("#btnDissolveConfirm").hidden=false; setTimeout(()=>{ $("#btnDissolveConfirm").hidden=true; }, 6000); });
$("#btnDissolveConfirm").addEventListener("click", ()=>{
  send("kick",{});
  setTimeout(()=>{ Object.values(conns).forEach(c=>{ try{ c.close(); }catch(e){} }); conns={}; if(peer){ try{ peer.destroy(); }catch(e){} peer=null; }
    stopTimer(); host.teams={}; host.deck=[]; host.phase="lobby"; host.code=null; clearHost(); $("#btnResume").hidden=true; show("home"); }, 400);
});
$("#btnAgain").addEventListener("click", ()=>{ host.phase="lobby"; host.deck=[]; host.log=[]; saveHost(); send("lobby",{}); renderThemes(); renderTeamList(); show("hostLobby"); });
$("#btnBackLobby").addEventListener("click", ()=>{ stopTimer(); if(host.phase==="question"||host.phase==="paused"){ if(!host.log[host.idx]) host.log[host.idx]={ answers:{...host.answers} }; } host.phase="lobby"; saveHost(); renderFinishLobby(); send("lobby",{}); renderTeamList(); show("hostLobby"); });

// Hide the aquarium while the on-screen keyboard is up, so the question stays visible on phones
(()=>{ const ta=$("#pAnswer"); ta.addEventListener("focus", ()=>document.body.classList.add("typing")); ta.addEventListener("blur", ()=>document.body.classList.remove("typing"));
  if(window.visualViewport){ let base=window.visualViewport.height; window.visualViewport.addEventListener("resize", ()=>{ const h=window.visualViewport.height; if(h<base*0.75) document.body.classList.add("typing"); else if(document.activeElement!==ta) document.body.classList.remove("typing"); if(h>base) base=h; }); } })();
$("#pAnswer").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); $("#pAnswer").blur(); } });

// ======================= PLAYER =======================
const player = { id: load("quiz.pid") || Math.random().toString(36).slice(2,10), code:null, me:null, idx:-1, sent:null, open:false, secs:30, shownIdx:-1 };
store("quiz.pid", player.id);

$("#btnJoin").addEventListener("click", ()=>{ $("#inCode").value=(params.get("sala")||"").toUpperCase(); show("playerJoin"); $("#inCode").focus(); });
if(params.get("sala")){ $("#inCode").value=params.get("sala").toUpperCase(); show("playerJoin"); }

const PLAYER_KEY="quiz.player";
$("#btnEnter").addEventListener("click", ()=>joinRoom($("#inCode").value.trim().toUpperCase()));
async function joinRoom(code){
  if(code.length!==4) return msg("#joinMsg","Código tem 4 letras.");
  msg("#joinMsg",""); player.code=code; $("#pRoom").textContent=code;
  $("#btnEnter").disabled=true; $("#btnEnter").textContent="Conectando…";
  try{ await openPlayer(code, {
    teams: p => applyTeams(p.teams),
    ready: p => { if(!player.me?.ok) return; player.idx=p.idx; player.sent=null; player.open=false; $("#pAnswer").value=""; $("#pSent").textContent=""; $("#waitTitle").textContent=p.label||`Pergunta ${p.idx+1} de ${p.total}`; $("#waitText").textContent="Esperando o host dar play…"; renderPlayerScores([]); show("playerWait"); },
    question: p => { if(p.teams) applyTeams(p.teams); if(player.me?.ok) playerQuestion(p); },
    tick: p => { if(p.idx!==player.idx) return; startCountdown(p.left); },
    pause: p => { if(p.idx!==player.idx) return; stopCountdown(); const c=$("#pClock"); c.textContent=p.left+"s · pausado"; c.classList.add("paused"); c.classList.remove("warn"); $("#ptbar").classList.remove("warn"); makeSay(pick(actors),"pausa!",100); },
    closed: p => playerClosed(p),
    rev: p => playerRev(p),
    end: p => { renderRank($("#pRank"), p.scores); $("#pWinner").textContent=winnerText(p.scores); show("playerEnd"); sceneReact(true); },
    kick: () => { store(PLAYER_KEY, undefined); stopCountdown(); player.code=null; if(hostConn){ try{hostConn.close();}catch(e){} hostConn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; } document.body.classList.remove("teamed"); $("#pTeamName").hidden=true; player.me=null; player.idx=-1; $("#inCode").value=""; msg("#joinMsg","O host desfez a sala. Valeu por jogar!"); show("playerJoin"); },
    lobby: () => { player.idx=-1; $("#pScoresCard").hidden=true; $("#pTeamsCard").hidden=false; waitLobby(); },
  }); }catch(e){ $("#btnEnter").disabled=false; $("#btnEnter").textContent="Entrar"; const why = e && e.type==="peer-unavailable" ? "Não achei essa sala. Confere o código; se estiver certo, pede pro host recarregar a página dele e tenta de novo."
      : e && e.message==="timeout" ? "A sala existe mas a conexão não fechou. Tenta no Wi-Fi da casa (ou no 4G, se estiver no Wi-Fi) e entra de novo."
      : "Não deu pra entrar ("+((e&&(e.type||e.message))||"erro")+"). Tenta de novo; se repetir, o host recarrega a página.";
    return msg("#joinMsg", why); }
  $("#btnEnter").disabled=false; $("#btnEnter").textContent="Entrar";
  player.hostSeen=Date.now(); player.stateKey=null;
  send("join",{ id:player.id });
  store(PLAYER_KEY,{ code, at:Date.now() });
  $("#waitTitle").textContent="Entrando…"; $("#waitText").textContent="Esperando o host te ver.";
  show("playerWait");
}
// Reload or reopen: go straight back into the room (same team, same color)
(()=>{ const sv=load(PLAYER_KEY); const fromUrl=(params.get("sala")||"").toUpperCase();
  if(sv && sv.code && Date.now()-sv.at < 6*3600e3 && (!fromUrl || fromUrl===sv.code) && !savedHost){ $("#inCode").value=sv.code; show("playerJoin"); joinRoom(sv.code); } })();
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
  $("#pTeamsCard").hidden = player.idx>=0;
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
  const playing = player.idx>=0;
  $("#pTeamsCard").hidden = playing; $("#pScoresCard").hidden = !playing || !(list&&list.length);
  const box=$("#pScores"); box.innerHTML="";
  (list||[]).forEach(x=>{ const c=teamChip({name:x.team,color:x.color}, x.id===player.id?" active":""); c.append(el("em",null,x.score)); box.append(c); });
}
function startCountdown(left){
  player.endsAt = Date.now()+left*1000;
  if(player.cd) clearInterval(player.cd);
  const step=()=>{ const l=Math.max(0, Math.ceil((player.endsAt-Date.now())/1000)); setPlayerClock(l, true); if(l<=0){ clearInterval(player.cd); player.cd=null; } };
  step(); player.cd=setInterval(step,250);
}
function stopCountdown(){ if(player.cd){ clearInterval(player.cd); player.cd=null; } }
function setPlayerClock(left, running){
  const c=$("#pClock"); c.classList.remove("paused"); const warn=left<=5 && running;
  c.textContent = running ? (left<=0?"TEMPO!":left+"s") : "";
  c.classList.toggle("warn",warn);
  $("#ptbar").style.width = (running? left/Math.max(1,player.secs)*100 : 100)+"%"; $("#ptbar").classList.toggle("warn",warn);
}
function playerQuestion(p){
  const fresh = p.idx!==player.shownIdx;
  player.idx=p.idx; player.shownIdx=p.idx; player.secs=p.secs; player.open=true;
  if(fresh){ player.sent=null; $("#pAnswer").value=""; }
  $("#pqNum").textContent=p.label||`Pergunta ${p.idx+1} de ${p.total}`; $("#pqTheme").textContent=p.theme; $("#pqText").textContent=p.text;
  $("#pFeedback").hidden=true; $("#pAnswer").disabled=false; $("#btnSend").disabled=false;
  $("#pSent").textContent = player.sent ? "Enviado: "+player.sent : "";
  startCountdown(p.left);
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
// time's up: the answer is locked and kept secret until the final reveal
function playerClosed(p){
  if(!player.me?.ok) return;
  if(p.idx!==player.idx || $("#playerGame").hidden){ player.idx=p.idx; $("#waitTitle").textContent=`Pergunta ${p.idx+1} de ${p.total}`; $("#waitText").textContent="Tempo encerrado. Esperando a próxima…"; show("playerWait"); return; }
  player.open=false; stopCountdown();
  $("#pAnswer").disabled=true; $("#btnSend").disabled=true;
  const mine=(p.answers||{})[player.id]; const f=$("#pFeedback"); f.hidden=false; f.className="feedback ok";
  f.textContent = mine!=null ? "Resposta guardada: "+mine+". O resultado sai só no final!" : "Não deu tempo de responder. O resultado sai no final.";
  setPlayerClock(0,false); $("#pClock").textContent="tempo encerrado";
  makeSay(pick(actors), pick(["será que acertou?","segredo!","só no final..."]), 120);
}
// final reveal, mirrored from the host one question at a time
function playerRev(p){
  if(!player.me) return;
  player.idx=-2; stopCountdown(); show("playerRev");
  $("#prNum").textContent=`Revelação · `+(p.label||`pergunta ${p.i+1} de ${p.total}`);
  $("#prTheme").textContent=p.theme; $("#prText").textContent=p.text; $("#prCorrect").textContent=p.correct;
  const me=p.results[player.id], f=$("#prMine");
  if(me){ f.hidden=false; f.className="feedback "+(me.ok?"ok":"no"); f.textContent = me.answer==null ? "Vocês não responderam essa." : (me.ok ? "Vocês acertaram! ("+me.answer+")" : "Vocês responderam: "+me.answer); }
  else f.hidden=true;
  const box=$("#prAnswers"); box.innerHTML="";
  Object.entries(p.results).forEach(([id,r])=>{ const row=el("div","arow"+(r.ok?" hit":"")); row.style.setProperty("--team",r.color);
    row.append(el("i","dot"), el("b",null,r.name), el("span","ans", r.answer==null ? "—" : r.answer), el("em",null, r.ok ? "✓" : "✗")); box.append(row); });
  if(me && player.revSeen!==p.i){ player.revSeen=p.i; sceneReact(!!me.ok); }
}
$("#btnLeave").addEventListener("click", ()=>{ store(PLAYER_KEY, undefined); stopCountdown(); if(hostConn){ try{hostConn.close();}catch(e){} hostConn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; } document.body.classList.remove("teamed"); $("#pTeamName").hidden=true; player.me=null; player.idx=-1; player.code=null; show("home"); });

// GitHub Pages caches index.html for ~10 min, so a device can keep running an old build after a deploy.
// Check the live page every minute and reload into the new build when it's safe (never mid-question).
(function watchForNewBuild(){
  const mine = (document.querySelector('script[src*="app.js?v="]')?.getAttribute("src")||"").split("v=")[1];
  if(!mine) return;
  async function check(){
    try{
      const r = await fetch(location.pathname+"?nocache="+Date.now(), { cache:"no-store" });
      const m = (await r.text()).match(/app\.js\?v=(\d+)/); if(!m || m[1]===mine) return;
      if(host.phase==="question" || host.phase==="paused" || player.open) return;
      const q = new URLSearchParams(location.search); q.set("v", m[1]);
      location.replace(location.pathname+"?"+q.toString());
    }catch(e){}
  }
  setTimeout(check, 3000); setInterval(check, 60000);
})();

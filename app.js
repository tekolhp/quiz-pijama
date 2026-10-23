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
    c.on("close", ()=>{ hostConn=null; $("#waitTitle").textContent="Conexão caiu"; $("#waitText").textContent="Toca em Sair e entra de novo com o código."; show("playerWait"); });
    peer.on("error", e=>{ clearTimeout(t); rej(e); });
  });
}
function send(ev, payload){
  const m={ev,payload};
  if(hostConn){ try{ hostConn.send(m); }catch(e){} }
  else Object.values(conns).forEach(c=>{ try{ c.send(m); }catch(e){} });
}
const params = new URLSearchParams(location.search);

// ======================= HOST =======================
const host = { code:null, teams:{}, themes:[], count:15, secs:30, deck:[], idx:0, answers:{}, timer:null, left:0, phase:"lobby" };
const playing = () => Object.entries(host.teams).filter(([,t])=>t.ok);

$("#btnHost").addEventListener("click", async ()=>{
  host.code = roomCode();
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
      renderHostAnswers();
      if(first) makeSay(pick(actors), host.teams[p.id].name+" respondeu!", 100);
    },
  });
  }catch(e){ $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)"; return msg("#homeMsg","Não consegui abrir a sala. Confere a internet e tenta de novo."); }
  $("#btnHost").disabled=false; $("#btnHost").textContent="Criar sala (sou o host)";
  $("#roomCode").textContent = host.code;
  $("#joinUrl").textContent = location.origin + location.pathname + "?sala=" + host.code;
  renderThemes(); renderTeamList();
  show("hostLobby");
});
function broadcastTeams(){ send("teams", { teams: host.teams }); renderTeamList(); }
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
    cb.addEventListener("change", ()=>{ host.themes = [...box.querySelectorAll("input:checked")].map(x=>x.value); });
    lab.append(cb, document.createTextNode(t), el("span","n",BANK[t].length)); box.append(lab);
  });
}
$("#mixAll").addEventListener("click", ()=>{ const all=Object.keys(BANK); host.themes = host.themes.length===all.length ? [] : all.slice(); renderThemes(); });
$("#count").addEventListener("click", e=>{ const b=e.target.closest("button[data-n]"); if(!b) return; host.count=+b.dataset.n; $("#count").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); });
$("#timer").addEventListener("click", e=>{ const b=e.target.closest("button[data-t]"); if(!b) return; host.secs=+b.dataset.t; $("#timer").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); });
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
  const item=host.deck[host.idx]; const [text,correct,...wrong]=item.q;
  item.correct=correct; host.marks={};
  host.answers={}; host.phase="ready"; stopTimer(); host.left=host.secs;
  $("#hqNum").textContent = `Pergunta ${host.idx+1} de ${host.deck.length} · só você vê. Dá play quando quiser.`;
  $("#hqTheme").textContent=item.theme; $("#hqText").textContent=text;
  $("#hCorrect").textContent = correct;
  $("#hClock").textContent=host.secs+"s"; $("#hClock").classList.remove("warn"); $("#htbar").style.width="100%"; $("#htbar").classList.remove("warn");
  $("#btnPlay").hidden=false; $("#btnReveal").hidden=true; $("#btnNext").hidden=true; $("#hFeedback").hidden=true;
  renderHostAnswers();
  send("ready", { idx:host.idx, total:host.deck.length, scores:scoreList() });
}
function questionPayload(){ const it=host.deck[host.idx]; return { idx:host.idx, total:host.deck.length, theme:it.theme, text:it.q[0], secs:host.secs, left:host.left, teams:host.teams }; }
const norm = t => String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function autoOk(answer, correct){ const a=norm(answer), c=norm(correct); if(!a) return false; if(a===c) return true; const aw=a.split(" ").filter(w=>w.length>2), cw=c.split(" ").filter(w=>w.length>2); return cw.length>0 && aw.length>0 && aw.every(w=>cw.includes(w)); }
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
    if(revealing){ row.type="button"; row.addEventListener("click", ()=>{ host.marks[id]=!host.marks[id]; renderHostAnswers(); }); }
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
  playing().forEach(([id])=>{ host.marks[id]=autoOk(host.answers[id], it.correct); });
  const anyOk=Object.values(host.marks).some(Boolean);
  const f=$("#hFeedback"); f.hidden=false; f.className="feedback ok"; f.textContent="Tempo encerrado. Confere as respostas e vai pra próxima.";
  $("#btnReveal").hidden=true; $("#btnNext").hidden=false;
  $("#btnNext").textContent = host.idx+1>=host.deck.length ? "Fechar e ver resultado" : "Pontuar e ir pra próxima";
  renderHostAnswers(); sceneReact(anyOk);
  send("reveal", revealPayload());
}
$("#btnReveal").addEventListener("click", ()=>{ host.left=0; tick(); });
$("#btnNext").addEventListener("click", ()=>{
  playing().forEach(([id,t])=>{ if(host.marks[id]) t.score++; });
  send("reveal", revealPayload());
  host.idx++; if(host.idx>=host.deck.length) return hostEnd(); loadQuestion();
});
function hostEnd(){
  host.phase="end"; const list=scoreList();
  renderRank($("#hRank"), list); $("#hWinner").textContent=winnerText(list);
  show("hostEnd"); sceneReact(true); send("end",{ scores:list });
}
function winnerText(list){ if(!list.length) return "Ninguém jogou"; const top=list[0].score; const w=list.filter(x=>x.score===top).map(x=>x.team); return w.length>1 ? "Empate: "+w.join(" e ") : w[0]+" venceu!"; }
function renderRank(ol, list){
  ol.innerHTML="";
  list.forEach((x,i)=>{ const li=el("li"); li.style.setProperty("--team",x.color); li.append(el("span","pos",(i+1)+"º"), el("i","dot"), el("span",null,x.team), el("span","pts",x.score+" pts")); ol.append(li); });
}
$("#btnAgain").addEventListener("click", ()=>{ host.phase="lobby"; send("lobby",{}); renderThemes(); renderTeamList(); show("hostLobby"); });
$("#btnBackLobby").addEventListener("click", ()=>{ stopTimer(); host.phase="lobby"; send("lobby",{}); renderTeamList(); show("hostLobby"); });

// ======================= PLAYER =======================
const player = { id: load("quiz.pid") || Math.random().toString(36).slice(2,10), code:null, me:null, idx:-1, sent:null, open:false, secs:30 };
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
    ready: p => { if(!player.me?.ok) return; player.idx=p.idx; player.sent=null; player.open=false; $("#waitTitle").textContent=`Pergunta ${p.idx+1} de ${p.total}`; $("#waitText").textContent="Esperando o host dar play…"; renderPlayerScores(p.scores); show("playerWait"); },
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
  const fresh = p.idx!==player.idx;
  player.idx=p.idx; player.secs=p.secs; player.open=true;
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
$("#btnLeave").addEventListener("click", ()=>{ if(hostConn){ try{hostConn.close();}catch(e){} hostConn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; } document.body.classList.remove("teamed"); $("#pTeamName").hidden=true; player.me=null; player.idx=-1; show("home"); });

// ======================= AQUARIUM (pixel scene) =======================
// Sprites are 12x12 grids. Letters map to a palette; "." is transparent.
const PAL = {
  o:"#8e5ad6", O:"#6a3db0", // octopus
  y:"#ffd04a", Y:"#d9a600", // pufferfish
  g:"#58d68d", G:"#2e9e5c", // seahorse
  p:"#ff8ad4", P:"#d55aa8", // jellyfish
  r:"#ff6f61", R:"#c8463a", // crab
  w:"#ffffff", k:"#1a1a2e", s:"#f6a6c1", b:"#4fb3ff", B:"#2b7bc9", n:"#ffcf3f", N:"#d9a600", h:"#ffffff"
};
const SPR = {
  octo: [
    "....nnnn....",
    "...nwwwwn...",
    "..nnnnnnnn..",
    "..oooooooo..",
    ".oowkoowkoo.",
    ".oooooooooo.",
    ".oosoooosoo.",
    "..oooooooo..",
    "..bBbBbBbB..",
    ".oo.oo.oo.oo",
    "oo.oo.oo.oo.",
    "............"],
  puffer: [
    "....bBBb....",
    "...bwwwwb...",
    "..k.yyyy.k..",
    ".k.yyyyyy.k.",
    "..yykyykyy..",
    ".kyyyyyyyyk.",
    "..yyysssyy..",
    ".k.yyyyyy.k.",
    "..k.yyyy.k..",
    "....YYYY....",
    "...Y.YY.Y...",
    "............"],
  horse: [
    "...nnn......",
    "..nwwwn.....",
    "..gggg......",
    ".ggkgggg....",
    ".gggggg.....",
    "..gggg......",
    "...gbg......",
    "...gBg......",
    "...gbgg.....",
    "...gBggg....",
    "....ggg.....",
    "............"],
  jelly: [
    "...nnnnnn...",
    "..nwwwwwwn..",
    "..pppppppp..",
    ".pppppppppp.",
    ".ppkppppkpp.",
    ".pppppsspp..",
    ".pppppppppp.",
    "..PPPPPPPP..",
    "..p.p.p.p...",
    "...p.p.p.p..",
    "..p.p.p.p...",
    "............"],
  crab: [
    "............",
    "..k......k..",
    "..rk....kr..",
    "..rrrkkrrr..",
    "...rwkkwr...",
    "..rrrrrrrr..",
    ".rrbbrrbbrr.",
    ".rrrrrrrrrr.",
    "..rrbbrrbb..",
    ".r.r.rr.r.r.",
    "r..r....r..r",
    "............"],
  ghost: [
    "....hhhh....",
    "...hhhhhh...",
    "..hhhhhhhh..",
    "..hhkhhkhh..",
    "..hhhhhhhh..",
    "..hhhhhhhh..",
    "..hhhhhhhh..",
    "..hhhhhhhh..",
    "..hhhhhhhh..",
    "..h.hh.hh...",
    "............",
    "............"],
};
const JOKES = [
  "zzz...","quem roubou meu travesseiro?","tá na hora de dormir!","ninguém dorme hoje!","socorro, um tubarão! brincadeira","cadê a pipoca?","shhh!","to com medo do escuro","é minha vez!","essa foi fácil","hã?","roncou alguém?","mais cinco minutinhos",
];
const WRONG_JOKES = ["errou! hahaha","vai dormir, vai","até eu sabia essa","eita","péssimo","tá com sono?","xiii"];
const RIGHT_JOKES = ["acertou!","boa!","gênio!","mandou bem","uhul!","é assim que faz"];

const cv = document.getElementById("sea"), ctx = cv.getContext("2d");
const W = cv.width, H = cv.height, S = 4; // pixel scale (sprite 12px -> 48px)
const FLOOR = H - 10;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function drawSprite(name, x, y, flip){
  const g = SPR[name];
  for(let r=0;r<g.length;r++) for(let c=0;c<12;c++){
    const ch = g[r][c]; if(ch===".") continue;
    ctx.fillStyle = PAL[ch];
    const cx = flip ? x + (11-c)*S : x + c*S;
    ctx.fillRect(cx, y + r*S, S, S);
  }
}
function bubbleText(text, x, y){
  ctx.font = "12px 'Pixelify Sans', monospace";
  const w = ctx.measureText(text).width + 10; const h = 16;
  let bx = Math.max(2, Math.min(W - w - 2, x - w/2));
  ctx.fillStyle = "#fff"; ctx.fillRect(bx, y-h, w, h);
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(bx+2, y-h+2, w-4, h-4);
  ctx.fillStyle = "#fff"; ctx.fillText(text, bx+5, y-4);
  ctx.fillRect(x-2, y, 4, 3);
}

const actors = [];
function mkActor(name, x){
  return { name, x, y: FLOOR - 12*S, dir: Math.random()<.5?1:-1, speed: .25+Math.random()*.35,
    state:"walk", t:0, say:null, sayT:0, bob:Math.random()*10 };
}
["octo","puffer","horse","jelly","crab"].forEach((n,i)=>actors.push(mkActor(n, 30+i*58)));
let ghost = null, fx = [], bubbles = [];
for(let i=0;i<14;i++) bubbles.push({x:Math.random()*W, y:Math.random()*H, r:1+Math.random()*2, v:.1+Math.random()*.25});

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function makeSay(a, text, dur){ a.say=text; a.sayT=dur||150; }

function stepActor(a, dt){
  a.t += dt; a.bob += dt*.08;
  if(a.sayT>0){ a.sayT -= dt; if(a.sayT<=0) a.say=null; }
  if(a.state==="walk"){
    a.x += a.dir*a.speed*dt;
    if(a.x < 2){ a.x=2; a.dir=1; } if(a.x > W-12*S-2){ a.x=W-12*S-2; a.dir=-1; }
    if(Math.random() < .0025*dt){ a.state=pick(["idle","sleep","jump","idle","walk"]); a.t=0; if(a.state==="sleep") makeSay(a,"zzz...",220); }
    if(Math.random() < .0006*dt && !a.say) makeSay(a, pick(JOKES), 160);
  } else if(a.state==="idle"){ if(a.t>120){ a.state="walk"; a.dir=Math.random()<.5?1:-1; } }
  else if(a.state==="sleep"){ if(a.t>260){ a.state="walk"; } }
  else if(a.state==="jump"){ if(a.t>60){ a.state="walk"; } }
  // pillow fight when two meet
  if(a.state==="walk" && Math.random()<.004*dt){
    const o = actors.find(b=>b!==a && Math.abs(b.x-a.x)<14*S);
    if(o){ a.state=o.state="fight"; a.t=o.t=0; makeSay(a,"POF!",60); makeSay(o,"AI!",80); a.dir = o.x>a.x?1:-1; o.dir=-a.dir; }
  }
  if(a.state==="fight" && a.t>90){ a.state="walk"; a.dir*=-1; }
}

let last = 0;
function frame(now){
  const dt = Math.min(3, (now-last)/16.7 || 1); last = now;
  // water
  ctx.fillStyle="#0a1b3f"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#0e2552"; for(let i=0;i<W;i+=16) ctx.fillRect(i, 10+Math.sin(now/600+i/30)*2, 8, 2);
  // sand + seaweed
  ctx.fillStyle="#d9b86a"; ctx.fillRect(0,FLOOR,W,H-FLOOR); ctx.fillStyle="#b89650"; for(let i=0;i<W;i+=12) ctx.fillRect(i,FLOOR+4,4,2);
  ctx.fillStyle="#2e9e5c"; [40,150,250].forEach((sx,i)=>{ for(let k=0;k<5;k++) ctx.fillRect(sx+Math.sin(now/400+k+i)*3, FLOOR-6-k*6, 4, 6); });
  // bubbles
  bubbles.forEach(b=>{ b.y -= b.v*dt; if(b.y<-4){ b.y=H; b.x=Math.random()*W; } ctx.fillStyle="rgba(170,220,255,.5)"; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.r*2, b.r*2); });
  // actors
  if(!reduce) actors.forEach(a=>stepActor(a,dt));
  actors.forEach(a=>{
    let y = a.y; let flip = a.dir<0;
    if(a.state==="walk") y += Math.round(Math.sin(a.bob)*2);
    if(a.state==="jump") y -= Math.round(Math.abs(Math.sin(a.t/60*Math.PI))*24);
    if(a.state==="fight") y += Math.round(Math.sin(a.t/4)*2);
    if(a.state==="sleep"){ ctx.save(); ctx.translate(a.x+6*S, a.y+12*S); ctx.rotate(flip?-1.2:1.2); drawSprite(a.name,-6*S,-12*S+10,flip); ctx.restore(); }
    else drawSprite(a.name, Math.round(a.x), y, flip);
    if(a.say) bubbleText(a.say, a.x+6*S, y-4);
  });
  // ghost (sheet guy) sometimes zooms by
  if(!ghost && Math.random()<.0007*dt && !reduce){ ghost={x:-60, t:0}; }
  if(ghost){ ghost.x += 2.2*dt; ghost.t+=dt; drawSprite("ghost", ghost.x, 8+Math.sin(ghost.t/8)*6, false); bubbleText("BUUU!", ghost.x+24, 6); if(ghost.x>W+20) ghost=null; }
  // fx (confetti / sweat)
  fx = fx.filter(f=>(f.life-=dt)>0);
  fx.forEach(f=>{ f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=.05*dt; ctx.fillStyle=f.c; ctx.fillRect(Math.round(f.x),Math.round(f.y),3,3); });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function sceneReact(ok){
  if(ok){ for(let i=0;i<40;i++) fx.push({x:W/2, y:FLOOR-40, vx:(Math.random()-.5)*4, vy:-Math.random()*3-1, life:60+Math.random()*40, c:pick(["#ffcf3f","#ff6f61","#5be38a","#4fb3ff","#ff8ad4"])});
    actors.forEach(a=>{ a.state="jump"; a.t=Math.random()*20; }); makeSay(pick(actors), pick(RIGHT_JOKES), 140);
  } else {
    const a = pick(actors); makeSay(a, pick(WRONG_JOKES), 160); a.state="idle"; a.t=0;
    const b = pick(actors.filter(x=>x!==a)); b.state="sleep"; b.t=0; makeSay(b,"zzz...",200);
  }
}


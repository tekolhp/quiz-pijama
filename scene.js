// ======================= AQUARIUM (16-bit pixel scene) =======================
// Original "pajama party at the bottom of the sea" crew. Everything is drawn once into offscreen
// canvases (sprites, background tiles, props); the frame loop only blits them with drawImage.
// Public API used by app.js: actors, pick, makeSay, sceneReact, fitScene, W, H, S
// Team sprite keys: "octo","puffer","horse","jelly","crab","ghost".

// ---------- palette (characters) ----------
const P = {
  K:"#1b1233",                                // ink / outline
  W:"#f7f5ff", w:"#c3c6e6",                   // white + shade
  pk:"#ff8fb3",                               // cheeks
  o1:"#a56cf0", o2:"#6d3fc0", o3:"#d4b0ff",   // octopus
  y1:"#ffd447", y2:"#e0901c", y3:"#fff0b0",   // pufferfish
  g1:"#62dd94", g2:"#2c9a5a", g3:"#b4f5cc",   // seahorse
  p1:"#ff92d4", p2:"#c8559f", p3:"#ffd0ee",   // jellyfish
  r1:"#ff6a5c", r2:"#b8363b", r3:"#ffb0a0",   // crab
  b1:"#58b4ff", b2:"#2b66c2", n1:"#2c3c84",   // pajama blue + navy stripe
  or:"#ff9a3c", yl:"#ffe066",                 // flame / feet / stars
  s1:"#e8edff", s2:"#a5afd8",                 // bedsheet
  t1:"#5fdcbc", t2:"#2a958a", t3:"#bdf7e8",   // starfish (mint/teal)
  a1:"#a3a9b8", a2:"#6b7182", a3:"#2d2f3a",   // raccoon fur + mask
  u1:"#f2f2f6", u2:"#c4c6d4", gl:"rgba(185,225,255,.38)", gr:"#bfe8ff", // spacesuit + helmet glass
};

const JOKES = [
  "zzz...","quem roubou meu travesseiro?","tá na hora de dormir!","ninguém dorme hoje!",
  "socorro, um tubarão! brincadeira","cadê a pipoca?","shhh!","tô com medo do escuro",
  "é minha vez!","essa foi fácil","hã?","roncou alguém?","mais cinco minutinhos",
  "quem apagou a luz?","alguém viu meu chinelo?","mãe, só mais uma pergunta!","vamos contar história de terror?",
  "tem brigadeiro?","meu pijama é o mais bonito","silêncio na biblioteca... ops, no quarto",
];
const WRONG_JOKES = ["errou! hahaha","vai dormir, vai","até eu sabia essa","eita","péssimo","tá com sono?","xiii","quase... só que não"];
const RIGHT_JOKES = ["acertou!","boa!","gênio!","mandou bem","uhul!","é assim que faz","que cabeção!"];
const PILLOW_LINES = ["guerra de travesseiro!","toma essa!","em guarda!"];
const PILLOW_HITS = ["POF!","PAF!","TUM!","AI!","FLOP!"];
const PRANK_SCARED = ["AAAAH!","SOCORRO!","MÃE!!","que susto!"];
const PRANK_LAUGH = ["HAHAHA!","pegadinha!","caiu!","hihihi"];
const JOLT_LINES = ["não tava dormindo!","quem? eu? acordadíssimo!","tô de olho!","só piscando devagar..."];

// ---------- canvas & world ----------
const cv = document.getElementById("sea"), ctx = cv.getContext("2d");
const S = 2;                       // canvas units per art pixel
const H = 150;                     // logical height (canvas units)
let W = cv.width || 320;           // logical width grows with the screen
cv.height = H;
const AH = H / S;                  // art rows (75)
const GROUND = 64;                 // art row where the sand starts
const FLOOR = GROUND * S;          // feet line (canvas units)
const SPR_W = 24;                  // sprite size (art px)
const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
let dirty = true;                  // reduced-motion mode redraws only when something changed

// ---------- tiny indexed-free pixel painter (used only at prerender time) ----------
function grid(w,h){ return { w, h, d:new Array(w*h).fill(null) }; }
function px(g,x,y,c){ x=Math.round(x); y=Math.round(y); if(x>=0&&y>=0&&x<g.w&&y<g.h) g.d[y*g.w+x]=c; }
function get(g,x,y){ return (x>=0&&y>=0&&x<g.w&&y<g.h) ? g.d[y*g.w+x] : null; }
function rect(g,x,y,w,h,c){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) px(g,x+i,y+j,c); }
function inEll(x,y,cx,cy,rx,ry){ const dx=(x+.5-cx)/rx, dy=(y+.5-cy)/ry; return dx*dx+dy*dy<=1; }
function ell(g,cx,cy,rx,ry,c){
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++) for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)
    if(inEll(x,y,cx,cy,rx,ry)) px(g,x,y,c);
}
// 2-tone shaded ellipse (light from top-left) + optional highlight; maxY clips the bottom
function blob(g,cx,cy,rx,ry,c1,c2,c3,maxY){
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++){
    if(maxY!=null && y>maxY) break;
    for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
      if(!inEll(x,y,cx,cy,rx,ry)) continue;
      const lit = inEll(x,y,cx-Math.max(1.2,rx*.12),cy-Math.max(1.5,ry*.14),rx,ry);
      px(g,x,y, lit?c1:c2);
    }
  }
  if(c3){ const hx=Math.round(cx-rx*.45), hy=Math.round(cy-ry*.55); px(g,hx,hy,c3); px(g,hx+1,hy,c3); px(g,hx,hy+1,c3); }
}
function poly(g,pts,c){
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  for(let y=Math.floor(Math.min(...ys));y<=Math.ceil(Math.max(...ys));y++)
    for(let x=Math.floor(Math.min(...xs));x<=Math.ceil(Math.max(...xs));x++){
      const X=x+.5, Y=y+.5; let ins=false;
      for(let i=0,j=pts.length-1;i<pts.length;j=i++){
        const [xi,yi]=pts[i],[xj,yj]=pts[j];
        if(((yi>Y)!==(yj>Y)) && (X < (xj-xi)*(Y-yi)/(yj-yi)+xi)) ins=!ins;
      }
      if(ins) px(g,x,y,c);
    }
}
function line(g,x0,y0,x1,y1,c){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let e=dx+dy;
  for(;;){ px(g,x0,y0,c); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){e+=dy;x0+=sx;} if(e2<=dx){e+=dx;y0+=sy;} }
}
function recolor(g,fn){ for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++){ const c=g.d[y*g.w+x]; if(c){ const n=fn(c,x,y); if(n!==undefined) g.d[y*g.w+x]=n; } } }
function outline(g,c){
  const src=g.d.slice();
  for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++){
    if(src[y*g.w+x]) continue;
    const n=(xx,yy)=> xx>=0&&yy>=0&&xx<g.w&&yy<g.h && src[yy*g.w+xx];
    if(n(x-1,y)||n(x+1,y)||n(x,y-1)||n(x,y+1)) g.d[y*g.w+x]=c;
  }
}
function flipG(g){ const o=grid(g.w,g.h); for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++) o.d[y*g.w+x]=g.d[y*g.w+(g.w-1-x)]; return o; }
function rotG(g){ const o=grid(g.h,g.w); for(let y=0;y<o.h;y++) for(let x=0;x<o.w;x++) o.d[y*o.w+x]=g.d[(g.h-1-x)*g.w+y]; return o; } // clockwise
function bottomRow(g){ for(let y=g.h-1;y>=0;y--) for(let x=0;x<g.w;x++) if(g.d[y*g.w+x]) return y; return g.h-1; }
function toCanvas(g){
  const c=document.createElement("canvas"); c.width=g.w*S; c.height=g.h*S; const x2=c.getContext("2d");
  for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++){ const col=g.d[y*g.w+x]; if(col){ x2.fillStyle=col; x2.fillRect(x*S,y*S,S,S); } }
  return c;
}
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
const dither=(x,y,t)=> t*16 > BAYER[y&3][x&3]+.5;
function hex(c){ const n=parseInt(c.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
function mix(a,b,k){ const A=hex(a),B=hex(b); return "#"+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,"0")).join(""); }

// ---------- face helpers ----------
function eye(g,x,y,kind){
  if(kind==="closed"){ px(g,x,y+2,P.K); px(g,x+1,y+2,P.K); px(g,x-1,y+1,P.K); }
  else if(kind==="happy"){ px(g,x,y+1,P.K); px(g,x+1,y,P.K); px(g,x+2,y+1,P.K); }
  else if(kind==="wide"){ rect(g,x,y-1,3,4,P.W); px(g,x+1,y+1,P.K); }
  else { rect(g,x,y,2,3,P.K); px(g,x,y,P.W); }
}
function mouth(g,x,y,kind){
  if(kind==="happy"){ rect(g,x,y,3,2,P.K); px(g,x+1,y+1,P.pk); }
  else if(kind==="wide"){ rect(g,x+1,y,1,2,P.K); }
  else if(kind==="closed"){ px(g,x+1,y,P.K); }
  else { px(g,x,y,P.K); px(g,x+1,y+1,P.K); px(g,x+2,y,P.K); }
}

// ---------- character builders (24x24, facing right; f = walk frame 0..2, e = eye style) ----------
const BUILD = {
  // Purple octopus in a star-print nightcap
  octo(g,f,e){
    const lift = f===1?[1,0,1,0]: f===2?[0,1,0,1]:[0,0,0,0];
    [5,9,13,17].forEach((x,j)=>{
      const len=7-lift[j]*2;
      rect(g,x,15,3,len,P.o1); rect(g,x+2,15,1,len,P.o2);
      px(g, j<2? x-1 : x+3, 15+len-1, P.o1);           // curl
      px(g,x,17,P.o3); if(len>5) px(g,x,19,P.o3);      // suckers
    });
    blob(g,12,11,7.5,6.8,P.o1,P.o2,P.o3);
    poly(g,[[5,8],[19,8],[17,4],[13,1.5],[8,3]],P.b1);
    poly(g,[[16,2],[21,5.5],[20,7.5],[16,5]],P.b1);
    recolor(g,(c,x,y)=> (c===P.b1 && (x+y)%4===0 && y<8) ? P.n1 : undefined);
    px(g,10,4,P.yl); px(g,14,3,P.yl); px(g,18,5,P.yl);
    rect(g,5,7,15,2,P.W); rect(g,5,8,15,1,P.w);
    ell(g,20.5,8.5,1.7,1.7,P.W); px(g,21,9,P.w);
    eye(g,8,10,e); eye(g,14,10,e);
    px(g,6,13,P.pk); px(g,7,13,P.pk); px(g,17,13,P.pk); px(g,18,13,P.pk);
    mouth(g,11,14,e);
  },
  // Round pufferfish with a sleep mask pushed up on its forehead
  puffer(g,f,e){
    const tw = f===1?-1 : f===2?1 : 0;
    poly(g,[[6,12],[1,8+tw],[2.5,12.5],[1,17+tw],[6,14]],P.y2);
    for(let a=0;a<14;a++){ const ang=a/14*Math.PI*2; if(Math.cos(ang)<-.75) continue; px(g,12.5+Math.cos(ang)*8.8,13+Math.sin(ang)*8.2,P.y2); }
    blob(g,12.5,13,8,7.5,P.y1,P.y2,P.W);
    ell(g,13,17,5,2.6,P.y3);
    const fy=[15,13,17][f]; poly(g,[[11,14.5],[7,fy-1],[7.5,fy+2]],P.or);
    rect(g,10,6,10,3,P.p1); rect(g,10,8,10,1,P.p2); rect(g,5,7,5,1,P.p2); px(g,14,7,P.p2);
    eye(g,13,10,e); eye(g,17,10,e);
    px(g,15,14,P.pk);
    if(e==="open"||e==="closed"){ px(g,20,14,P.pk); px(g,20,15,P.pk); px(g,19,15,P.K); } else mouth(g,17,15,e);
  },
  // Seahorse in a polka-dot nightgown, carrying a candle
  horse(g,f,e){
    const dx=[0,-1,1][f];
    [[10,19],[10,20],[11,21],[12,22],[13,22],[14,21],[14,20],[13,20]].forEach(([x,y],i)=>px(g,x+(i>2?dx:0),y,i>5?P.g2:P.g1));
    const fy=[0,-1,1][f]; poly(g,[[8,11],[4,12+fy],[5,15+fy],[8,16]],P.g3);
    blob(g,12,14,4.5,5,P.g1,P.g2,null);
    const hem=[0,1,-1][f];
    poly(g,[[8,10],[16,10],[18,19+hem],[6,19-hem]],P.b1);
    poly(g,[[15,10],[16,10],[18,19+hem],[16,19]],P.b2);
    [[9,13],[13,12],[11,16],[15,15],[8,18],[14,18]].forEach(([x,y])=>{ if(get(g,x,y)===P.b1) px(g,x,y,P.W); });
    rect(g,8,10,9,1,P.W);
    blob(g,13,6,4.2,3.8,P.g1,P.g2,P.g3);
    rect(g,16,6,4,2,P.g1); rect(g,16,7,4,1,P.g2); px(g,20,6,P.g2); px(g,20,7,P.g2);
    px(g,10,2,P.g2); px(g,12,1,P.g2); px(g,14,2,P.g2); px(g,11,2,P.g1); px(g,13,2,P.g1);
    eye(g,13,4,e); px(g,15,8,P.pk);
    if(e==="happy"||e==="wide") px(g,20,8,P.K);
    px(g,17,12,P.g1);                                             // little fin-hand
    rect(g,18,11,2,4,P.W); rect(g,19,11,1,4,P.w); rect(g,17,15,4,1,P.or);
    if(f===0){ px(g,18,10,P.or); px(g,18,9,P.yl); px(g,19,10,P.yl); }
    else if(f===1){ px(g,18,10,P.or); px(g,19,9,P.yl); px(g,19,8,P.yl); }
    else { px(g,19,10,P.or); px(g,18,9,P.yl); px(g,18,8,P.yl); }
  },
  // Jellyfish with hair curlers hugging a whale plush
  jelly(g,f,e){
    [6,9,12,15,18].forEach((x,j)=>{ for(let y=14;y<=21;y++){ const off=((y+f+j)>>1)%2; px(g,x+off,y, j%2?P.p2:P.p1); } });
    blob(g,12,13,8.5,9,P.p1,P.p2,P.p3,14);
    for(let x=4;x<=20;x++){ px(g,x,14,P.p2); if(x%2===0) px(g,x,15,P.p2); }
    px(g,6,7,P.W); px(g,7,6,P.W);
    rect(g,7,3,3,2,P.b1); px(g,8,3,P.W); rect(g,11,2,3,2,P.yl); px(g,12,2,P.W); rect(g,15,3,3,2,P.b1); px(g,16,3,P.W);
    eye(g,8,8,e); eye(g,14,8,e);
    px(g,6,11,P.pk); px(g,18,11,P.pk);
    mouth(g,11,11,e);
    ell(g,16,16,3.2,2.3,P.b1); rect(g,14,17,5,1,P.b2); px(g,15,15,P.K);
    px(g,19,14,P.b1); px(g,20,13,P.b1); px(g,20,15,P.b1);
    px(g,13,16,P.p1); px(g,13,17,P.p1);
  },
  // Crab in striped pajama pants with a nightcap hanging on one eye stalk
  crab(g,f,e){
    const lo = f===1?[0,1,0]: f===2?[1,0,1]:[0,0,0];
    [5,7,9].forEach((x,j)=>{ rect(g,x,19,1,3-lo[j],P.r2); px(g,x-1,21-lo[j],P.r2); });
    [15,17,19].forEach((x,j)=>{ rect(g,x,19,1,3-lo[2-j],P.r2); px(g,x+1,21-lo[2-j],P.r2); });
    rect(g,4,13,3,1,P.r2); rect(g,18,13,3,1,P.r2);
    blob(g,3.5,11,2.6,2.6,P.r1,P.r2,null); blob(g,20.5,11,2.6,2.6,P.r1,P.r2,null);
    if(f===2){ px(g,3,8,null); px(g,4,9,P.K); px(g,21,8,null); px(g,20,9,P.K); } else { px(g,3,10,P.K); px(g,4,10,P.K); px(g,20,10,P.K); px(g,21,10,P.K); }
    blob(g,12,15,8,5,P.r1,P.r2,P.r3);
    recolor(g,(c,x,y)=> (y>=17 && (c===P.r1||c===P.r2)) ? (x%3===0?P.n1:(c===P.r1?P.b1:P.b2)) : undefined);
    rect(g,9,6,1,5,P.r2); rect(g,15,6,1,5,P.r2);
    ell(g,9.5,5,2,2,P.W); ell(g,15.5,5,2,2,P.W);
    [9,15].forEach(x=>{
      if(e==="closed"){ rect(g,x-1,3,3,2,P.r1); rect(g,x-1,5,3,1,P.K); }
      else if(e==="happy"){ px(g,x-1,5,P.K); px(g,x,4,P.K); px(g,x+1,5,P.K); }
      else if(e==="wide"){ px(g,x,5,P.K); }
      else { rect(g,x+1,4,1,2,P.K); }
    });
    poly(g,[[13.5,3.5],[18,3.5],[17,0.8]],P.g1); rect(g,13,3,6,1,P.W); px(g,19,1,P.W); px(g,16,2,P.g2);
    px(g,7,14,P.pk); px(g,17,14,P.pk);
    mouth(g,11,14,e);
  },
  // A little shrimp hiding under a bedsheet (antennae and feet give it away)
  ghost(g,f,e){
    line(g,10,4,8,1,P.or); line(g,14,4,16,1,P.or);
    const fo=[0,1,-1][f]; rect(g,9+fo,20,2,3,P.or); rect(g,14-fo,20,2,3,P.or);
    blob(g,12,10,7.5,7,P.s1,P.s2,P.W);
    rect(g,5,10,15,9,P.s1); rect(g,17,10,3,9,P.s2);
    for(let x=5;x<=19;x++){ px(g,x,19,x>=17?P.s2:P.s1); if(((x+f*2)>>1)%2) px(g,x,20,x>=17?P.s2:P.s1); }
    eye(g,8,9,e); eye(g,14,9,e);
    if(e==="closed") px(g,12,13,P.K); else if(e==="happy"){ rect(g,10,13,4,2,P.K); px(g,11,14,P.pk); px(g,12,14,P.pk); } else rect(g,11,13,2,2,P.K);
    px(g,7,12,P.pk); px(g,17,12,P.pk);
  },
};
// Mint starfish in a yellow-and-white striped nightgown and nightcap, sleepy half-lidded eyes
BUILD.star = function(g,f,e){
  const ll = f===1 ? -2 : 0, rl = f===2 ? -2 : 0;     // lifted leg per walk frame
  const pts = [[12,2],[14.2,7.5],[21.5,8.5],[16,12.5],[18+(f===2?1:0),21+rl],[12,16.5],[6-(f===1?1:0),21+ll],[8,12.5],[2.5,8.5],[9.8,7.5]];
  poly(g,pts,P.t2);
  recolor(g,(c,x,y)=> (c===P.t2 && get(g,x+1,y+1)===P.t2 && get(g,x+1,y)===P.t2) ? P.t1 : undefined);
  [[5,9],[19,9],[8,18],[16,18]].forEach(([x,y])=>{ if(get(g,x,y)) px(g,x,y,P.t3); });
  // nightgown: trapezoid with horizontal stripes, arms and legs poke out
  const hem=[0,1,-1][f];
  poly(g,[[8.5,11],[15.5,11],[17.5,19+hem],[6.5,19-hem]],P.yl);
  recolor(g,(c,x,y)=> (c===P.yl && y>=11) ? ((y>>1)%2 ? P.W : (x>=15 ? P.y2 : P.yl)) : undefined);
  rect(g,9,11,6,1,P.W); px(g,12,12,P.pk);
  // nightcap flopping to the right, white brim and pompom
  poly(g,[[8,6.2],[16,6.2],[13.5,1],[10.5,1.2]],P.yl);
  poly(g,[[12.5,1.5],[19,3],[18,5],[14,4.5]],P.y2);
  rect(g,8,5,9,2,P.W); rect(g,8,6,9,1,P.w);
  ell(g,19.5,4,1.6,1.6,P.W); px(g,20,5,P.w);
  // face
  [9,14].forEach(x=>{
    if(e==="open"){ rect(g,x,8,2,1,P.t2); rect(g,x,9,2,1,P.K); }
    else if(e==="wide"){ rect(g,x,8,2,2,P.W); px(g,x+1,9,P.K); }
    else eye(g,x,7,e);
  });
  px(g,7,10,P.pk); px(g,17,10,P.pk);
  if(e==="happy"){ rect(g,11,10,3,1,P.K); } else if(e==="wide"){ px(g,12,10,P.K); } else { px(g,11,10,P.K); px(g,12,10,P.K); }
};
// Raccoon astronaut: orange-and-white suit, chest panel, air tank, glass helmet, fuzzy slippers
BUILD.racc = function(g,f,e){
  const tw = [0,1,-1][f];
  // ringed tail poking out of the back of the suit
  for(let i=0;i<8;i++){ const x=7-i, y=19-Math.round(i*.6)+(i>4?tw:0), c=(i>>1)%2 ? P.a3 : P.a1; px(g,x,y,c); px(g,x,y+1,c===P.a1?P.a2:P.a3); if(i>1) px(g,x,y-1,c); }
  // backpack air tank
  rect(g,3,10,4,8,P.u2); rect(g,3,10,1,8,P.u1); rect(g,4,9,2,1,P.a2); rect(g,3,13,4,1,P.or);
  // legs + fuzzy slippers (one lifts per walk frame)
  [[8,f===1?-1:0],[13,f===2?-1:0]].forEach(([x,l])=>{
    rect(g,x,19+l,3,2,P.u2); rect(g,x,19+l,1,2,P.u1);
    rect(g,x-1,21+l,5,2,P.pk); px(g,x-1,21+l,P.p3); px(g,x+1,21+l,P.p3); px(g,x+3,21+l,P.p3); px(g,x+4,22+l,P.p2);
  });
  // suit body: white with orange shoulders and belt
  blob(g,11.5,15.5,5.5,4.5,P.u1,P.u2,P.W);
  recolor(g,(c,x,y)=> (y===18 && (c===P.u1||c===P.u2)) ? P.or : undefined);
  rect(g,6,12,3,2,P.or); rect(g,15,12,3,2,P.or);
  // front arm + glove
  const ay=[0,1,-1][f]; rect(g,15,14+ay,2,3,P.u1); rect(g,15,17+ay,2,1,P.or);
  // chest control panel
  rect(g,9,14,5,3,P.a3); px(g,10,15,"#ff5a5a"); px(g,11,15,P.g1); px(g,12,15,P.yl); rect(g,10,16,3,1,P.b1);
  // helmet glass (translucent) with the head inside
  ell(g,11.5,6.5,6.5,6,P.gl);
  blob(g,11.5,7.5,4.5,3.8,P.a1,P.a2,null);
  px(g,8,3,P.a2); px(g,8,4,P.a1); px(g,9,4,P.a1); px(g,14,3,P.a2); px(g,14,4,P.a1); px(g,13,4,P.a1);   // ears
  rect(g,8,6,8,2,P.a3);                                                                       // eye mask
  ell(g,14,9,2.2,1.4,P.W); px(g,16,8,P.K);                                                     // snout + nose
  [9,12].forEach(x=>{
    if(e==="closed"){ rect(g,x,7,2,1,P.a1); }
    else if(e==="happy"){ px(g,x,7,P.W); px(g,x+1,6,P.W); }
    else if(e==="wide"){ rect(g,x,5,2,3,P.W); px(g,x+1,6,P.K); }
    else { rect(g,x,6,2,2,P.W); px(g,x+1,7,P.K); }
  });
  px(g,9,9,P.pk);
  if(e==="happy"){ px(g,13,10,P.K); px(g,14,10,P.K); px(g,15,10,P.K); } else if(e==="wide"){ rect(g,14,10,1,2,P.K); } else { px(g,14,10,P.K); }
  // glass rim + visor reflection
  for(let y=0;y<14;y++) for(let x=4;x<20;x++) if(inEll(x,y,11.5,6.5,6.5,6) && !inEll(x,y,11.5,6.5,5.6,5.1) && !(get(g,x,y)||"").startsWith("#")) px(g,x,y,P.gr);
  px(g,9,1,P.W); px(g,8,2,P.W); px(g,7,3,P.W); px(g,7,4,P.W); px(g,17,9,P.W); px(g,16,10,P.gr);
  rect(g,8,12,8,1,P.or);                                                                      // collar ring
};
const HOVER = { puffer:3, jelly:2, ghost:1 };   // floaters hover above the sand

// Prerender every frame of every character (right + left) once
const SPR = {};
function framePair(g){ return { r:toCanvas(g), l:toCanvas(flipG(g)), b:bottomRow(g) }; }
Object.keys(BUILD).forEach(name=>{
  const mk=(f,e)=>{ const g=grid(SPR_W,SPR_W); BUILD[name](g,f,e); outline(g,P.K); return g; };
  SPR[name] = {
    walk:[0,1,2].map(f=>framePair(mk(f,"open"))),
    blink:framePair(mk(0,"closed")),
    happy:framePair(mk(1,"happy")),
    wide:framePair(mk(0,"wide")),
    lie:framePair(rotG(mk(0,"closed"))),
  };
});

// ---------- props ----------
const PROP = {};
(()=>{
  let g=grid(13,9); rect(g,1,2,11,5,P.b1); rect(g,1,6,11,1,P.b2); rect(g,10,2,2,5,P.b2); px(g,0,1,P.b1); px(g,12,1,P.b2); px(g,0,7,P.b2); px(g,12,7,P.b2);
  rect(g,1,4,11,1,P.W); px(g,2,3,P.W); outline(g,P.K); PROP.pillow=toCanvas(g);
  g=grid(24,24);
  blob(g,12,9,8.5,7.5,P.s1,P.s2,P.W); rect(g,4,9,17,11,P.s1); rect(g,18,9,3,11,P.s2);
  for(let x=4;x<=20;x++){ if(x%3) px(g,x,20,x>=18?P.s2:P.s1); if(x%3===1) px(g,x,21,P.s1); }
  rect(g,13,8,2,3,P.K); rect(g,17,8,2,3,P.K); px(g,14,9,P.W); px(g,18,9,P.W); rect(g,15,13,2,1,P.K);
  outline(g,P.K); PROP.sheet={ r:toCanvas(g), l:toCanvas(flipG(g)) };
  g=grid(24,8); blob(g,12,6,10.5,3.5,P.s1,P.s2,P.W,6); rect(g,2,6,21,1,P.s2); rect(g,8,4,2,1,P.K); rect(g,13,4,2,1,P.K); outline(g,P.K); PROP.sheetFlat=toCanvas(g);
  g=grid(16,3); ell(g,8,1.5,8,1.5,"rgba(5,10,30,.35)"); PROP.shadow=toCanvas(g);
  // bubbles
  PROP.bub=[2,3,5].map(r=>{ const n=r*2+1; const b=grid(n,n); ell(b,r+.5,r+.5,r+.5,r+.5,"#9fd8ff"); ell(b,r+.5,r+.5,r-.5,r-.5,r>2?"rgba(160,215,255,.25)":"rgba(160,215,255,.4)"); px(b,r-1,r-1,P.W); if(r>2) px(b,r-1,r-2,P.W); return toCanvas(b); });
  // fish (school)
  PROP.fish=[0,1].map(fr=>{ const f=grid(11,7); poly(f,[[3,3.5],[0,fr?0.5:1.5],[0,fr?5.5:6.5]],"#4f86c9"); blob(f,6.5,3.5,4,2.4,"#a6dcff","#5d93d6",null); rect(f,6,2,1,3,P.yl); px(f,9,2,P.K); return { r:toCanvas(f), l:toCanvas(flipG(f)) }; });
  // glow (dithered disc)
  const glow=r=>{ const n=r*2+1, q=grid(n,n); for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const d=Math.hypot(x-r,y-r)/r; if(d<1 && dither(x,y,(1-d)*.9)) px(q,x,y,"#ffd36b"); } return toCanvas(q); };
  PROP.glow=glow(14); PROP.glowS=glow(7);
  // light ray (dithered wedge)
  g=grid(40,AH); for(let y=0;y<AH;y++){ const k=y/AH, x0=14-14*k, x1=26+14*k; for(let x=Math.floor(x0);x<x1;x++) if(dither(x,y,(1-k)*.4)) px(g,x,y,"#7fc8ff"); } PROP.ray=toCanvas(g);
  // seaweed segments: two leafy variants per type
  const seg=(c1,c2,c3,side)=>{ const s=grid(5,5); rect(s,1,0,3,5,c1); rect(s,3,0,1,5,c2); rect(s,1,0,1,5,c3); if(side) { px(s,4,1,c1); px(s,4,2,c2); } else { px(s,0,2,c1); px(s,0,3,c3); } return toCanvas(s); };
  PROP.weed=[ [seg("#4fcf7f","#2b9058","#1d6a43",0),seg("#4fcf7f","#2b9058","#1d6a43",1)],
              [seg("#3fae8a","#24785f","#175443",0),seg("#3fae8a","#24785f","#175443",1)] ];
})();

// ---------- background tiles (prerendered once) ----------
const BG = {};
(()=>{
  // FAR: dithered night-water gradient, distant ridges and kelp silhouettes
  const FW=192, g=grid(FW,AH);
  const bands=["#18468a","#113572","#0c2858","#081d44","#061532"];
  for(let y=0;y<AH;y++){ const t=y/(AH-1)*(bands.length-1), i=Math.min(bands.length-2,Math.floor(t)); for(let x=0;x<FW;x++) px(g,x,y, dither(x,y,t-i)?bands[i+1]:bands[i]); }
  const TAU=Math.PI*2;
  for(let x=0;x<FW;x++){
    const h1=46+5*Math.sin(TAU*x/96)+3*Math.sin(TAU*x/64+1)+1.5*Math.sin(TAU*x/32);
    const h2=54+4*Math.sin(TAU*x/48+2)+2*Math.sin(TAU*x/24);
    for(let y=Math.round(h1);y<AH;y++) px(g,x,y, dither(x,y,.6)?"#0f2c60":"#0c2552");
    for(let y=Math.round(h2);y<AH;y++) px(g,x,y, dither(x,y,.7)?"#0a2049":"#0d2756");
  }
  [[18,24],[70,30],[122,22],[165,28]].forEach(([x0,top])=>{ for(let y=top;y<60;y++){ const x=x0+Math.round(Math.sin(y/5)*2); px(g,x,y,"#0e2a5c"); px(g,x+1,y,"#0e2a5c"); if(y%6===0) px(g,x+2,y,"#0e2a5c"); } });
  BG.far=toCanvas(g);

  // MID: houses, coral, rocks, bunting (transparent tile)
  const MW=420, m=grid(MW,AH), INK="#0a1430";
  const WOOD="#8a5530", WOOD2="#5e3820", LIT="#ffd56b";
  const door=(cx,top,w)=>{ rect(m,cx-w/2,top,w,64-top,WOOD); ell(m,cx,top,w/2,3,WOOD); for(let x=cx-w/2+2;x<cx+w/2;x+=3) rect(m,x,top,1,64-top,WOOD2); px(m,cx+w/2-2,top+6,P.yl); };
  const windows=[];      // lit windows are added after the depth tint
  const win=(x,y,r)=>windows.push([x,y,r]);
  // 1) lantern-fish house
  poly(m,[[26,46],[10,30],[15,46],[10,62]],"#2f6a82");
  poly(m,[[38,31],[47,20],[52,25],[58,21],[64,30]],"#2f6a82");
  blob(m,52,47,30,17.5,"#4d93a8","#2f6a82",null,64);
  recolor(m,(c,x,y)=> (c==="#4d93a8" && inEll(x,y,54,58,24,8)) ? "#7fc0cc" : undefined);
  poly(m,[[44,50],[33,58],[46,57]],"#2f6a82");
  line(m,70,56,82,52,"#2f6a82");
  ell(m,73,40,5.5,5.5,P.W); ell(m,74,41.5,2.5,2.5,P.K); px(m,73,40,P.W);
  recolor(m,(c,x,y)=> (inEll(x,y,73,40,5.5,5.5) && y<39) ? "#2f6a82" : undefined);
  door(63,53,8);
  win(38,44,3.5); win(50,39,3);
  for(let i=0;i<=20;i++){ const t=i/20, x=(1-t)*(1-t)*68+2*(1-t)*t*70+t*t*88, y=(1-t)*(1-t)*31+2*(1-t)*t*6+t*t*14; px(m,x,y,"#2f6a82"); px(m,x+1,y,"#2f6a82"); }
  // 2) coral cluster
  const branch=(x,y,len,ang,d)=>{ const x1=x+Math.cos(ang)*len, y1=y+Math.sin(ang)*len; line(m,x,y,x1,y1,"#ff6f91"); line(m,x+1,y,x1+1,y1,"#b83c63"); if(d>0){ branch(x1,y1,len*.7,ang-.55,d-1); branch(x1,y1,len*.7,ang+.5,d-1); } };
  branch(104,64,9,-Math.PI/2,3); branch(114,64,7,-Math.PI/2-.3,2);
  [[121,10],[125,15],[129,8]].forEach(([x,h])=>{ rect(m,x,64-h,3,h,"#ff9f4a"); rect(m,x+2,64-h,1,h,"#c46a22"); px(m,x+1,64-h,P.K); });
  // 3) teapot house
  ell(m,148,50,7,9,"#c88c86"); ell(m,148,50,4,6,null);
  poly(m,[[190,57],[192,47],[204,36],[209,37],[197,58]],"#c88c86"); poly(m,[[192,52],[203,38],[206,38],[194,54]],"#f0c4b4");
  blob(m,172,53,25,14,"#f0c4b4","#c88c86",P.W,64);
  for(let x=152;x<=192;x+=6) if(get(m,x,46)) ell(m,x,46,1.5,1.5,"#6aa5d8");
  blob(m,172,39,14,4.5,"#f0c4b4","#c88c86",null); blob(m,172,33,3,3,"#6aa5d8","#3d6fa3",P.W);
  door(172,54,10); win(157,50,3); win(187,50,3);
  // 4) rocks
  blob(m,222,60,10,6,"#5a6f8e","#3d4d68",null,64); blob(m,231,62,6,4,"#5a6f8e","#3d4d68",null,64);
  // 5) seashell (scallop) house
  for(let y=36;y<=64;y++) for(let x=236;x<=288;x++){ if(!inEll(x,y,262,64,25,28)) continue; const ang=Math.atan2(y-68,x-262); const rib=Math.floor((ang+Math.PI)/(Math.PI/10))%2; px(m,x,y, x>270 ? (rib?"#cf8667":"#b06a52") : (rib?"#f7b994":"#cf8667")); }
  poly(m,[[244,64],[244,57],[252,60],[252,64]],"#cf8667"); poly(m,[[280,64],[280,57],[272,60],[272,64]],"#b06a52");
  door(262,55,8); win(262,45,3.5);
  // 6) sunken submarine
  rect(m,357,22,2,13,"#4a6f62"); rect(m,357,21,6,3,"#4a6f62"); px(m,362,22,P.W);
  rect(m,338,34,20,11,"#6f9c8a"); rect(m,354,34,4,11,"#4a6f62"); ell(m,348,34,10,2,"#6f9c8a");
  blob(m,352,54,44,11.5,"#6f9c8a","#4a6f62",P.W,64);
  ell(m,328,58,3,2,"#b36a3f"); ell(m,374,47,2,1.5,"#b36a3f"); ell(m,388,57,2,2,"#b36a3f");
  poly(m,[[308,50],[300,44],[302,52],[300,60],[308,56]],"#4a6f62");
  for(let x=316;x<392;x+=8) px(m,x,47,"#2f4a42");
  [[326,53],[340,53],[354,53],[368,53],[382,53]].forEach(([x,y],i)=>{ if(i===3){ ell(m,x,y,3.3,3.3,"#c9b27a"); ell(m,x,y,2.4,2.4,"#1b2a4a"); } else win(x,y,2.6); });
  // depth tint: push everything a bit toward the water colour
  recolor(m,c=> c.startsWith("#") ? mix(c,"#0b2350",.22) : undefined);
  windows.forEach(([x,y,r])=>{ ell(m,x,y,r+1,r+1,"#c9b27a"); ell(m,x,y,r,r,LIT); px(m,x-1,y-1,P.W); });
  ell(m,88,16,3,3,P.yl); px(m,87,15,P.W); px(m,88,16,P.W);
  outline(m,INK);
  // bunting between teapot knob, shell top and periscope
  const string=(x0,y0,x1,y1,sag,ci)=>{ const n=Math.ceil(Math.abs(x1-x0)); for(let i=0;i<=n;i++){ const t=i/n, x=x0+(x1-x0)*t, y=y0+(y1-y0)*t+sag*Math.sin(Math.PI*t); px(m,x,y,"#c9c3e6");
      if(i%7===3){ const c=[P.pk,P.yl,P.b1,P.g1,P.o1][(ci+i/7|0)%5]; rect(m,x-1,y+1,3,1,c); rect(m,x-1,y+2,2,1,c); px(m,x,y+3,c); } } };
  string(172,30,262,35,10,0); string(262,35,358,20,9,2);
  BG.mid=toCanvas(m); BG.midW=MW;
  BG.glows=[[88,16,0],[38,44,1],[50,39,2],[157,50,3],[187,50,4],[262,45,5],[326,53,6],[340,53,7],[354,53,8],[382,53,9]];
  BG.spouts=[[207,35],[360,20]];

  // FORE: sand with pebbles and little shells
  const SW=128, s=grid(SW,AH), r=rng(7);
  for(let x=0;x<SW;x++){
    const top=GROUND+Math.round(Math.sin(TAU*x/64)*.8+Math.sin(TAU*x/32+1)*.6);
    for(let y=top;y<AH;y++){ const d=y-top; px(s,x,y, d===0?"#f4dc9c": d<5?(dither(x,y,d/5)?"#d9b46c":"#e6c47e"): d<9?(dither(x,y,(d-5)/4)?"#b8924e":"#d9b46c"):"#b8924e"); }
  }
  for(let i=0;i<26;i++) px(s,Math.floor(r()*SW),GROUND+2+Math.floor(r()*9),"#9a7a42");
  const shells=[[14,"scallop"],[47,"snail"],[83,"clam"],[110,"scallop"]];
  shells.forEach(([x,k])=>{ const y=GROUND+3+Math.floor(r()*4);
    if(k==="scallop"){ ell(s,x,y+2,3,3,"#f4a7b0"); rect(s,x-3,y+2,7,2,null); for(let i=-2;i<=2;i+=2) px(s,x+i,y,"#c96f80"); px(s,x,y+2,"#c96f80"); }
    else if(k==="snail"){ ell(s,x,y,2.5,2.5,"#e8d0a0"); px(s,x,y,"#8a6a3c"); px(s,x+1,y-1,"#8a6a3c"); px(s,x+3,y+1,"#e8d0a0"); }
    else { ell(s,x,y,3,1.6,P.W); px(s,x,y,"#b9c0e0"); px(s,x-1,y+1,"#b9c0e0"); } });
  BG.fore=toCanvas(s);
})();

// ---------- actors ----------
const actors = [];
function mkActor(name, x){
  return { name, x, y: FLOOR - SPR_W*S, dir: Math.random()<.5?1:-1, speed: .3+Math.random()*.35,
    state:"walk", t:0, say:null, sayT:0, bob:Math.random()*10, dist:Math.random()*30, blinkT:60+Math.random()*200, target:null };
}
["octo","puffer","horse","jelly","crab","ghost","star","racc"].forEach((n,i)=>actors.push(mkActor(n, 30+i*58)));

let weeds = [], fx = [], bubbles = [], props = [], school = null, schoolCool = 240, gagCool = 420 + Math.random()*300;
function layoutWeeds(){
  const r=rng(3); weeds=[];
  for(let x=10+r()*30; x<W; x+=70+r()*90) weeds.push({ x:Math.round(x/S)*S, n:4+Math.floor(r()*6), type:r()<.5?0:1, ph:r()*6, front:false });
  for(let x=60+r()*80; x<W; x+=200+r()*200) weeds.push({ x:Math.round(x/S)*S, n:2+Math.floor(r()*2), type:0, ph:r()*6, front:true });
}

// Full-width world: keep the pixel size constant and widen the world instead of stretching it.
function fitScene(){
  const box = cv.parentElement; const pxw = (box && box.clientWidth) || 320;
  const targetH = pxw<700 ? Math.max(170, Math.min(230, Math.round(pxw*0.5))) : Math.max(130, Math.min(260, Math.round(pxw*0.26)));   // display height in css px
  const zoom = targetH / H;                                             // css px per world unit
  W = Math.max(320, Math.ceil(pxw / zoom / S) * S);
  cv.width = W; cv.height = H; cv.style.height = targetH+"px"; cv.style.width = "100%";
  ctx.imageSmoothingEnabled = false;                                    // resizing resets ctx state
  actors.forEach(a=>{ a.x = Math.max(2, Math.min(a.x, W-SPR_W*S-2)); });
  layoutWeeds(); dirty = true;
}
window.addEventListener("resize", fitScene);
fitScene();
actors.forEach((a,i)=>{ a.x = Math.round((i+0.5)*(W/actors.length)) - SPR_W*S/2; });
for(let i=0;i<Math.round(W/40);i++) bubbles.push(newBubble(Math.random()*W, Math.random()*FLOOR));

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function makeSay(a, text, dur){ if(!a) return; a.say=text; a.sayT=dur||150; dirty=true; }

function newBubble(x,y){ return { x, y, v:.15+Math.random()*.35, s:Math.random()<.6?0:Math.random()<.7?1:2, ph:Math.random()*6 }; }
function burst(x,y,n,kind,colors){
  for(let i=0;i<n;i++) fx.push({ x, y, vx:(Math.random()-.5)*(kind==="feather"?2:4), vy:-Math.random()*(kind==="feather"?1.5:3)-.5,
    life:60+Math.random()*50, c: colors?pick(colors):"#f7f5ff", kind });
}

// ---------- behaviour ----------
const FREE = s => s==="walk" || s==="idle";
function startGag(){
  const free = actors.filter(a=>FREE(a.state) && !a.say);
  const kind = pick(["pillow","prank","doze","pillow","prank"]);
  if(kind==="doze" || free.length<2){ const a=pick(free); if(a){ a.state="doze"; a.t=0; } return; }
  const a = pick(free), others = free.filter(b=>b!==a);
  const b = others.sort((p,q)=>Math.abs(p.x-a.x)-Math.abs(q.x-a.x))[0];
  if(kind==="pillow"){ a.state="seek"; a.t=0; a.target=b; b.state="wait"; b.t=0; makeSay(a, pick(PILLOW_LINES), 90); }
  else { a.state="sneak"; a.t=0; a.target=b; b.state="wait"; b.t=0; b.dir = b.x>a.x?1:-1; makeSay(a,"hihihi...",80); }
}
function moveActor(a, v, dt){
  a.x += a.dir*v*dt; a.dist += v*dt;
  if(a.x < 2){ a.x=2; a.dir=1; } if(a.x > W-SPR_W*S-2){ a.x=W-SPR_W*S-2; a.dir=-1; }
}
function stepActor(a, dt){
  a.t += dt; a.bob += dt*.08; a.blinkT -= dt; if(a.blinkT < -7) a.blinkT = 90+Math.random()*220;
  if(a.sayT>0){ a.sayT -= dt; if(a.sayT<=0) a.say=null; }
  const tg = a.target;
  switch(a.state){
    case "walk":
      moveActor(a, a.speed, dt);
      if(Math.random() < .002*dt){ a.state=pick(["idle","idle","jump","walk"]); a.t=0; }
      if(Math.random() < .0005*dt && !a.say) makeSay(a, pick(JOKES), 160);
      break;
    case "idle": if(a.t>120){ a.state="walk"; a.dir=Math.random()<.5?1:-1; } break;
    case "wait": if(a.t>520){ a.state="walk"; } break;
    case "seek":
      if(!tg || a.t>500){ a.state="walk"; break; }
      a.dir = tg.x>a.x?1:-1;
      if(Math.abs(tg.x-a.x) < 34){
        a.state=tg.state="fight"; a.t=tg.t=0; tg.dir=-a.dir; makeSay(a,pick(PILLOW_HITS),60); makeSay(tg,pick(PILLOW_HITS),70);
      } else moveActor(a, .95, dt);
      break;
    case "fight":
      if(Math.floor(a.t/8)!==Math.floor((a.t-dt)/8) && Math.random()<.5) burst(a.x+SPR_W*S/2+a.dir*18, FLOOR-34, 3, "feather");
      if(Math.random()<.012*dt) makeSay(a, pick(PILLOW_HITS), 40);
      if(a.t>120){ a.state="walk"; a.dir*=-1; a.target=null; }
      break;
    case "sneak":
      if(!tg || a.t>700){ a.state="walk"; break; }
      a.dir = tg.x>a.x?1:-1;
      if(Math.abs(tg.x-a.x) < 36){
        makeSay(a,"BUUUU!",70); tg.state="scared"; tg.t=0; makeSay(tg, tg.name==="ghost" ? "ei, esse visual é meu!" : pick(PRANK_SCARED), 90);
        props.push({ kind:"sheet", x:a.x, life:260 }); a.state="laugh"; a.t=0; a.target=null;
      } else moveActor(a, .45, dt);
      break;
    case "scared": if(a.t>55){ a.state="run"; a.t=0; } break;
    case "run": moveActor(a, 1.7, dt); if(a.t>80){ a.state="walk"; } break;
    case "laugh": if(a.t>15 && a.t-dt<=15) makeSay(a, pick(PRANK_LAUGH), 90); if(a.t>110){ a.state="walk"; } break;
    case "doze":
      if(a.t>170){ if(Math.random()<.55){ a.state="sleep"; a.t=0; } else { a.state="jolt"; a.t=0; makeSay(a, pick(JOLT_LINES), 120); } }
      break;
    case "jolt": if(a.t>50){ a.state="walk"; } break;
    case "sleep":
      if(Math.floor(a.t/55)!==Math.floor((a.t-dt)/55)) fx.push({ x:a.x+(a.dir>0?40:8), y:FLOOR-14, vx:.25, vy:-.45, life:70, c:"#f7f5ff", kind:"z" });
      if(a.t>320){ a.state="walk"; if(Math.random()<.4) makeSay(a,"já é de manhã?",100); }
      break;
    case "jump": if(a.t>60){ a.state="walk"; } break;
    default: a.state="walk";
  }
}

// ---------- drawing ----------
function poseOf(a){
  const sp = SPR[a.name] || SPR.octo, st = a.state;
  let fr = sp.walk[0], dy = 0, dx = 0;
  const still = reduce;
  if(st==="sleep") return { fr:sp.lie, dy:0, dx:0, lie:true };
  if(st==="jump"){ fr=sp.happy; if(!still) dy=-Math.round(Math.abs(Math.sin(a.t/60*Math.PI))*12); }
  else if(st==="laugh"){ fr=sp.happy; if(!still) dy=-(Math.floor(a.t/5)%2); }
  else if(st==="scared"){ fr=sp.wide; if(!still) dy=-Math.round(Math.abs(Math.sin(a.t/55*Math.PI))*16); }
  else if(st==="jolt"){ fr=sp.wide; if(!still) dy=-Math.round(Math.abs(Math.sin(a.t/50*Math.PI))*5); }
  else if(st==="doze"){ fr=sp.blink; if(!still){ dy=Math.floor(a.t/40)%2; dx=Math.round(Math.sin(a.t/30)); } }
  else if(st==="fight"){ fr=sp.walk[1+Math.floor(a.t/6)%2]; if(!still) dx=(Math.floor(a.t/3)%2)*a.dir; }
  else if(st==="walk"||st==="seek"||st==="run"||st==="sneak"){
    const floaty = HOVER[a.name];
    const step = floaty ? Math.floor(a.t/10)%4 : Math.floor(a.dist/7)%4;
    fr = still ? sp.walk[0] : sp.walk[[0,1,0,2][step]];
    if(!still) dy = floaty ? Math.round(Math.sin(a.bob)*1.5) : (step%2 ? -1 : 0);
    if(a.blinkT<0) fr = step%2 ? fr : sp.blink;
  } else { if(a.blinkT<0) fr=sp.blink; if(HOVER[a.name] && !still) dy=Math.round(Math.sin(a.bob)*1.5); }
  return { fr, dy, dx, lie:false };
}
function tileRow(img, off, y){ const w=img.width; let x=((off%w)+w)%w - w; for(; x<W; x+=w) ctx.drawImage(img, x, y||0); }
function drawZ(x,y,c){ ctx.fillStyle=c; ctx.fillRect(x,y,3*S,S); ctx.fillRect(x+S,y+S,S,S); ctx.fillRect(x,y+2*S,3*S,S); }
function bubbleText(text, x, y, taken){
  ctx.font = "13px 'Pixelify Sans', monospace";
  const w = Math.ceil(ctx.measureText(text).width) + 12, h = 18;
  let top = Math.round(Math.max(2, y - h - 4)); const bx = Math.round(Math.max(2, Math.min(W - w - 2, x - w/2)));
  // nudge upward (or down if no room) so bubbles never cover each other
  if(taken){ for(let k=0;k<6;k++){ const hit = taken.find(r=> bx < r[0]+r[2]+2 && r[0] < bx+w+2 && top < r[1]+r[3]+4 && r[1] < top+h+4);
      if(!hit) break; top = hit[1]-h-6 >= 2 ? hit[1]-h-6 : hit[1]+hit[3]+6; }
    taken.push([bx,top,w,h]); }
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(bx+2, top+2, w, h);
  ctx.fillStyle = "#f7f5ff"; ctx.fillRect(bx, top, w, h);
  ctx.fillStyle = "#1b1233"; ctx.fillRect(bx+2, top+2, w-4, h-4);
  const tx = Math.round(Math.max(bx+4, Math.min(bx+w-8, x-2)));
  ctx.fillStyle = "#f7f5ff"; ctx.fillRect(tx, top+h, 4, 2); ctx.fillRect(tx+1, top+h+2, 2, 2);
  ctx.textBaseline = "alphabetic"; ctx.fillText(text, bx+6, top+h-5);
}

function draw(now){
  const tm = reduce ? 0 : now;
  const sw = reduce ? 0 : Math.sin(tm/6500);
  const offFar = Math.round(sw*1)*S, offMid = Math.round(sw*3)*S - 40, offFg = Math.round(sw*6)*S;
  // far water + rays
  tileRow(BG.far, offFar);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for(let i=0;i<Math.max(3,Math.round(W/170));i++){
    const rx = ((i+.35)/Math.max(3,Math.round(W/170)))*W + Math.sin(tm/5200+i*1.7)*24 - 40;
    ctx.globalAlpha = .08 + .05*Math.sin(tm/1400 + i*2.1);
    ctx.drawImage(PROP.ray, Math.round(rx/S)*S, 0);
  }
  ctx.restore();
  // surface shimmer
  ctx.fillStyle = "rgba(170,220,255,.35)";
  for(let x=0;x<W;x+=26) ctx.fillRect(Math.round((x + Math.sin(tm/700 + x/40)*4)/S)*S, 2*S + (Math.round(x/26)%2)*S, 5*S, S);
  // fish school (behind the houses)
  if(school){ school.fish.forEach((f,i)=>{ const img = PROP.fish[Math.floor(tm/160+i)%2][school.dir>0?"r":"l"];
    ctx.drawImage(img, Math.round((school.x - school.dir*f.dx)/S)*S, Math.round((school.y + f.dy + Math.sin(tm/380+i)*3)/S)*S); }); }
  // mid houses + glows
  tileRow(BG.mid, offMid);
  const mw = BG.mid.width;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for(let base = ((offMid%mw)+mw)%mw - mw; base < W; base += mw){
    BG.glows.forEach(([gx,gy,ph])=>{ const img = ph===0 ? PROP.glow : PROP.glowS, half = (img.width/S>>1)*S;
      ctx.globalAlpha = ph===0 ? .3+.2*Math.sin(tm/600) : .2+.06*Math.sin(tm/900+ph);
      ctx.drawImage(img, base + gx*S - half, gy*S - half); });
  }
  ctx.restore();
  // sand
  tileRow(BG.fore, offFg);
  // back seaweed
  const drawWeed = wd => { const segs = PROP.weed[wd.type];
    for(let k=0;k<wd.n;k++){ const ox = reduce ? 0 : Math.round(Math.sin(tm/750 + wd.ph + k*.55)*k*.45);
      ctx.drawImage(segs[k%2], wd.x + offFg + ox*S, FLOOR + 2*S - (k+1)*5*S); } };
  weeds.forEach(wd=>{ if(!wd.front) drawWeed(wd); });
  // props on the floor
  props.forEach(p=>{ ctx.globalAlpha = Math.min(1, p.life/40); ctx.drawImage(PROP.sheetFlat, Math.round(p.x)+offFg, FLOOR - 4*S); ctx.globalAlpha = 1; });
  // actors
  const heads = [];
  actors.forEach(a=>{
    const p = poseOf(a), side = a.dir<0 ? "l" : "r", hov = p.lie ? 0 : (HOVER[a.name]||0);
    const x = Math.round(a.x/S)*S + offFg + p.dx*S;
    const y = FLOOR + S - (p.fr.b+1)*S - hov*S + p.dy*S;
    const lift = Math.max(0, -p.dy) + hov;
    ctx.globalAlpha = Math.max(.25, 1 - lift/20); ctx.drawImage(PROP.shadow, x + 4*S, FLOOR + S); ctx.globalAlpha = 1;
    if(p.lie) ctx.drawImage(PROP.pillow, a.dir<0 ? x - 2*S : x + 13*S, FLOOR - 7*S);
    if(a.state==="sneak") ctx.drawImage(PROP.sheet[side], x, y - S + (reduce?0:-Math.round(Math.abs(Math.sin(a.t/9))*2)*S));
    else ctx.drawImage(p.fr[side], x, y);
    if(a.state==="fight"){ const up = Math.floor(a.t/8)%2; ctx.drawImage(PROP.pillow, x + (a.dir>0 ? 15*S : -4*S), y + (up ? 3 : 9)*S); }
    heads.push([a, x + SPR_W*S/2, p.lie ? FLOOR - 12*S : y + 2*S]);
  });
  weeds.forEach(wd=>{ if(wd.front) drawWeed(wd); });
  // bubbles
  bubbles.forEach(b=>{ const img = PROP.bub[b.s]; ctx.drawImage(img, Math.round((b.x + Math.sin(tm/500 + b.ph)*3)/S)*S, Math.round(b.y/S)*S); });
  // fx: confetti, feathers, Zs
  fx.forEach(f=>{
    if(f.kind==="z"){ drawZ(Math.round(f.x/S)*S, Math.round(f.y/S)*S, f.c); return; }
    ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x/S)*S, Math.round(f.y/S)*S, f.kind==="feather"?2*S:S*1.5, S);
  });
  // speech bubbles on top
  const taken = []; heads.sort((p,q)=>q[2]-p[2]).forEach(([a,hx,hy])=>{ if(a.say) bubbleText(a.say, hx, hy, taken); });
}

function update(dt, now){
  actors.forEach(a=>stepActor(a,dt));
  // air bubbles from the raccoon's backpack tank while it moves
  actors.forEach(a=>{ if(a.name==="racc" && (a.state==="walk"||a.state==="run"||a.state==="seek") && Math.random() < .035*dt && bubbles.length < 70)
    bubbles.push(Object.assign(newBubble(a.x + (a.dir>0 ? 4 : 19)*S, FLOOR - 13*S), { s:0, v:.45 })); });
  if((gagCool -= dt) <= 0){ startGag(); gagCool = 520 + Math.random()*620; }
  // bubbles
  bubbles.forEach(b=>{ b.y -= b.v*dt; if(b.y < -10){ Object.assign(b, newBubble(Math.random()*W, FLOOR)); } });
  if(Math.random() < .015*dt){ // steam from teapot spout / periscope
    const [sx,sy] = pick(BG.spouts), mw = BG.mid.width, off = Math.round(Math.sin(now/6500)*3)*S - 40;
    for(let base = ((off%mw)+mw)%mw - mw; base < W; base += mw) if(bubbles.length < 60) bubbles.push(Object.assign(newBubble(base+sx*S, sy*S), { s:0, v:.4 }));
  }
  if(bubbles.length > Math.round(W/40)+24) bubbles.splice(0, bubbles.length - Math.round(W/40) - 24);
  // fish school
  if(!school && (schoolCool -= dt) <= 0){
    const dir = Math.random()<.5?1:-1;
    school = { dir, x: dir>0 ? -40 : W+40, y: (14+Math.random()*22)*S, v: .8+Math.random()*.5,
      fish:[[0,0],[16,-10],[16,10],[32,-18],[32,0],[32,16],[48,-8],[48,10]].map(([dx,dy])=>({dx,dy})) };
  }
  if(school){ school.x += school.dir*school.v*dt; if((school.dir>0 && school.x-60 > W) || (school.dir<0 && school.x+60 < 0)){ school=null; schoolCool = 700+Math.random()*1200; } }
  // fx
  fx = fx.filter(f=>(f.life-=dt)>0);
  fx.forEach(f=>{
    if(f.kind==="feather"){ f.x += (f.vx + Math.sin(f.life/8)*.4)*dt; f.y += f.vy*dt; f.vy = Math.min(.5, f.vy+.03*dt); }
    else if(f.kind==="z"){ f.x += (f.vx + Math.sin(f.life/10)*.2)*dt; f.y += f.vy*dt; }
    else { f.x += f.vx*dt; f.y += f.vy*dt; f.vy += .05*dt; }
  });
  props = props.filter(p=>(p.life-=dt)>0);
}

let last = 0;
function frame(now){
  const dt = Math.min(3, (now-last)/16.7 || 1); last = now;
  if(reduce){
    actors.forEach(a=>{ if(a.sayT>0){ a.sayT -= dt; if(a.sayT<=0){ a.say=null; dirty=true; } } });
    if(dirty){ draw(0); dirty=false; }
  } else { update(dt, now); draw(now); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function sceneReact(ok){
  dirty = true;
  if(ok){
    if(!reduce) for(let i=0;i<46;i++) fx.push({ x:W/2+(Math.random()-.5)*W*.4, y:FLOOR-60, vx:(Math.random()-.5)*4, vy:-Math.random()*3-1,
      life:60+Math.random()*40, c:pick(["#ffd447","#ff6a5c","#62dd94","#58b4ff","#ff92d4","#a56cf0"]), kind:"conf" });
    actors.forEach(a=>{ a.state="jump"; a.t=Math.random()*20; a.target=null; });
    makeSay(pick(actors), pick(RIGHT_JOKES), 140);
  } else {
    const a = pick(actors); makeSay(a, pick(WRONG_JOKES), 160); a.state="idle"; a.t=0;
    const b = pick(actors.filter(x=>x!==a)); b.state = Math.random()<.5 ? "sleep" : "doze"; b.t=0; b.target=null;
  }
}

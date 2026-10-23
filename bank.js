// Question bank: [question, correct answer] (free-text answers; host confirms)
const BANK = {
 "Geografia": [
  [
   "Qual é o maior país da América do Sul?",
   "Brasil"
  ],
  [
   "Qual rio corta a cidade de Londres?",
   "Tâmisa"
  ],
  [
   "Qual é a capital da Austrália?",
   "Camberra"
  ],
  [
   "Qual é o maior deserto quente do mundo?",
   "Saara"
  ],
  [
   "Qual estado brasileiro faz fronteira com o maior número de outros estados?",
   "Bahia"
  ],
  [
   "O Monte Everest fica em qual cordilheira?",
   "Himalaia"
  ],
  [
   "Qual é o menor país do mundo?",
   "Vaticano"
  ],
  [
   "Qual oceano banha o litoral brasileiro?",
   "Atlântico"
  ],
  [
   "Qual é a capital do Canadá?",
   "Ottawa"
  ],
  [
   "Em qual continente fica o Egito?",
   "África"
  ],
  [
   "Qual é o rio mais extenso do Brasil?",
   "Amazonas"
  ],
  [
   "Qual país tem o formato de uma bota?",
   "Itália"
  ]
 ],
 "História": [
  [
   "Em que ano o Brasil declarou independência?",
   "1822"
  ],
  [
   "Quem foi o primeiro presidente do Brasil?",
   "Deodoro da Fonseca"
  ],
  [
   "Em que ano terminou a Segunda Guerra Mundial?",
   "1945"
  ],
  [
   "Quem assinou a Lei Áurea?",
   "Princesa Isabel"
  ],
  [
   "Qual civilização construiu as pirâmides de Gizé?",
   "Egípcia"
  ],
  [
   "Em que ano o homem pisou na Lua pela primeira vez?",
   "1969"
  ],
  [
   "Qual foi a capital do Brasil antes de Brasília?",
   "Rio de Janeiro"
  ],
  [
   "Quem descobriu a penicilina?",
   "Alexander Fleming"
  ],
  [
   "Em que ano caiu o Muro de Berlim?",
   "1989"
  ],
  [
   "Qual navegador chegou ao Brasil em 1500?",
   "Pedro Álvares Cabral"
  ],
  [
   "Qual império tinha Roma como capital?",
   "Império Romano"
  ],
  [
   "Quem foi o presidente que fundou Brasília?",
   "Juscelino Kubitschek"
  ]
 ],
 "Ciência": [
  [
   "Qual é o planeta mais próximo do Sol?",
   "Mercúrio"
  ],
  [
   "Qual é a fórmula química da água?",
   "H₂O"
  ],
  [
   "Quantos ossos tem o corpo humano adulto?",
   "206"
  ],
  [
   "Qual gás as plantas absorvem na fotossíntese?",
   "Gás carbônico"
  ],
  [
   "Qual é o maior planeta do Sistema Solar?",
   "Júpiter"
  ],
  [
   "Qual órgão bombeia o sangue pelo corpo?",
   "Coração"
  ],
  [
   "Qual é a velocidade aproximada da luz?",
   "300 mil km/s"
  ],
  [
   "Qual metal é líquido em temperatura ambiente?",
   "Mercúrio"
  ],
  [
   "Quantos planetas tem o Sistema Solar?",
   "8"
  ],
  [
   "Qual é o animal mais rápido em terra?",
   "Guepardo"
  ],
  [
   "Qual é o símbolo químico do ouro?",
   "Au"
  ],
  [
   "A que temperatura a água ferve ao nível do mar?",
   "100 °C"
  ]
 ],
 "Esportes": [
  [
   "Quantos jogadores um time de futebol tem em campo?",
   "11"
  ],
  [
   "Quantas Copas do Mundo o Brasil venceu?",
   "5"
  ],
  [
   "Em qual esporte se usa uma peteca?",
   "Badminton"
  ],
  [
   "Quantos pontos vale uma cesta de fora da linha de 3 no basquete?",
   "3"
  ],
  [
   "Em que país surgiram os Jogos Olímpicos?",
   "Grécia"
  ],
  [
   "Qual seleção venceu a Copa do Mundo de 2002?",
   "Brasil"
  ],
  [
   "Quantos sets precisa vencer para ganhar um jogo de vôlei?",
   "3"
  ],
  [
   "Qual cidade sediou as Olimpíadas de 2016?",
   "Rio de Janeiro"
  ],
  [
   "Em qual esporte Ayrton Senna foi campeão?",
   "Fórmula 1"
  ],
  [
   "Quantos minutos tem um jogo de futebol (tempo normal)?",
   "90"
  ],
  [
   "Qual é o esporte nacional do Japão?",
   "Sumô"
  ],
  [
   "Em qual esporte existe o termo 'strike'?",
   "Boliche"
  ]
 ],
 "Música": [
  [
   "Quantas cordas tem um violão comum?",
   "6"
  ],
  [
   "Qual gênero musical nasceu no Rio de Janeiro no fim dos anos 50?",
   "Bossa nova"
  ],
  [
   "Quantas notas musicais existem na escala básica (dó, ré, mi…)?",
   "7"
  ],
  [
   "Qual instrumento tem teclas pretas e brancas?",
   "Piano"
  ],
  [
   "Qual estado é o berço do forró?",
   "Pernambuco"
  ],
  [
   "Qual instrumento é tocado com arco?",
   "Violino"
  ],
  [
   "Qual cidade é conhecida como a capital do samba?",
   "Rio de Janeiro"
  ],
  [
   "O que significa 'a cappella'?",
   "Cantar sem instrumentos"
  ],
  [
   "Qual gênero musical é a marca de Salvador no Carnaval?",
   "Axé"
  ],
  [
   "Qual é o instrumento de sopro feito de metal?",
   "Trompete"
  ],
  [
   "Quantos integrantes tem um quarteto?",
   "4"
  ],
  [
   "Qual instrumento marca o ritmo numa roda de samba?",
   "Pandeiro"
  ]
 ],
 "Brasil": [
  [
   "Qual é o estado mais populoso do Brasil?",
   "São Paulo"
  ],
  [
   "Quantos estados tem o Brasil?",
   "26"
  ],
  [
   "Qual é a capital do Rio Grande do Sul?",
   "Porto Alegre"
  ],
  [
   "Qual bioma cobre a maior parte do Nordeste?",
   "Caatinga"
  ],
  [
   "Qual é o prato típico do Brasil feito com feijão preto e carnes?",
   "Feijoada"
  ],
  [
   "Qual cidade é conhecida como a 'Veneza Brasileira'?",
   "Recife"
  ],
  [
   "Em qual estado fica a maior parte do Pantanal?",
   "Mato Grosso do Sul"
  ],
  [
   "Qual é a moeda do Brasil?",
   "Real"
  ],
  [
   "Qual cidade é a capital de Minas Gerais?",
   "Belo Horizonte"
  ],
  [
   "Qual é a festa típica de junho no Nordeste?",
   "Festa junina"
  ],
  [
   "Qual estado tem Florianópolis como capital?",
   "Santa Catarina"
  ],
  [
   "Qual é a capital do Brasil?",
   "Brasília"
  ]
 ],
 "Comida": [
  [
   "De qual país vem a pizza?",
   "Itália"
  ],
  [
   "Qual é o ingrediente principal do guacamole?",
   "Abacate"
  ],
  [
   "Qual fruta é usada pra fazer vinho?",
   "Uva"
  ],
  [
   "De que é feito o chocolate?",
   "Cacau"
  ],
  [
   "Qual prato japonês é feito com arroz e peixe cru?",
   "Sushi"
  ],
  [
   "Qual tempero deixa o curry amarelo?",
   "Cúrcuma"
  ],
  [
   "Qual é o ingrediente principal do pão de queijo?",
   "Polvilho"
  ],
  [
   "Qual é a bebida feita com café e leite vaporizado?",
   "Cappuccino"
  ],
  [
   "De qual estado vem o acarajé?",
   "Bahia"
  ],
  [
   "Qual fruta é a base da caipirinha tradicional?",
   "Limão"
  ],
  [
   "Qual queijo é tradicionalmente usado na pizza?",
   "Mussarela"
  ],
  [
   "Qual doce é feito com leite condensado e chocolate em pó?",
   "Brigadeiro"
  ]
 ],
 "Animais": [
  [
   "Qual é o maior animal do planeta?",
   "Baleia-azul"
  ],
  [
   "Quantas patas tem uma aranha?",
   "8"
  ],
  [
   "Qual animal é conhecido como o 'rei da selva'?",
   "Leão"
  ],
  [
   "Qual ave não voa e vive na Antártida?",
   "Pinguim"
  ],
  [
   "Qual mamífero consegue voar?",
   "Morcego"
  ],
  [
   "Qual é o animal mais alto do mundo?",
   "Girafa"
  ],
  [
   "Qual animal muda de cor pra se camuflar?",
   "Camaleão"
  ],
  [
   "Quantos corações tem um polvo?",
   "3"
  ],
  [
   "Qual é o maior felino do mundo?",
   "Tigre"
  ],
  [
   "Qual inseto produz mel?",
   "Abelha"
  ],
  [
   "Qual animal brasileiro é símbolo da Mata Atlântica?",
   "Mico-leão-dourado"
  ],
  [
   "Qual é o maior réptil do mundo?",
   "Crocodilo-de-água-salgada"
  ]
 ]
};

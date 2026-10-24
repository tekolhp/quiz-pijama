# Question bank file spec (one file per category)

File: bank/<slug>.js — plain JS, no modules. Content:

BANK_PARTS.push({ theme: "<Nome da categoria em PT-BR>", items: [
  ["<pergunta em PT-BR>", "<resposta certa, curta>", <...alternativas aceitas opcionais, strings>, <nivel 1|2|3>],
  ...
]});

Rules:
- Exactly 50 items with level 1 (fácil), 50 with level 2 (médio), 50 with level 3 (difícil). 150 total.
- Level is ALWAYS the last element and ALWAYS a number. Alternatives (if any) go between the answer and the level.
- Free-text answers: the answer must be SHORT (1-4 words or a number) and unambiguous. No "cite 3 exemplos", no yes/no.
- Add alternatives when a different spelling/short form is common (e.g. "Madri","Madrid"; "JK","Juscelino"; "CO2").
- Questions must be ORIGINAL (written by you), factually correct and stable. No copying from quiz sites or trivia books.
- Modern mix: within each level, at least 15 items about the 2010s-2020s (recent releases, apps, memes, athletes, streaming, tech, current records) and the rest classic. Nothing that changes month to month (no "current champion/president" unless the question names the year).
- Audience: família brasileira, todas as idades. Sem política partidária, religião, sexo, drogas, violência.
- Portuguese from Brazil, informal but clear. No trailing period in questions; end with "?".
- Numbers as digits in answers ("8", "1945"). No units in the answer unless needed; put units in the question ("em km").
- Valid JS: double quotes only, escape inner quotes with \", one item per line, trailing commas fine.
- No duplicate questions within the file. Vary sub-topics widely.

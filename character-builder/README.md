# Character Builder (SRD 5.2, PT-BR)

Fichas de D&D 5e (regras de 2024) dentro do Dungeon Revealer, em `/fichas`.

- `fonte/srd52.en.json`: conteúdo CC-BY-4.0 do SRD 5.2, extraído dos pacotes do sistema dnd5e do Foundry
  (`scripts/extract_srd.py <dnd5e>/packs/_source fonte/srd52.en.json`).
- `i18n/srd52.pt-BR.json`: tradução (nomes, descrições, títulos e dicas de avanço), feita sobre os lotes de
  `scripts/split_for_translation.py` e o glossário `i18n/glossario.md`.
- `scripts/build_data.py fonte/srd52.en.json i18n/srd52.pt-BR.json ../public/srd52.json`: gera o arquivo que o app carrega.

O motor de regras fica em `src/character-builder/rules.ts` (testes em `rules.test.ts`); as fichas são salvas pelo
servidor em `<data>/characters/<id>.json` (`server/routes/characters.ts`).

Este conteúdo inclui material do System Reference Document 5.2 da Wizards of the Coast LLC, licenciado sob
CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/legalcode). A tradução não é oficial.

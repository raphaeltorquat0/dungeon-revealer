// Frases curtas de apresentação (texto nosso, não do SRD) e o papel de cada opção na mesa.

export const CLASS_LORE: Record<string, { tagline: string; role: string }> = {
  barbarian: {
    tagline: "Fúria que vem do sangue e não pede licença.",
    role: "Linha de frente",
  },
  bard: {
    tagline: "Canções que ferem, curam e convencem.",
    role: "Apoio e magia",
  },
  warlock: {
    tagline: "Um pacto com algo antigo, cobrado em poder.",
    role: "Magia à distância",
  },
  cleric: {
    tagline: "A vontade de um deus, carregada nas mãos.",
    role: "Cura e proteção",
  },
  druid: {
    tagline: "A natureza fala, e às vezes morde.",
    role: "Magia e transformação",
  },
  sorcerer: {
    tagline: "A magia nasceu com você e quer sair.",
    role: "Magia ofensiva",
  },
  fighter: {
    tagline: "Disciplina, aço e técnica sem atalhos.",
    role: "Linha de frente",
  },
  rogue: {
    tagline: "Onde ninguém olha, você já chegou.",
    role: "Furtividade e precisão",
  },
  wizard: {
    tagline: "O poder está nos livros, para quem estuda.",
    role: "Magia versátil",
  },
  monk: {
    tagline: "Corpo e espírito afiados como uma lâmina.",
    role: "Mobilidade e golpes",
  },
  paladin: {
    tagline: "Um juramento que brilha na ponta da espada.",
    role: "Defesa e golpes sagrados",
  },
  ranger: {
    tagline: "Rastreia, caça e protege as fronteiras.",
    role: "Combate à distância",
  },
};

export const SPECIES_LORE: Record<string, string> = {
  dragonborn: "Herdeiros dos dragões, com sopro elemental.",
  dwarf: "Resistentes como a pedra das montanhas.",
  elf: "Longevos, de sentidos aguçados e sono em transe.",
  gnome: "Curiosos, engenhosos e difíceis de enganar.",
  goliath: "Descendentes de gigantes, de força imensa.",
  halfling: "Pequenos, corajosos e com uma sorte notável.",
  human: "Versáteis e ambiciosos, estão em toda parte.",
  orc: "Incansáveis, levantam-se quando outros caem.",
  tiefling: "Marcados por um legado dos planos inferiores.",
};

export const BACKGROUND_LORE: Record<string, string> = {
  acolyte: "Criado a serviço de um templo.",
  criminal: "Viveu nas sombras, longe da lei.",
  sage: "Passou anos entre livros e mestres.",
  soldier: "Treinou e lutou em fileiras de batalha.",
};

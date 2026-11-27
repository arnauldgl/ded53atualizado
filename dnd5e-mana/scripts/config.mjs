/**
 * Regras padrão do sistema de mana.
 * Tudo aqui pode ser alterado em Configurações → Sistema de Mana → "Editar tabelas (JSON)".
 */

export const MODULE_ID = "dnd5e-mana";

/** Mana total por nível de classe (índice 0 = nível 1). */
export const DEFAULT_RULES = {
  tables: {
    // Classes magas (progressão de magia completa ou de pacto):
    // Bardo, Bruxo, Clérigo, Druida, Feiticeiro, Mago.
    full: [4, 6, 14, 17, 27, 32, 38, 44, 57, 64, 73, 73, 83, 83, 94, 94, 107, 114, 123, 133],

    // Meio-conjuradores: Paladino, Patrulheiro, Artífice.
    half: [4, 4, 6, 6, 14, 14, 17, 17, 27, 27, 32, 32, 38, 38, 44, 44, 57, 57, 64, 64],

    // Classes guerreiras (sem progressão de magia): Bárbaro, Guerreiro, Ladino, Monge.
    martial: [5, 7, 9, 13, 15, 17, 19, 23, 25, 27, 29, 33, 35, 37, 39, 43, 45, 47, 49, 53],

    // Somado ao marcial quando a subclasse conjura (Cavaleiro Místico, Trapaceiro Arcano).
    third: [0, 0, 4, 4, 4, 6, 6, 6, 14, 14, 14, 17, 17, 17, 27, 27, 27, 32, 32, 32],

    // Ki do Monge (reserva própria, não é mana): pontos de foco = nível de monge.
    ki: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  },

  /**
   * Recuperação (% do máximo) conforme a condição do descanso.
   * normal: descanso comum na estrada; comfortable: taberna, castelo, cama boa;
   * desperate: situação de desespero (masmorra, perseguição, frio, fome).
   */
  recovery: {
    normal:      { long: 40,  short: 15 },
    comfortable: { long: 100, short: 15 },
    desperate:   { long: 33,  short: 0 }
  },

  /** Recuperação do Ki do Monge (a respiração do monge volta mais rápido no descanso curto). */
  kiRecovery: {
    normal:      { long: 50,  short: 50 },
    comfortable: { long: 100, short: 50 },
    desperate:   { long: 33,  short: 0 }
  },

  /**
   * Classes que curam: no descanso curto, em vez da porcentagem, gastam Dados de Vida
   * para recuperar mana. Cada dado devolve (resultado × fator), arredondado para cima.
   */
  healerClasses: ["cleric", "druid", "paladin", "bard", "ranger"],
  hitDieManaFactor: 0.5,

  /**
   * Foco de conjuração: o personagem precisa ter um destes equipado (ou no inventário,
   * para itens que não se equipam). Também conta qualquer item marcado como foco
   * (botão "Foco de conjuração" no cabeçalho da ficha do item) e instrumentos musicais.
   */
  focusKeywords: [
    "varinha", "cajado", "bastão", "bastao", "orbe", "cristal", "foco", "símbolo sagrado", "simbolo sagrado",
    "amuleto", "emblema", "relicário", "relicario", "visco", "totem", "wand", "staff", "rod", "orb",
    "crystal", "focus", "holy symbol", "amulet", "emblem", "reliquary", "mistletoe"
  ],
  /** Classes que podem usar a arma (ou o escudo) equipada como foco sagrado. */
  weaponFocusClasses: ["paladin", "cleric"],

  /**
   * Categoria forçada por classe (identificador). Se a classe não estiver aqui,
   * a categoria vem da progressão de magia da classe no dnd5e:
   * full/pact → "full", half/artificer → "half", third → "martial" + "third", none → "martial".
   */
  classCategory: {
    barbarian: "martial", fighter: "martial", monk: "ki", rogue: "martial",
    paladin: "half", ranger: "half", artificer: "half",
    bard: "full", cleric: "full", druid: "full", sorcerer: "full", warlock: "full", wizard: "full"
  },

  /** Atributo de mana por classe, usado no modo "Por classe". */
  classAbility: {
    wizard: "int", artificer: "int", fighter: "int", rogue: "int", bard: "int", warlock: "int",
    cleric: "wis", druid: "wis", ranger: "wis", monk: "wis", paladin: "wis", barbarian: "wis", sorcerer: "wis"
  },

  /**
   * Quanto o modificador do atributo pesa, por categoria.
   * Bônus = modificador × arredondar_para_cima(nível total ÷ 2) × fator.
   */
  abilityFactor: { full: 1, half: 0.75, martial: 0.5, ki: 0 },

  /** Custo de mana por nível do espaço de magia usado (truque = nível 0). */
  spellCost: { "0": 0, "1": 2, "2": 3, "3": 5, "4": 6, "5": 7, "6": 9, "7": 10, "8": 11, "9": 13 },

  /** Custo padrão por uso de uma habilidade de classe que não esteja na lista abaixo. */
  defaultFeatureCost: 2,

  /**
   * Custo por uso, pelo identificador da habilidade (ou do recurso que ela consome).
   * Valor -1 = não converter (a habilidade continua usando os próprios usos).
   * Valores fracionados são somados e arredondados para cima (ex.: Cura pelas Mãos 0.2 por PV).
   */
  featureCost: {
    "action-surge": 5,
    "second-wind": 2,
    "indomitable": 4,
    "rage": 3,
    "intimidating-presence": 3,
    "persistent-rage": -1,
    "relentless-rage": -1,
    "bardic-inspiration": 2,
    "channel-divinity": 4,
    "channel-divinity-cleric": 4,
    "channel-divinity-paladin": 4,
    "divine-sense": 1,
    "divine-intervention": 10,
    "lay-on-hands": 0.2,
    "restoring-touch": 2,
    "holy-nimbus": 8,
    "monks-focus": 1,
    "ki": 1,
    "wholeness-of-body": 3,
    "uncanny-metabolism": -1,
    "wild-shape": 3,
    "wild-resurgence": -1,
    "archdruid": -1,
    "natural-recovery": -1,
    "natures-veil": 2,
    "favored-enemy": 2,
    "font-of-magic": 1,
    "sorcery-points": 1,
    "innate-sorcery": 3,
    "sorcerous-restoration": -1,
    "dragon-wings": 3,
    "dragon-companion": 5,
    "dark-ones-own-luck": 2,
    "hurl-through-hell": 6,
    "magical-cunning": -1,
    "eldritch-master": -1,
    "arcane-recovery": -1,
    "overchannel": -1,
    "superiority-dice": 2,
    "combat-superiority": 2,
    "sneak-attack": -1,
    "stroke-of-luck": 5,
    "gift-of-the-depths": 2,
    "gift-of-the-protectors": 2
  },

  /**
   * Bônus de mana por espécie. Total = fixo + porNivel × nível total (arredondado para baixo).
   * Espécies fora da lista não recebem bônus.
   */
  species: {
    "elf":        { flat: 0, perLevel: 1,   label: "Elfo" },
    "half-elf":   { flat: 0, perLevel: 0.5, label: "Meio-Elfo" },
    "gnome":      { flat: 0, perLevel: 1,   label: "Gnomo" },
    "tiefling":   { flat: 0, perLevel: 1,   label: "Tiefling" },
    "aasimar":    { flat: 0, perLevel: 1,   label: "Aasimar" },
    "human":      { flat: 2, perLevel: 0,   label: "Humano" },
    "dragonborn": { flat: 3, perLevel: 0,   label: "Draconato" },
    "dwarf":      { flat: 0, perLevel: 0,   label: "Anão" },
    "halfling":   { flat: 0, perLevel: 0,   label: "Halfling" },
    "goliath":    { flat: 0, perLevel: 0,   label: "Golias" },
    "orc":        { flat: 0, perLevel: 0,   label: "Orc" },
    "half-orc":   { flat: 0, perLevel: 0,   label: "Meio-Orc" }
  },

  /** Nomes em português que apontam para as chaves acima (para fichas traduzidas). */
  speciesAliases: {
    "elfo": "elf", "alto-elfo": "elf", "elfo-da-floresta": "elf", "drow": "elf",
    "meio-elfo": "half-elf",
    "gnomo": "gnome", "gnomo-das-rochas": "gnome", "gnomo-da-floresta": "gnome",
    "humano": "human",
    "draconato": "dragonborn",
    "anao": "dwarf", "anão": "dwarf", "anao-da-colina": "dwarf", "anão-da-colina": "dwarf",
    "pequenino": "halfling",
    "golias": "goliath",
    "meio-orc": "half-orc"
  }
};

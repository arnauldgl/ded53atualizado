import { DEFAULT_RULES, MODULE_ID } from "./config.mjs";

export const FLAG_PATH = `flags.${MODULE_ID}.value`;

/* -------------------------------------------- */
/*  Regras (padrão + o que o mestre alterou)    */
/* -------------------------------------------- */

export function getRules() {
  let custom = {};
  try { custom = game.settings.get(MODULE_ID, "rules") ?? {}; } catch { /* antes do init */ }
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_RULES), custom, { inplace: false });
}

export function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

/* -------------------------------------------- */
/*  Quem usa mana                               */
/* -------------------------------------------- */

export function usesMana(actor) {
  if ( !actor ) return false;
  if ( actor.type === "character" ) return true;
  if ( actor.type === "npc" ) return setting("applyToNPCs");
  return false;
}

/* -------------------------------------------- */
/*  Cálculo da mana máxima                      */
/* -------------------------------------------- */

const tableValue = (table, level) => {
  if ( !Array.isArray(table) || (level < 1) ) return 0;
  return Number(table[Math.min(level, table.length) - 1]) || 0;
};

/** Categoria de uma classe: "full", "half" ou "martial" (+ flag third). */
export function classCategory(cls, rules) {
  const id = cls.identifier ?? cls.system?.identifier;
  const progression = cls.spellcasting?.progression ?? cls.system?.spellcasting?.progression ?? "none";
  const third = progression === "third";
  let category = rules.classCategory[id];
  if ( !category ) {
    if ( ["full", "pact"].includes(progression) ) category = "full";
    else if ( ["half", "artificer"].includes(progression) ) category = "half";
    else category = "martial";
  }
  return { id, category, third: third && (category === "martial") };
}

const CATEGORY_RANK = { ki: -1, martial: 0, half: 1, full: 2 };

/** Encontra a chave de espécie nas regras. */
export function speciesKey(actor, rules) {
  const race = actor.system?.details?.race;
  if ( !race || (typeof race === "string") ) return null;
  const candidates = [race.system?.identifier, race.name?.slugify?.({ strict: true }), race.name?.toLowerCase()]
    .filter(Boolean);
  for ( let c of candidates ) {
    c = rules.speciesAliases[c] ?? c;
    if ( rules.species[c] ) return c;
  }
  // "high-elf" → "elf", "rock-gnome" → "gnome", "hill-dwarf" → "dwarf"
  for ( const c of candidates ) {
    for ( const key of Object.keys(rules.species) ) {
      if ( c.endsWith(`-${key}`) || c.startsWith(`${key}-`) ) return key;
    }
    for ( const [alias, key] of Object.entries(rules.speciesAliases) ) {
      if ( c.endsWith(`-${alias}`) || c.startsWith(`${alias}-`) ) return key;
    }
  }
  return null;
}

/** Qual atributo usar ("int" ou "wis"). */
export function manaAbility(actor, mainClassId, rules) {
  const mode = setting("abilityMode");
  const abl = actor.system?.abilities ?? {};
  const mod = k => abl[k]?.mod ?? 0;
  if ( mode === "int" ) return "int";
  if ( mode === "wis" ) return "wis";
  const highest = mod("wis") > mod("int") ? "wis" : "int";
  if ( mode === "highest" ) return highest;
  return rules.classAbility[mainClassId] ?? highest;
}

/**
 * Calcula a mana máxima e o detalhamento.
 * @returns {{max:number, parts:object[], level:number, ability:string}}
 */
export function computeMana(actor, rules=getRules()) {
  const parts = [];
  const classes = Object.values(actor.classes ?? {});
  let level = 0;
  let main = null;
  let bestCategory = "ki";

  for ( const cls of classes ) {
    const lvl = cls.system?.levels ?? 0;
    if ( !lvl ) continue;
    level += lvl;
    const info = classCategory(cls, rules);
    const value = tableValue(rules.tables[info.category], lvl);
    parts.push({ label: `${cls.name} ${lvl} (${game.i18n.localize(`DND5E_MANA.Category.${info.category}`)})`, value });
    if ( info.third ) {
      const v = tableValue(rules.tables.third, lvl);
      if ( v ) parts.push({ label: `${cls.name}: ${game.i18n.localize("DND5E_MANA.Category.third")}`, value: v });
    }
    if ( !main || (lvl > main.lvl) ) main = { id: info.id, lvl };
    if ( CATEGORY_RANK[info.category] > CATEGORY_RANK[bestCategory] ) bestCategory = info.category;
  }

  if ( !parts.length ) bestCategory = "martial";
  const pool = (bestCategory === "ki") ? "ki" : "mana";

  // NPCs: usa o nível de conjurador como mago.
  if ( !classes.length && (actor.type === "npc") ) {
    const spellLevel = actor.system?.attributes?.spell?.level ?? 0;
    if ( spellLevel ) {
      level = spellLevel;
      bestCategory = "full";
      parts.push({ label: game.i18n.localize("DND5E_MANA.NPCCaster"), value: tableValue(rules.tables.full, spellLevel) });
    }
  }

  const ability = manaAbility(actor, main?.id, rules);
  if ( level > 0 ) {
    const mod = actor.system?.abilities?.[ability]?.mod ?? 0;
    const factor = rules.abilityFactor[bestCategory] ?? 1;
    const value = Math.trunc(mod * Math.ceil(level / 2) * factor);
    if ( value ) parts.push({
      label: `${CONFIG.DND5E?.abilities?.[ability]?.label ?? ability.toUpperCase()} (${mod >= 0 ? "+" : ""}${mod})`,
      value
    });

    const sKey = (pool === "ki") ? null : speciesKey(actor, rules);
    const sp = sKey ? rules.species[sKey] : null;
    if ( sp ) {
      const v = Math.floor((sp.flat ?? 0) + ((sp.perLevel ?? 0) * level));
      if ( v ) parts.push({ label: actor.system.details.race.name ?? sp.label, value: v });
    }
  }

  const bonus = Number(actor.getFlag?.(MODULE_ID, "bonus")) || 0;
  if ( bonus ) parts.push({ label: game.i18n.localize("DND5E_MANA.ManualBonus"), value: bonus });

  const max = Math.max(0, parts.reduce((t, p) => t + p.value, 0));
  return { max, parts, level, ability, pool };
}

/** "ki" para o Monge (só monge), "mana" para os demais. */
export function poolType(actor) {
  return computeMana(actor).pool;
}

export function getMana(actor) {
  const { max } = computeMana(actor);
  const stored = actor.getFlag(MODULE_ID, "value");
  const value = Number.isFinite(stored) ? Math.clamp(stored, 0, max) : max;
  return { value, max };
}

/* -------------------------------------------- */
/*  Custos                                      */
/* -------------------------------------------- */

export function spellCost(level, rules=getRules()) {
  return Number(rules.spellCost[String(level)] ?? 0);
}

/** Este item é uma habilidade de classe que deve gastar mana? */
export function isConvertibleFeature(item) {
  if ( !item || (item.type !== "feat") ) return false;
  const type = item.system?.type?.value;
  if ( type === "class" ) return true;
  if ( (type === "race") && setting("includeSpecies") ) return true;
  if ( (type === "feat") && setting("includeFeats") ) return true;
  return false;
}

/** Custo por uso de uma habilidade. Retorna null quando não deve ser convertida. */
export function featureCostPerUse(item, targetItem, rules=getRules()) {
  for ( const doc of [item, targetItem] ) {
    if ( !doc ) continue;
    const flag = doc.getFlag?.(MODULE_ID, "cost");
    if ( Number.isFinite(flag) ) return flag < 0 ? null : flag;
    const id = doc.system?.identifier;
    if ( id && (id in rules.featureCost) ) {
      const c = Number(rules.featureCost[id]);
      return c < 0 ? null : c;
    }
  }
  return Number(rules.defaultFeatureCost) || 0;
}

/* -------------------------------------------- */
/*  Descanso                                    */
/* -------------------------------------------- */

export const REST_CONDITIONS = ["normal", "comfortable", "desperate"];

/** Condição do descanso: a da cena (se marcada) ou a geral do mundo. */
export function restCondition(scene=canvas?.scene) {
  const fromScene = scene?.getFlag?.(MODULE_ID, "restCondition");
  if ( REST_CONDITIONS.includes(fromScene) ) return fromScene;
  const value = setting("restCondition");
  return REST_CONDITIONS.includes(value) ? value : "normal";
}

/** Porcentagem recuperada para este ator, tipo de descanso e condição. */
export function recoveryPercent(actor, type, condition=restCondition(), rules=getRules()) {
  const table = (poolType(actor) === "ki") ? rules.kiRecovery : rules.recovery;
  return Number(table?.[condition]?.[type] ?? table?.normal?.[type] ?? 0);
}

/** Classes do ator que curam (trocam Dados de Vida por mana no descanso curto). */
export function healerClasses(actor, rules=getRules()) {
  const list = new Set(rules.healerClasses ?? []);
  return Object.values(actor.classes ?? {}).filter(c => list.has(c.identifier ?? c.system?.identifier));
}

/* -------------------------------------------- */
/*  Conjuração: foco, fala e visão              */
/* -------------------------------------------- */

const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** O item conta como foco de conjuração? */
export function isFocusItem(item, actor, rules=getRules()) {
  if ( !item ) return false;
  const flag = item.getFlag?.(MODULE_ID, "focus");
  if ( flag === false ) return false;
  // Precisa estar equipado (quando o item pode ser equipado).
  if ( ("equipped" in (item.system ?? {})) && (item.system.equipped === false) && (item.type !== "loot") ) return false;
  if ( flag === true ) return true;
  if ( (item.type === "tool") && (item.system?.type?.value === "music") ) return true;
  if ( item.system?.properties?.has?.("foc") ) return true;
  const focusIds = new Set(Object.values(CONFIG.DND5E?.focusTypes ?? {}).flatMap(f => Object.keys(f.itemIds ?? {})));
  const base = item.system?.type?.baseItem;
  if ( base && focusIds.has(base) ) return true;
  const name = norm(item.name);
  const original = norm(item.getFlag?.("babele", "originalName"));
  if ( (rules.focusKeywords ?? []).some(k => name.includes(norm(k)) || original.includes(norm(k))) ) return true;
  // Arma ou escudo sagrado: paladinos e clérigos.
  const holyWeapon = ["weapon"].includes(item.type) || (item.type === "equipment" && item.system?.type?.value === "shield");
  if ( holyWeapon && item.system?.equipped ) {
    const allowed = new Set(rules.weaponFocusClasses ?? []);
    if ( Object.values(actor?.classes ?? {}).some(c => allowed.has(c.identifier ?? c.system?.identifier)) ) return true;
  }
  return false;
}

export function findFocus(actor, rules=getRules()) {
  return actor.items.find(i => isFocusItem(i, actor, rules)) ?? null;
}

/**
 * Verifica se o ator pode conjurar a magia agora.
 * @returns {string|null} chave do motivo do bloqueio, ou null se pode.
 */
export function castingBlock(activity) {
  const actor = activity.actor;
  const item = activity.item;
  if ( !actor || (actor.type !== "character") || (item?.type !== "spell") ) return null;
  const method = item.system?.method ?? item.system?.preparation?.mode;
  const statuses = actor.statuses ?? new Set();
  // Falar a conjuração.
  if ( setting("requireVerbal") && ["silenced", "unconscious", "paralyzed", "petrified", "stunned"].some(s => statuses.has(s)) ) {
    return "Silenced";
  }
  // Ver o alvo (a não ser em magias pessoais ou de toque).
  if ( setting("requireSight") && statuses.has("blinded") ) {
    const units = activity.range?.units ?? item.system?.range?.units;
    const affects = activity.target?.affects?.type ?? "";
    if ( !["self", "touch"].includes(units) && (affects !== "self") ) return "Blind";
  }
  // Foco (magias inatas de espécie/talento não precisam).
  if ( setting("requireFocus") && !["innate", "atwill"].includes(method) && !findFocus(actor) ) return "NoFocus";
  return null;
}

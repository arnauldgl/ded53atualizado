import { DEFAULT_RULES, MODULE_ID } from "./config.mjs";
import {
  FLAG_PATH, REST_CONDITIONS, castingBlock, computeMana, featureCostPerUse, findFocus, getMana, getRules,
  healerClasses, isConvertibleFeature, poolType, recoveryPercent, restCondition, setting, spellCost, usesMana
} from "./mana.mjs";

const t = (key, data) => data ? game.i18n.format(`DND5E_MANA.${key}`, data) : game.i18n.localize(`DND5E_MANA.${key}`);

/* ============================================ */
/*  Configurações                               */
/* ============================================ */

class ManaRulesMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "dnd5e-mana-rules",
    tag: "form",
    classes: ["dnd5e-mana-rules"],
    window: { title: "DND5E_MANA.Settings.Rules.Title", resizable: true },
    position: { width: 720, height: 640 },
    form: { handler: ManaRulesMenu.#onSubmit, closeOnSubmit: true },
    actions: { reset: ManaRulesMenu.#onReset }
  };

  async _renderHTML() {
    const json = JSON.stringify(getRules(), null, 2);
    return `
      <p class="hint">${t("Settings.Rules.Hint")}</p>
      <textarea name="rules" spellcheck="false">${Handlebars.escapeExpression(json)}</textarea>
      <footer class="form-footer">
        <button type="button" data-action="reset"><i class="fas fa-undo"></i> ${t("Settings.Rules.Reset")}</button>
        <button type="submit"><i class="fas fa-save"></i> ${t("Save")}</button>
      </footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  static async #onSubmit(event, form, formData) {
    let parsed;
    try {
      parsed = JSON.parse(formData.object.rules);
    } catch ( err ) {
      ui.notifications.error(t("Settings.Rules.Invalid", { error: err.message }));
      throw err;
    }
    await game.settings.set(MODULE_ID, "rules", parsed);
    ui.notifications.info(t("Settings.Rules.Saved"));
  }

  static async #onReset() {
    await game.settings.set(MODULE_ID, "rules", {});
    this.render();
    ui.notifications.info(t("Settings.Rules.ResetDone"));
  }
}

function rerenderSheets() {
  for ( const app of foundry.applications.instances.values() ) {
    if ( app.document instanceof Actor ) app.render();
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "abilityMode", {
    name: "DND5E_MANA.Settings.AbilityMode.Name",
    hint: "DND5E_MANA.Settings.AbilityMode.Hint",
    scope: "world", config: true, type: String, default: "class",
    choices: {
      class: "DND5E_MANA.Settings.AbilityMode.Class",
      int: "DND5E_MANA.Settings.AbilityMode.Int",
      wis: "DND5E_MANA.Settings.AbilityMode.Wis",
      highest: "DND5E_MANA.Settings.AbilityMode.Highest"
    },
    onChange: rerenderSheets
  });

  game.settings.register(MODULE_ID, "restCondition", {
    name: "DND5E_MANA.Settings.RestCondition.Name",
    hint: "DND5E_MANA.Settings.RestCondition.Hint",
    scope: "world", config: true, type: String, default: "normal",
    choices: {
      normal: "DND5E_MANA.Rest.normal",
      comfortable: "DND5E_MANA.Rest.comfortable",
      desperate: "DND5E_MANA.Rest.desperate"
    },
    onChange: rerenderSheets
  });

  for ( const key of ["requireFocus", "requireVerbal", "requireSight"] ) {
    game.settings.register(MODULE_ID, key, {
      name: `DND5E_MANA.Settings.${key}.Name`,
      hint: `DND5E_MANA.Settings.${key}.Hint`,
      scope: "world", config: true, type: Boolean, default: true
    });
  }

  // Condição "Silenciado" (amordaçado, sob a magia Silêncio): impede de falar a conjuração.
  if ( !CONFIG.statusEffects.some(e => e.id === "silenced") ) {
    CONFIG.statusEffects.push({ id: "silenced", name: "DND5E_MANA.Status.Silenced", img: "icons/svg/sound-off.svg" });
  }

  game.settings.register(MODULE_ID, "includeSpecies", {
    name: "DND5E_MANA.Settings.IncludeSpecies.Name",
    hint: "DND5E_MANA.Settings.IncludeSpecies.Hint",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, "includeFeats", {
    name: "DND5E_MANA.Settings.IncludeFeats.Name",
    hint: "DND5E_MANA.Settings.IncludeFeats.Hint",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, "applyToNPCs", {
    name: "DND5E_MANA.Settings.NPCs.Name",
    hint: "DND5E_MANA.Settings.NPCs.Hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: rerenderSheets
  });

  game.settings.register(MODULE_ID, "rules", {
    scope: "world", config: false, type: Object, default: {},
    onChange: rerenderSheets
  });

  game.settings.registerMenu(MODULE_ID, "rulesMenu", {
    name: "DND5E_MANA.Settings.Rules.Name",
    label: "DND5E_MANA.Settings.Rules.Label",
    hint: "DND5E_MANA.Settings.Rules.Hint",
    icon: "fas fa-table",
    type: ManaRulesMenu,
    restricted: true
  });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = {
    DEFAULT_RULES, getRules, computeMana, getMana,
    /** Define a mana atual de um ator. */
    setMana: (actor, value) => actor.setFlag(MODULE_ID, "value", Math.max(0, Math.round(value))),
    /** Enche a mana de um ator. */
    restore: actor => actor.setFlag(MODULE_ID, "value", getMana(actor).max),
    /** Custo por uso de uma habilidade específica (-1 = não converter; null = remover). */
    setItemCost: (item, cost) => cost === null ? item.unsetFlag(MODULE_ID, "cost") : item.setFlag(MODULE_ID, "cost", cost),
    /** Marca (true), desmarca (false) ou volta ao automático (null) um item como foco de conjuração. */
    setFocus: (item, value) => value === null ? item.unsetFlag(MODULE_ID, "focus") : item.setFlag(MODULE_ID, "focus", !!value),
    findFocus,
    castingBlock,
    /** Condição de descanso atual ("normal", "comfortable", "desperate"). */
    restCondition,
    /** Define a condição de descanso do mundo, ou só de uma cena. */
    setRestCondition: async (condition, scene=null) => {
      if ( !REST_CONDITIONS.includes(condition) && (condition !== null) ) throw new Error(`Condição inválida: ${condition}`);
      if ( scene ) return condition === null ? scene.unsetFlag(MODULE_ID, "restCondition") : scene.setFlag(MODULE_ID, "restCondition", condition);
      return game.settings.set(MODULE_ID, "restCondition", condition ?? "normal");
    },
    /** Janela para o mestre escolher a condição de descanso. */
    chooseRestCondition
  };
});

/* ============================================ */
/*  Consumo: magias e habilidades de classe     */
/* ============================================ */

const CONVERTIBLE_TYPES = new Set(["itemUses", "activityUses", "attribute"]);

function resolveQuantity(target, config) {
  try {
    const roll = target.resolveCost({ config, evaluate: false });
    if ( roll.isDeterministic ) return roll.evaluateSync().total;
    return roll.evaluateSync({ minimize: true }).total || 1;
  } catch {
    return 1;
  }
}

Hooks.on("dnd5e.preActivityConsumption", (activity, config) => {
  const actor = activity.actor;
  if ( !usesMana(actor) ) return;
  const block = castingBlock(activity);
  if ( block ) {
    ui.notifications.warn(t(`Warn.${block}`, { name: actor.name, spell: activity.item.name }));
    return false;
  }
  if ( config.consume === false ) return;
  if ( config.consume === true ) config.consume = {
    action: true, resources: Array.from(activity.consumption.targets.keys()), spellSlot: true
  };

  const rules = getRules();
  let cost = 0;
  const reasons = [];

  // Magias: o espaço de magia vira custo de mana.
  const castsWithSlot = config.consume.spellSlot && activity.requiresSpellSlot
    && activity.consumption.spellSlot && !config.cause;
  if ( castsWithSlot ) {
    const slotKey = config.spell?.slot;
    const level = actor.system.spells?.[slotKey]?.level
      ?? ((activity.item.system.level ?? 0) + (config.scaling ?? 0));
    const c = spellCost(level, rules);
    if ( c > 0 ) {
      cost += c;
      reasons.push(t("Chat.SpellLevel", { level }));
    }
    config.consume.spellSlot = false;
  }

  // Habilidades de classe: usos limitados viram custo de mana.
  if ( isConvertibleFeature(activity.item) && config.consume.resources ) {
    const indexes = config.consume.resources === true
      ? Array.from(activity.consumption.targets.keys())
      : Array.from(config.consume.resources);
    const keep = [];
    let featureCost = 0;
    for ( const index of indexes ) {
      const target = activity.consumption.targets[index];
      if ( !target || !CONVERTIBLE_TYPES.has(target.type) ) { keep.push(index); continue; }
      if ( (target.type === "attribute") && !String(target.target).startsWith("resources.") ) {
        keep.push(index); continue;
      }
      const targetItem = (target.type === "itemUses") && target.target
        ? actor.items.get(target.target) : activity.item;
      if ( (targetItem !== activity.item) && !isConvertibleFeature(targetItem) ) { keep.push(index); continue; }
      const perUse = featureCostPerUse(activity.item, targetItem, rules);
      if ( perUse === null ) { keep.push(index); continue; }
      featureCost += perUse * resolveQuantity(target, config);
    }
    config.consume.resources = keep;
    if ( featureCost > 0 ) {
      cost += Math.ceil(featureCost);
      reasons.push(activity.item.name);
    }
  }

  if ( cost <= 0 ) return;
  const { value } = getMana(actor);
  if ( cost > value ) {
    const key = poolType(actor) === "ki" ? "Warn.NotEnoughKi" : "Warn.NotEnough";
    ui.notifications.warn(t(key, { name: activity.item.name, cost, value }));
    return false;
  }
  config[MODULE_ID] = { cost, reasons };
});

Hooks.on("dnd5e.activityConsumption", (activity, config, messageConfig, updates) => {
  const cost = config[MODULE_ID]?.cost;
  if ( !cost ) return;
  const { value } = getMana(activity.actor);
  updates.actor[FLAG_PATH] = Math.max(0, value - cost);
});

// Nome legível do gasto de mana no cartão de chat.
Hooks.on("dnd5e.getUnknownAttributeLabel", (attr, options) => {
  if ( attr.replace(/^system\./, "") === FLAG_PATH ) options.label = `${t("Mana")} / ${t("Ki")}`;
});

/* ============================================ */
/*  Descansos                                   */
/* ============================================ */

Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  if ( !usesMana(actor) ) return;
  const type = ((config.type ?? result.type) === "short") ? "short" : "long";
  const condition = restCondition();
  const { value, max } = getMana(actor);
  const info = { type, condition, before: value, max, healer: false };
  // Classes que curam trocam Dados de Vida por mana no descanso curto (exceto em desespero).
  if ( (type === "short") && (poolType(actor) === "mana") && healerClasses(actor).length && (condition !== "desperate") ) {
    info.healer = true;
    info.after = value;
  } else {
    const pct = recoveryPercent(actor, type, condition);
    info.after = Math.min(max, value + Math.ceil(max * pct / 100));
    info.pct = pct;
    if ( info.after !== value ) result.updateData[FLAG_PATH] = info.after;
  }
  result[MODULE_ID] = info;
});

Hooks.on("dnd5e.restCompleted", async (actor, result, config) => {
  const info = result?.[MODULE_ID];
  if ( !info ) return;
  const pool = t(poolType(actor) === "ki" ? "Ki" : "Mana");
  const cond = t(`Rest.${info.condition}`);
  if ( !info.healer ) {
    const gain = info.after - info.before;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p class="dnd5e-mana-rest">${t("Chat.Rest", { pool, cond, pct: info.pct, gain, value: info.after, max: info.max })}</p>`
    });
    return;
  }
  await spendHitDiceForMana(actor, cond);
});

/** Diálogo do descanso curto das classes que curam: gastar Dados de Vida para recuperar mana. */
async function spendHitDiceForMana(actor, cond) {
  const classes = Object.values(actor.classes ?? {}).filter(c => (c.system?.hd?.value ?? 0) > 0);
  const available = classes.reduce((n, c) => n + (c.system.hd.value ?? 0), 0);
  const { value, max } = getMana(actor);
  if ( !available || (value >= max) ) return;
  const factor = Number(getRules().hitDieManaFactor) || 0.5;
  const dice = classes.map(c => `${c.system.hd.value}${c.system.hd.denomination}`).join(" + ");
  const count = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("HitDice.Title", { name: actor.name }) },
    content: `<p>${t("HitDice.Hint", { cond, value, max, dice, pct: Math.round(factor * 100) })}</p>
      <div class="form-group"><label>${t("HitDice.Count")}</label>
      <input type="number" name="count" value="0" min="0" max="${available}" step="1" autofocus></div>`,
    ok: { label: t("HitDice.Spend"), icon: "fas fa-dice-d20", callback: (event, button) => button.form.elements.count.valueAsNumber },
    rejectClose: false
  });
  const n = Math.clamp(Math.floor(Number(count) || 0), 0, available);
  if ( !n ) return;
  let gain = 0;
  const rolls = [];
  const spent = {};
  for ( let i = 0; i < n; i++ ) {
    // Usa primeiro o maior dado disponível.
    const cls = classes
      .filter(c => (c.system.hd.value - (spent[c.id] ?? 0)) > 0)
      .sort((a, b) => Number(b.system.hd.denomination.slice(1)) - Number(a.system.hd.denomination.slice(1)))[0];
    if ( !cls ) break;
    const roll = await new Roll(`1${cls.system.hd.denomination}`).evaluate();
    rolls.push(roll);
    spent[cls.id] = (spent[cls.id] ?? 0) + 1;
    gain += Math.ceil(roll.total * factor);
  }
  for ( const [id, k] of Object.entries(spent) ) {
    const cls = actor.items.get(id);
    await cls.update({ "system.hd.spent": (cls.system.hd.spent ?? 0) + k });
  }
  const after = Math.min(max, value + gain);
  await actor.setFlag(MODULE_ID, "value", after);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls,
    content: `<p class="dnd5e-mana-rest">${t("Chat.HitDice", { n, results: rolls.map(r => r.total).join(", "), gain: after - value, value: after, max })}</p>`
  });
}

/** Janela do mestre: condição de descanso do mundo e da cena atual. */
async function chooseRestCondition() {
  if ( !game.user.isGM ) return ui.notifications.warn(t("Rest.GMOnly"));
  const world = setting("restCondition");
  const sceneFlag = canvas?.scene?.getFlag(MODULE_ID, "restCondition") ?? "";
  const opts = (sel, withEmpty) => (withEmpty ? `<option value="" ${!sel ? "selected" : ""}>${t("Rest.UseWorld")}</option>` : "")
    + REST_CONDITIONS.map(c => `<option value="${c}" ${c === sel ? "selected" : ""}>${t(`Rest.${c}`)}</option>`).join("");
  const r = getRules();
  const linhas = REST_CONDITIONS.map(c => `<tr><td>${t(`Rest.${c}`)}</td><td>${r.recovery[c].long}%</td><td>${r.recovery[c].short}%</td><td>${r.kiRecovery[c].long}% / ${r.kiRecovery[c].short}%</td></tr>`).join("");
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("Rest.Title") },
    content: `<table class="dnd5e-mana-breakdown"><thead><tr><th></th><th>${t("Rest.Long")}</th><th>${t("Rest.Short")}</th><th>Ki</th></tr></thead><tbody>${linhas}</tbody></table>
      <p class="hint">${t("Rest.HealerHint")}</p>
      <div class="form-group"><label>${t("Rest.World")}</label><select name="world">${opts(world, false)}</select></div>
      ${canvas?.scene ? `<div class="form-group"><label>${t("Rest.Scene", { scene: canvas.scene.name })}</label><select name="scene">${opts(sceneFlag, true)}</select></div>` : ""}`,
    ok: { label: t("Save"), icon: "fas fa-bed", callback: (event, button) => ({
      world: button.form.elements.world.value, scene: button.form.elements.scene?.value
    }) },
    rejectClose: false
  });
  if ( !result ) return;
  await game.settings.set(MODULE_ID, "restCondition", result.world);
  if ( canvas?.scene && (result.scene !== undefined) ) {
    if ( result.scene ) await canvas.scene.setFlag(MODULE_ID, "restCondition", result.scene);
    else await canvas.scene.unsetFlag(MODULE_ID, "restCondition");
  }
  ui.notifications.info(t("Rest.Now", { cond: t(`Rest.${restCondition()}`) }));
  rerenderSheets();
}

/* ============================================ */
/*  Foco de conjuração (botão na ficha do item) */
/* ============================================ */

Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  const item = app.document;
  if ( !(item instanceof Item) || !item.isOwner || !["equipment", "weapon", "tool", "loot", "consumable"].includes(item.type) ) return;
  app.options.actions ??= {};
  app.options.actions.dnd5eManaFocus ??= async function() {
    const doc = this.document;
    const current = doc.getFlag(MODULE_ID, "focus");
    // automático → foco → não é foco → automático
    const next = current === undefined ? true : current === true ? false : null;
    if ( next === null ) await doc.unsetFlag(MODULE_ID, "focus");
    else await doc.setFlag(MODULE_ID, "focus", next);
    ui.notifications.info(t(`Focus.State.${next === null ? "auto" : next ? "on" : "off"}`, { name: doc.name }));
  };
  controls.push({ action: "dnd5eManaFocus", icon: "fas fa-wand-sparkles", label: "DND5E_MANA.Focus.Toggle" });
});

/* ============================================ */
/*  Ficha                                       */
/* ============================================ */

function parseDelta(raw, current) {
  const text = String(raw).trim();
  if ( !text ) return current;
  const n = Number(text.replace(/^[+=]/, ""));
  if ( !Number.isFinite(n) ) return current;
  if ( /^[+-]/.test(text) ) return current + n;
  return n;
}

async function openManaConfig(actor) {
  const { parts, max, ability } = computeMana(actor);
  const { value } = getMana(actor);
  const bonus = Number(actor.getFlag(MODULE_ID, "bonus")) || 0;
  const rows = parts.map(p => `<tr><td>${Handlebars.escapeExpression(p.label)}</td><td class="num">${p.value >= 0 ? "+" : ""}${p.value}</td></tr>`).join("");
  const content = `
    <table class="dnd5e-mana-breakdown">
      <tbody>${rows || `<tr><td colspan="2">${t("Config.Empty")}</td></tr>`}</tbody>
      <tfoot><tr><th>${t("Config.Total")}</th><th class="num">${max}</th></tr></tfoot>
    </table>
    <p class="hint">${t("Config.AbilityUsed", { ability: CONFIG.DND5E.abilities[ability]?.label ?? ability })}</p>
    <div class="form-group">
      <label>${t("Config.Current")}</label>
      <input type="number" name="value" value="${value}" min="0">
    </div>
    <div class="form-group">
      <label>${t("ManualBonus")}</label>
      <input type="number" name="bonus" value="${bonus}">
    </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: t("Config.Title", { name: actor.name }) },
    classes: ["dnd5e-mana-dialog"],
    content,
    buttons: [{
      action: "save", label: t("Save"), icon: "fas fa-save", default: true,
      callback: (event, button) => ({
        value: button.form.elements.value.valueAsNumber,
        bonus: button.form.elements.bonus.valueAsNumber
      })
    }, {
      action: "restore", label: t("Config.Restore"), icon: "fas fa-battery-full",
      callback: () => "restore"
    }],
    rejectClose: false
  });
  if ( !result ) return;
  if ( result === "restore" ) {
    await actor.setFlag(MODULE_ID, "value", max);
    return;
  }
  const updates = {};
  if ( Number.isFinite(result.bonus) ) updates[`flags.${MODULE_ID}.bonus`] = result.bonus;
  if ( Number.isFinite(result.value) ) updates[FLAG_PATH] = Math.max(0, result.value);
  if ( !foundry.utils.isEmpty(updates) ) await actor.update(updates);
}

function buildMeter(actor, editable) {
  const { value, max } = getMana(actor);
  const pool = poolType(actor);
  const pct = max ? Math.round((value / max) * 100) : 0;
  const group = document.createElement("div");
  group.className = `meter-group dnd5e-mana pool-${pool}`;
  const cond = t(`Rest.${restCondition()}`);
  const focus = (pool === "mana") && setting("requireFocus") && actor.itemTypes?.spell?.length
    ? (findFocus(actor) ? "" : ` <i class="fas fa-triangle-exclamation dnd5e-mana-nofocus" data-tooltip="${t("Focus.Missing")}"></i>`)
    : "";
  group.innerHTML = `
    <div class="label roboto-condensed-upper">
      <span data-tooltip="${t("Rest.Tooltip", { cond })}">${t(pool === "ki" ? "Ki" : "Mana")}${focus}</span>
      ${editable ? `<button type="button" class="config-button unbutton dnd5e-mana-config" data-tooltip="${t("Config.Open")}"
        aria-label="${t("Config.Open")}"><i class="fas fa-cog" inert></i></button>` : ""}
    </div>
    <div class="meter sectioned mana meter-lg">
      <div class="progress mana" role="meter" aria-valuemin="0" aria-valuenow="${value}" aria-valuemax="${max}"
           style="--bar-percentage: ${pct}%">
        <div class="label">
          <span class="value">${value}</span><span class="separator">&sol;</span><span class="max">${max}</span>
        </div>
        <input type="text" class="dnd5e-mana-input" value="${value}" placeholder="0" hidden>
      </div>
    </div>`;

  if ( !editable ) return group;

  group.querySelector(".dnd5e-mana-config").addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openManaConfig(actor);
  });

  const progress = group.querySelector(".progress.mana");
  const input = group.querySelector(".dnd5e-mana-input");
  const label = progress.querySelector(".label");
  progress.addEventListener("click", event => {
    if ( event.target === input ) return;
    event.stopPropagation();
    label.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  });
  const commit = async () => {
    const next = Math.max(0, Math.round(parseDelta(input.value, value)));
    input.hidden = true;
    label.hidden = false;
    if ( next !== value ) await actor.setFlag(MODULE_ID, "value", next);
  };
  input.addEventListener("change", event => { event.stopPropagation(); });
  input.addEventListener("keydown", event => {
    if ( event.key === "Enter" ) { event.preventDefault(); event.stopPropagation(); input.blur(); }
    if ( event.key === "Escape" ) { input.value = value; input.blur(); }
  });
  input.addEventListener("blur", commit);
  return group;
}

function injectMeter(app, element) {
  const actor = app.document ?? app.actor;
  if ( !usesMana(actor) ) return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  if ( !root ) return;
  root.querySelectorAll(".meter-group.dnd5e-mana").forEach(el => el.remove());
  const meter = buildMeter(actor, app.isEditable ?? actor.isOwner);
  const hp = root.querySelector(".sidebar .meter.hit-points")?.closest(".meter-group");
  if ( hp ) hp.after(meter);
  else {
    const stats = root.querySelector(".sidebar .stats") ?? root.querySelector(".sidebar");
    if ( stats ) stats.append(meter);
  }
}

Hooks.on("renderCharacterActorSheet", injectMeter);
Hooks.on("renderNPCActorSheet", injectMeter);

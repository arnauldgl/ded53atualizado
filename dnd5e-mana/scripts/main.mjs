import { DEFAULT_RULES, MODULE_ID } from "./config.mjs";
import {
  FLAG_PATH, computeMana, featureCostPerUse, getMana, getRules, isConvertibleFeature, setting, spellCost, usesMana
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

  game.settings.register(MODULE_ID, "shortRestPercent", {
    name: "DND5E_MANA.Settings.ShortRest.Name",
    hint: "DND5E_MANA.Settings.ShortRest.Hint",
    scope: "world", config: true, type: Number, default: 25,
    range: { min: 0, max: 100, step: 5 }
  });

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
    setItemCost: (item, cost) => cost === null ? item.unsetFlag(MODULE_ID, "cost") : item.setFlag(MODULE_ID, "cost", cost)
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
  if ( !usesMana(actor) || (config.consume === false) ) return;
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
    ui.notifications.warn(t("Warn.NotEnough", { name: activity.item.name, cost, value }));
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
  if ( attr.replace(/^system\./, "") === FLAG_PATH ) options.label = t("Mana");
});

/* ============================================ */
/*  Descansos                                   */
/* ============================================ */

Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  if ( !usesMana(actor) ) return;
  const { value, max } = getMana(actor);
  let newValue = value;
  if ( (config.type ?? result.type) === "long" ) newValue = max;
  else {
    const pct = Number(setting("shortRestPercent")) || 0;
    newValue = Math.min(max, value + Math.ceil(max * pct / 100));
  }
  if ( newValue !== value ) result.updateData[FLAG_PATH] = newValue;
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
  const pct = max ? Math.round((value / max) * 100) : 0;
  const group = document.createElement("div");
  group.className = "meter-group dnd5e-mana";
  group.innerHTML = `
    <div class="label roboto-condensed-upper">
      <span>${t("Mana")}</span>
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

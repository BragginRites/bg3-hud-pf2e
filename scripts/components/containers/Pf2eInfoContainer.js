import { InfoContainer } from '/modules/bg3-hud-core/scripts/components/containers/InfoContainer.js';

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * Ability icon mapping (FontAwesome)
 */
const ABILITY_ICONS = {
  str: 'fas fa-fist-raised',
  dex: 'fas fa-running',
  con: 'fas fa-heart',
  int: 'fas fa-brain',
  wis: 'fas fa-eye',
  cha: 'fas fa-masks-theater'
};

/**
 * PF2e Info Container
 * Displays ability scores (header), skills (3-col grid), and saving throws (Fort/Ref/Will)
 */
export class Pf2eInfoContainer extends InfoContainer {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Render the PF2e specific content
   * @returns {Promise<HTMLElement>}
   */
  async renderContent() {
    const content = this.createElement('div', ['bg3-info-content']);

    // Top: Ability header row
    const header = await this.renderAbilitiesHeader();
    content.appendChild(header);

    // Middle: Saving throws (Fort/Ref/Will)
    const saves = await this.renderSaves();
    content.appendChild(saves);

    // Bottom: Skills grid (3 columns)
    const skillsGrid = await this.renderSkills();
    content.appendChild(skillsGrid);

    return content;
  }

  /**
   * Handle right-click on info button - roll initiative
   * @param {MouseEvent} event - The context menu event
   * @override
   */
  async onButtonRightClick(event) {
    if (!this.actor) {
      console.warn('Pf2e Info | No actor available for initiative roll');
      return;
    }

    try {
      // PF2e initiative roll
      if (typeof this.actor.rollInitiative === 'function') {
        await this.actor.rollInitiative({ createCombatants: true });
      }
    } catch (err) {
      console.error('Pf2e Info | Initiative roll failed', err);
      ui.notifications?.error(game.i18n.localize(`${MODULE_ID}.Notifications.FailedToRollInitiative`));
    }
  }

  /**
   * Render the ability scores header row
   * Each block: icon + short name, full name, large score, d20 with modifier
   * @returns {Promise<HTMLElement>}
   * @private
   */
  async renderAbilitiesHeader() {
    const header = this.createElement('div', ['bg3-info-abilities-header']);

    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const abilityNames = {
      str: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Strength`),
      dex: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Dexterity`),
      con: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Constitution`),
      int: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Intelligence`),
      wis: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Wisdom`),
      cha: game.i18n.localize(`${MODULE_ID}.Info.Abilities.Charisma`)
    };

    for (const abilityId of abilities) {
      const ability = this.actor.system.abilities[abilityId];
      const modifier = ability?.mod ?? 0;
      const score = ability?.value ?? 10;

      const block = this.createElement('div', ['bg3-info-ability-block']);

      // Row 1: short name
      const label = this.createElement('div', ['bg3-info-ability-label']);
      label.textContent = abilityId.toUpperCase();
      block.appendChild(label);

      // Row 2: large score
      const scoreEl = this.createElement('div', ['bg3-info-ability-score']);
      scoreEl.textContent = score;
      block.appendChild(scoreEl);

      // Row 3: d20 icon with modifier overlay
      const d20Wrapper = this.createElement('div', ['bg3-info-d20-modifier']);
      const d20Icon = this.createElement('i', ['fas', 'fa-dice-d20', 'bg3-d20-icon']);
      const d20Value = this.createElement('span', ['bg3-d20-value']);
      d20Value.textContent = modifier >= 0 ? `+${modifier}` : `${modifier}`;
      d20Wrapper.appendChild(d20Icon);
      d20Wrapper.appendChild(d20Value);
      block.appendChild(d20Wrapper);

      // PF2e doesn't have ability checks/saves in the same way, but we can
      // still allow clicking to show the modifier info
      block.setAttribute('data-tooltip', abilityNames[abilityId]);
      block.setAttribute('data-tooltip-direction', 'UP');

      header.appendChild(block);
    }

    return header;
  }

  /**
   * Render all skills in a 3-column grid
   * Skills are fetched dynamically from actor.skills (includes Lore)
   * @returns {Promise<HTMLElement>}
   * @private
   */
  async renderSkills() {
    const grid = this.createElement('div', ['bg3-info-skills-grid']);

    // PF2e v7.7.2+ requires actor.skills to be ready
    if (!this.actor?.skills) {
      console.warn('Pf2e Info | Skill data not ready');
      return grid;
    }

    // Gather all skills
    const skillEntries = [];
    for (const [skillSlug, skill] of Object.entries(this.actor.skills)) {
      const total = skill.mod ?? skill.value ?? 0;
      const proficiency = skill.rank ?? 0;
      const abilityKey = (skill.attribute || skill.ability || '').substring(0, 3).toUpperCase();

      skillEntries.push({
        slug: skillSlug,
        label: skill.label || skillSlug,
        total,
        proficiency,
        abilityKey,
        rollFn: typeof skill.roll === 'function' ? skill : null
      });
    }

    // Sort alphabetically by label
    skillEntries.sort((a, b) => a.label.localeCompare(b.label));

    // Split into 3 balanced columns
    const colCount = 3;
    const perCol = Math.ceil(skillEntries.length / colCount);

    for (let col = 0; col < colCount; col++) {
      const column = this.createElement('div', ['bg3-info-skills-column']);
      const start = col * perCol;
      const end = Math.min(start + perCol, skillEntries.length);

      for (let i = start; i < end; i++) {
        const entry = skillEntries[i];

        const skillDiv = this.createElement('div', ['bg3-info-skill']);

        // d20 Modifier
        const modifierWrapper = this.createElement('div', ['bg3-info-d20-modifier']);
        if (entry.proficiency === 4) {
          modifierWrapper.classList.add('legendary');
        } else if (entry.proficiency === 3) {
          modifierWrapper.classList.add('master');
        } else if (entry.proficiency === 2) {
          modifierWrapper.classList.add('expertise');
        } else if (entry.proficiency === 1) {
          modifierWrapper.classList.add('proficient');
        }

        const d20Icon = this.createElement('i', ['fas', 'fa-dice-d20', 'bg3-d20-icon']);
        const d20Value = this.createElement('span', ['bg3-d20-value']);
        d20Value.textContent = entry.total >= 0 ? `+${entry.total}` : `${entry.total}`;
        modifierWrapper.appendChild(d20Icon);
        modifierWrapper.appendChild(d20Value);
        skillDiv.appendChild(modifierWrapper);

        // Skill name
        const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
        nameSpan.textContent = entry.label;
        skillDiv.appendChild(nameSpan);

        // Ability abbreviation
        const abilitySpan = this.createElement('span', ['bg3-info-skill-ability']);
        abilitySpan.textContent = entry.abilityKey;
        skillDiv.appendChild(abilitySpan);

        // Click to roll skill
        const skillRef = entry.rollFn;
        this.addEventListener(skillDiv, 'click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          try {
            if (skillRef && typeof skillRef.roll === 'function') {
              skillRef.roll({ event: e });
            }
          } catch (err) {
            console.error('Pf2e Info | Skill roll failed', { skill: entry.slug, error: err });
          }
        });

        column.appendChild(skillDiv);
      }

      grid.appendChild(column);
    }

    return grid;
  }

  /**
   * Render saving throws (Fortitude, Reflex, Will)
   * PF2e saves are not ability-based, so they get their own section
   * @returns {Promise<HTMLElement>}
   * @private
   */
  async renderSaves() {
    const section = this.createElement('div', ['bg3-info-saves']);

    const saves = [
      { id: 'fortitude', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Fortitude`), key: 'fortitude' },
      { id: 'reflex', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Reflex`), key: 'reflex' },
      { id: 'will', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Will`), key: 'will' }
    ];

    const savesRow = this.createElement('div', ['bg3-info-saves-row']);

    for (const save of saves) {
      const saveObj = this.actor.saves?.[save.key];
      const total = saveObj?.mod ?? saveObj?.value ?? 0;
      const rank = saveObj?.rank ?? 0;

      const block = this.createElement('div', ['bg3-info-save-block']);

      // Label above d20
      const label = this.createElement('span', ['bg3-info-save-label']);
      label.textContent = save.name;
      block.appendChild(label);

      // d20 with modifier overlay
      const d20Wrapper = this.createElement('div', ['bg3-info-d20-modifier', 'bg3-info-save-d20']);
      if (rank === 4) d20Wrapper.classList.add('legendary');
      else if (rank === 3) d20Wrapper.classList.add('master');
      else if (rank === 2) d20Wrapper.classList.add('expertise');
      else if (rank === 1) d20Wrapper.classList.add('proficient');

      const d20Icon = this.createElement('i', ['fas', 'fa-dice-d20', 'bg3-d20-icon']);
      const d20Value = this.createElement('span', ['bg3-d20-value']);
      d20Value.textContent = total >= 0 ? `+${total}` : `${total}`;
      d20Wrapper.appendChild(d20Icon);
      d20Wrapper.appendChild(d20Value);
      block.appendChild(d20Wrapper);

      // Click to roll saving throw
      this.addEventListener(block, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const saveObj = this.actor.saves?.[save.key];
        if (!saveObj) return;
        try {
          if (typeof saveObj.roll === 'function') saveObj.roll({ event: e });
        } catch (err) {
          console.error('Pf2e Info | Save roll failed', { save: save.id, error: err });
        }
      });

      savesRow.appendChild(block);
    }

    section.appendChild(savesRow);
    return section;
  }
}

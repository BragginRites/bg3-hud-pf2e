import { InfoContainer } from '/modules/bg3-hud-core/scripts/components/containers/InfoContainer.js';

const MODULE_ID = 'bg3-hud-pf2e';

/**
 * Canonical skill ID mapping for PF2e v7.7.2+
 * Maps short IDs to full canonical skill names
 */
const CANONICAL_SKILL_IDS = {
    acr: "acrobatics",
    arc: "arcana",
    ath: "athletics",
    cra: "crafting",
    dec: "deception",
    dip: "diplomacy",
    itm: "intimidation",
    med: "medicine",
    nat: "nature",
    occ: "occultism",
    prf: "performance",
    rel: "religion",
    soc: "society",
    ste: "stealth",
    sur: "survival",
    thi: "thievery"
};

/**
 * PF2e Info Container
 * Displays ability scores, skills with proficiency tiers, and saving throws
 */
export class Pf2eInfoContainer extends InfoContainer {
    constructor(options = {}) {
        super(options);
        this.selectedAbility = 'str'; // Default to Strength
    }

    /**
     * Render the PF2e specific content
     * @returns {Promise<HTMLElement>}
     */
    async renderContent() {
        const content = this.createElement('div', ['bg3-info-content']);

        // Left column: Skills (filtered to selected ability)
        const skillsColumn = await this.renderSkills();
        content.appendChild(skillsColumn);

        // Center column: Ability Scores (always visible)
        const abilitiesColumn = await this.renderAbilities();
        content.appendChild(abilitiesColumn);

        // Right column: Saving Throws (Fortitude, Reflex, Will)
        const savesColumn = await this.renderSaves();
        content.appendChild(savesColumn);

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
     * Handle ability click - expand to show skills
     * @param {string} abilityId - The ability that was clicked
     * @private
     */
    async _onAbilityClick(abilityId) {
        // If clicking the same ability, collapse
        if (this.selectedAbility === abilityId) {
            this._resetExpanded();
            return;
        }
        
        this.selectedAbility = abilityId;
        
        // Re-render the panel content with filtered skills
        await this.update();
    }

    /**
     * Reset expanded state (back to just abilities)
     * @private
     */
    async _resetExpanded() {
        this.selectedAbility = null;
        
        // Re-render to hide skills
        await this.update();
    }

    /**
     * Get proficiency tier label
     * @param {number} tier - Proficiency tier (0-4)
     * @returns {string}
     * @private
     */
    _getProficiencyLabel(tier) {
        const labels = [
            game.i18n.localize(`${MODULE_ID}.PF2E.Proficiency.Untrained`),
            game.i18n.localize(`${MODULE_ID}.PF2E.Proficiency.Trained`),
            game.i18n.localize(`${MODULE_ID}.PF2E.Proficiency.Expert`),
            game.i18n.localize(`${MODULE_ID}.PF2E.Proficiency.Master`),
            game.i18n.localize(`${MODULE_ID}.PF2E.Proficiency.Legendary`)
        ];
        return labels[tier] || labels[0];
    }

    /**
     * Render ability scores
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderAbilities() {
        const column = this.createElement('div', ['bg3-info-abilities']);

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

            const abilityDiv = this.createElement('div', ['bg3-info-ability']);
            
            // Highlight selected ability
            if (abilityId === this.selectedAbility) {
                abilityDiv.classList.add('selected');
            }
            
            const nameSpan = this.createElement('span', ['bg3-info-ability-name']);
            nameSpan.textContent = abilityNames[abilityId];

            const scoreSpan = this.createElement('span', ['bg3-info-ability-score']);
            scoreSpan.textContent = score;

            const modifierSpan = this.createElement('span', ['bg3-info-ability-modifier']);
            if (modifier >= 0) {
                modifierSpan.classList.add('positive');
            }
            // Display raw numeric modifier; '+' is added via CSS for positive values
            modifierSpan.textContent = modifier;

            // Click to expand and show related skills
            this.addEventListener(abilityDiv, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._onAbilityClick(abilityId);
            });

            abilityDiv.appendChild(nameSpan);
            abilityDiv.appendChild(scoreSpan);
            abilityDiv.appendChild(modifierSpan);
            column.appendChild(abilityDiv);
        }

        return column;
    }

    /**
     * Render skills
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderSkills() {
        const column = this.createElement('div', ['bg3-info-skills']);

        // Don't render any skills if no ability is selected
        if (!this.selectedAbility) {
            return column;
        }

        // PF2e v7.7.2+ requires actor.skills to be ready
        if (!this.actor?.skills) {
            console.warn('Pf2e Info | Skill data not ready');
            return column;
        }

        // Header
        const header = this.createElement('div', ['bg3-info-section-header']);
        header.textContent = game.i18n.localize(`${MODULE_ID}.Info.SkillsHeader`);
        column.appendChild(header);

        // Filter and sort skills (including Lore)
        const skills = Object.values(this.actor.skills)
            .filter(s => s.attribute === this.selectedAbility || s.ability === this.selectedAbility)
            .sort((a, b) => a.label.localeCompare(b.label));

        for (const skill of skills) {
            const total = skill.mod ?? skill.value ?? 0;
            const proficiency = skill.rank ?? 0; // 0-4 for proficiency tier

            const skillDiv = this.createElement('div', ['bg3-info-skill']);

            const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
            nameSpan.textContent = skill.label;
            skillDiv.appendChild(nameSpan);

            // Add proficiency classes for border coloring
            if (proficiency === 4) {
                skillDiv.classList.add('legendary');
            } else if (proficiency === 3) {
                skillDiv.classList.add('master');
            } else if (proficiency === 2) {
                skillDiv.classList.add('expertise');
            } else if (proficiency === 1) {
                skillDiv.classList.add('proficient');
            }

            const modifierSpan = this.createElement('span', ['bg3-info-skill-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            modifierSpan.textContent = total;
            skillDiv.appendChild(modifierSpan);

            // Click to roll skill
            this.addEventListener(skillDiv, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    if (typeof skill.roll === 'function') {
                        skill.roll({ event: e });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Skill roll failed', { skill: skill.slug, error: err });
                }
            });

            column.appendChild(skillDiv);
        }

        return column;
    }

    /**
     * Render saving throws
     * PF2e has Fortitude, Reflex, and Will (not ability-based)
     * @returns {Promise<HTMLElement>}
     * @private
     */
    async renderSaves() {
        const column = this.createElement('div', ['bg3-info-saves']);

        // Header
        const header = this.createElement('div', ['bg3-info-section-header']);
        header.textContent = game.i18n.localize(`${MODULE_ID}.Info.SavesHeader`);
        column.appendChild(header);

        const saves = [
            { id: 'fortitude', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Fortitude`), key: 'fortitude' },
            { id: 'reflex', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Reflex`), key: 'reflex' },
            { id: 'will', name: game.i18n.localize(`${MODULE_ID}.Info.Saves.Will`), key: 'will' }
        ];

        for (const save of saves) {
            // PF2e v7.7.2+ saves are on actor.saves (NOT actor.system.saves)
            const saveObj = this.actor.saves?.[save.key];
            // PF2e v7.7.2+ uses 'mod' for the total modifier value
            const total = saveObj?.mod ?? saveObj?.value ?? 0;

            const saveDiv = this.createElement('div', ['bg3-info-save']);
            
            // Add proficiency classes for border coloring
            const rank = saveObj?.rank ?? 0;
            if (rank === 4) {
                saveDiv.classList.add('legendary');
            } else if (rank === 3) {
                saveDiv.classList.add('master');
            } else if (rank === 2) {
                saveDiv.classList.add('expertise');
            } else if (rank === 1) {
                saveDiv.classList.add('proficient');
            }

            const nameSpan = this.createElement('span', ['bg3-info-save-name']);
            nameSpan.textContent = save.name;

            const modifierSpan = this.createElement('span', ['bg3-info-save-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            // Display raw total; '+' is added via CSS for positive values
            modifierSpan.textContent = total;

            // Click to roll saving throw
            this.addEventListener(saveDiv, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const saveObj = this.actor.saves?.[save.key];
                if (!saveObj) return;
                
                try {
                    if (typeof saveObj.roll === 'function') {
                        saveObj.roll({ event: e });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Save roll failed', { save: save.id, error: err });
                }
            });

            saveDiv.appendChild(nameSpan);
            saveDiv.appendChild(modifierSpan);
            column.appendChild(saveDiv);
        }

        return column;
    }
}


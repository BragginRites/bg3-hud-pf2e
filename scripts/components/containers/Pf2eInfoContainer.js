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
        if (this.panel) {
            this.panel.innerHTML = '';
            const content = await this.renderContent();
            this.panel.appendChild(content);
        }
    }

    /**
     * Reset expanded state (back to just abilities)
     * @private
     */
    async _resetExpanded() {
        this.selectedAbility = null;
        
        // Re-render to hide skills
        if (this.panel) {
            this.panel.innerHTML = '';
            const content = await this.renderContent();
            this.panel.appendChild(content);
        }
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

            const abilityDiv = this.createElement('div', ['bg3-info-ability']);
            
            // Highlight selected ability
            if (abilityId === this.selectedAbility) {
                abilityDiv.classList.add('selected');
            }
            
            const nameSpan = this.createElement('span', ['bg3-info-ability-name']);
            nameSpan.textContent = abilityNames[abilityId];

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

        // PF2e skills mapped to abilities
        const skills = {
            acr: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Acrobatics`), ability: 'dex' },
            arc: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Arcana`), ability: 'int' },
            ath: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Athletics`), ability: 'str' },
            cra: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Crafting`), ability: 'int' },
            dec: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Deception`), ability: 'cha' },
            dip: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Diplomacy`), ability: 'cha' },
            itm: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Intimidation`), ability: 'cha' },
            med: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Medicine`), ability: 'wis' },
            nat: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Nature`), ability: 'wis' },
            occ: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Occultism`), ability: 'int' },
            prf: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Performance`), ability: 'cha' },
            rel: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Religion`), ability: 'wis' },
            soc: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Society`), ability: 'int' },
            ste: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Stealth`), ability: 'dex' },
            sur: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Survival`), ability: 'wis' },
            thi: { name: game.i18n.localize(`${MODULE_ID}.Info.Skills.Thievery`), ability: 'dex' }
        };

        for (const [skillId, skillData] of Object.entries(skills)) {
            // Only show skills related to selected ability
            if (skillData.ability !== this.selectedAbility) {
                continue;
            }
            
            // PF2e v7.7.2+ uses canonical skill IDs (e.g., "athletics" not "ath")
            const skillIdCanonical = CANONICAL_SKILL_IDS[skillId];
            if (!skillIdCanonical) {
                console.warn('Pf2e Info | Unknown skill ID', { skillId });
                continue;
            }
            
            // PF2e v7.7.2+ skills are on actor.skills with canonical IDs
            const skill = this.actor.skills?.[skillIdCanonical];
            // PF2e v7.7.2+ uses 'mod' for the total modifier value
            const total = skill?.mod ?? skill?.value ?? 0;
            const proficiency = skill?.rank ?? 0; // 0-4 for proficiency tier

            const skillDiv = this.createElement('div', ['bg3-info-skill']);

            const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
            nameSpan.textContent = skillData.name;

            const modifierSpan = this.createElement('span', ['bg3-info-skill-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            // Display raw total; '+' is added via CSS for positive values
            modifierSpan.textContent = total;
            
            // Add proficiency tier indicator
            if (proficiency > 0) {
                const profLabel = this.createElement('span', ['bg3-info-skill-proficiency']);
                profLabel.textContent = this._getProficiencyLabel(proficiency).charAt(0); // First letter
                profLabel.title = this._getProficiencyLabel(proficiency);
                skillDiv.appendChild(profLabel);
            }

            // Click to roll skill
            this.addEventListener(skillDiv, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const skillObj = this.actor.skills?.[skillIdCanonical];
                if (!skillObj) {
                    console.warn('Pf2e Info | Skill not found', { skillIdCanonical });
                    return;
                }
                
                try {
                    // PF2e v7.7.2+ uses skill.roll(event)
                    if (typeof skillObj.roll === 'function') {
                        skillObj.roll({ event: e });
                    } else {
                        console.warn('Pf2e Info | No compatible skill roll method', { skillIdCanonical });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Skill roll failed', { skillIdCanonical, error: err });
                }
            });

            skillDiv.appendChild(nameSpan);
            skillDiv.appendChild(modifierSpan);
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
                if (!saveObj) {
                    console.warn('Pf2e Info | Save not found', { save: save.key });
                    return;
                }
                
                try {
                    // PF2e v7.7.2+ uses save.roll(event)
                    if (typeof saveObj.roll === 'function') {
                        saveObj.roll({ event: e });
                    } else {
                        console.warn('Pf2e Info | No compatible save roll method', { save: save.key });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Save roll failed', { save: save.key, error: err });
                }
            });

            saveDiv.appendChild(nameSpan);
            saveDiv.appendChild(modifierSpan);
            column.appendChild(saveDiv);
        }

        return column;
    }
}


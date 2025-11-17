import { InfoContainer } from '/modules/bg3-hud-core/scripts/components/containers/InfoContainer.js';

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
            ui.notifications?.error('Failed to roll initiative');
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
        const labels = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];
        return labels[tier] || 'Untrained';
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
            str: 'Strength',
            dex: 'Dexterity',
            con: 'Constitution',
            int: 'Intelligence',
            wis: 'Wisdom',
            cha: 'Charisma'
        };

        for (const abilityId of abilities) {
            const ability = this.actor.system.abilities[abilityId];
            const modifier = ability?.mod || 0;

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
            modifierSpan.textContent = modifier >= 0 ? `+${modifier}` : modifier;

            // Click to expand and show related skills
            this.addEventListener(abilityDiv, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._onAbilityClick(abilityId);
            });
            
            // Right-click to roll ability check
            this.addEventListener(abilityDiv, 'contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!this.actor?.system?.abilities?.[abilityId]) {
                    console.warn('Pf2e Info | Ability data not ready', { abilityId });
                    return;
                }
                
                try {
                    // PF2e ability check roll
                    if (typeof this.actor.rollSkill === 'function') {
                        // PF2e uses rollSkill for ability checks
                        this.actor.rollSkill({
                            skill: abilityId,
                            event: e
                        });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Ability check roll failed', { abilityId, error: err });
                }
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

        // Header
        const header = this.createElement('div', ['bg3-info-section-header']);
        header.textContent = 'Skills';
        column.appendChild(header);

        // PF2e skills mapped to abilities
        const skills = {
            acr: { name: 'Acrobatics', ability: 'dex' },
            arc: { name: 'Arcana', ability: 'int' },
            ath: { name: 'Athletics', ability: 'str' },
            cra: { name: 'Crafting', ability: 'int' },
            dec: { name: 'Deception', ability: 'cha' },
            dip: { name: 'Diplomacy', ability: 'cha' },
            itm: { name: 'Intimidation', ability: 'cha' },
            med: { name: 'Medicine', ability: 'wis' },
            nat: { name: 'Nature', ability: 'wis' },
            occ: { name: 'Occultism', ability: 'int' },
            prf: { name: 'Performance', ability: 'cha' },
            rel: { name: 'Religion', ability: 'wis' },
            soc: { name: 'Society', ability: 'int' },
            ste: { name: 'Stealth', ability: 'dex' },
            sur: { name: 'Survival', ability: 'wis' },
            thi: { name: 'Thievery', ability: 'dex' }
        };

        for (const [skillId, skillData] of Object.entries(skills)) {
            // Only show skills related to selected ability
            if (skillData.ability !== this.selectedAbility) {
                continue;
            }
            
            const skill = this.actor.system.skills[skillId];
            const total = skill?.value || 0;
            const proficiency = skill?.rank || 0; // 0-4 for proficiency tier

            const skillDiv = this.createElement('div', ['bg3-info-skill']);

            const nameSpan = this.createElement('span', ['bg3-info-skill-name']);
            nameSpan.textContent = skillData.name;

            const modifierSpan = this.createElement('span', ['bg3-info-skill-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            modifierSpan.textContent = total >= 0 ? `+${total}` : total;
            
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
                
                if (!this.actor?.system?.skills?.[skillId]) {
                    console.warn('Pf2e Info | Skill data not ready', { skillId });
                    return;
                }
                
                try {
                    // PF2e skill roll
                    if (typeof this.actor.rollSkill === 'function') {
                        this.actor.rollSkill({
                            skill: skillId,
                            event: e
                        });
                    }
                } catch (err) {
                    console.error('Pf2e Info | Skill roll failed', { skillId, error: err });
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
        header.textContent = 'Saves';
        column.appendChild(header);

        const saves = [
            { id: 'fortitude', name: 'Fortitude', key: 'fortitude' },
            { id: 'reflex', name: 'Reflex', key: 'reflex' },
            { id: 'will', name: 'Will', key: 'will' }
        ];

        for (const save of saves) {
            const saveData = this.actor.system.saves[save.key];
            const total = saveData?.value || 0;

            const saveDiv = this.createElement('div', ['bg3-info-save']);

            const nameSpan = this.createElement('span', ['bg3-info-save-name']);
            nameSpan.textContent = save.name;

            const modifierSpan = this.createElement('span', ['bg3-info-save-modifier']);
            if (total >= 0) {
                modifierSpan.classList.add('positive');
            }
            modifierSpan.textContent = total >= 0 ? `+${total}` : total;

            // Click to roll saving throw
            this.addEventListener(saveDiv, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!this.actor?.system?.saves?.[save.key]) {
                    console.warn('Pf2e Info | Save data not ready', { save: save.key });
                    return;
                }
                
                try {
                    // PF2e saving throw roll
                    if (typeof this.actor.rollSavingThrow === 'function') {
                        this.actor.rollSavingThrow({
                            type: save.key,
                            event: e
                        });
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


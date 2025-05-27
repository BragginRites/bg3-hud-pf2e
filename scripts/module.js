const MODULE_NAME = "bg3-hud-pf2e",
    maxActions = {
        action: 3,
        reaction: 1
    };

Hooks.on("BG3HotbarInit", async (BG3Hotbar) => {
    const [BG3CONFIG, BG3UTILS] = BG3Hotbar.getConfig();

    BG3CONFIG.COMMON_ACTIONS = {
        "MHLuKy4nQO2Z4Am1" : "administerFirstAid",
        "M76ycLAqHoAgbcej" : "balance",
        "q9nbyIF0PEBqMtYe" : "commandAnAnimal",
        "qVNVSmsgpKFGk9hV" : "concealAnObject",
        "GkmbTGfg8KcgynOA" : "createADiversion",
        "2u915NdUyQan6uKF" : "demoralize",
        "cYdz2grcOcRt4jk6" : "disableDevice",
        "Dt6B1slsBy8ipJu9" : "disarm",
        "QNAVeNKtHA0EUw4X" : "feint",
        "SjmKHgI7a5Z9JzBx" : "forceOpen",
        "PMbdMWc2QroouFGD" : "grapple",
        "XMcnh4cSI32tljXa" : "hide",
        "2HJ4yuEFY1Cast4h" : "highJump",
        "JUvAvruz7yRQXfz2" : "longJump",
        "ijZ0DDFpMkWqaShd" : "palmAnObject",
        "EEDElIyin4z60PXx" : "perform",
        "2EE4aF4SZpYf0R6H" : "pickALock",
        "DCb62iCBrJXy0Ik6" : "request",
        "BlAOM2X92SI6HMtJ" : "seek",
        "1xRFPTFtWtGJ9ELw" : "senseMotive",
        "7blmbDrQFNfdT731" : "shove",
        "VMozDqMMuK5kpoX4" : "sneak",
        "RDXXE7wMrSPCLv5k" : "steal",
        "ge56Lu1xXVFYUnLP" : "trip",
        "21WIfSu7Xd7uKqV8" : "tumbleThrough"
    };

    BG3UTILS.check2Handed = function(item) {
        return item?.hands == 2 || item?.item?.hands == 2;
    }
    
    BG3UTILS.getItem = async function(item, actor) {
        if(!item) return;
        if(item.slug) {
            if(item.type === 'common') return game.pf2e.actions.get(item.slug);
            else return actor.system.actions?.find(a => a.slug === item.slug);
        } else if(item.uuid) return await fromUuid(item.uuid);
        else return item;
    }

    BG3UTILS.itemIsPassive = function(item) {
        return item.actionType === 'passive';
    }

    BG3UTILS.applyEffect = async function(actor, target, item, effect) {
        const effectClass = CONFIG.PF2E.Item.documentClasses.effect;
        if (effect instanceof effectClass) {
            const traits = item.system.traits.value?.filter(
                    (t2) => t2 in effectClass.validTraits
                ) ?? [],
                effectSource = foundry.utils.mergeObject(effect.toObject(), {
                _id: null,
                system: {
                    context: {
                    origin: {
                        actor: actor.uuid,
                        token: actor.getActiveTokens(!0, !0).at(0)?.uuid ?? null,
                        item: item.uuid,
                        spellcasting: null,
                        rollOptions: item.getOriginData().rollOptions,
                    },
                    target: {
                        actor: target.uuid,
                        token: target.getActiveTokens(!0, !0).at(0)?.uuid ?? null,
                    },
                    roll: null,
                    },
                    traits: { value: traits },
                },
            });
            await target.createEmbeddedDocuments("Item", [effectSource]);
        }
    }

    BG3UTILS.getItemAction = function(item) {
        let action = {actionType : {}, actions : {}};
        if(!item) return action;
        
        if (item.type == "weapon" || item.type == "shield") {
            action.actionType.value = "action";
            action.actions.value = 1;
        }
        else {
            if (item.system?.actionType?.value) {
                action.actionType.value = item.system.actionType.value;
                action.actions.value = item.system.actions.value;
            }
            else {
                if (item.system?.time) {
                    if (["1", "2", "3"].find(time => item.system.time.value.includes(time))) {
                        action.actionType.value = "action";
                        action.actions.value = Number(["1", "2", "3"].find(time => item.system.time.value.includes(time)));
                    }
                    
                    if (item.system.time.value == "reaction") {
                        action.actionType.value = "reaction";
                    }
                    
                    if (item.system.time.value == "free") {
                        action.actionType.value = "free";
                    }
                }
                else {
                    let dom = $((new DOMParser).parseFromString(item.system?.description?.value, "text/html"));
                    let actionGlyphs = dom.find("span.action-glyph");
                    let glyphText = "";
                    for (let i = 0; i < actionGlyphs.length; i++) {
                        glyphText = glyphText + actionGlyphs[i].innerHTML;
                    }
                    
                    if (glyphText.toUpperCase().includes("F")) {
                        action.actionType.value = "free";
                    }
                    
                    for (let keys of [["1", "A"], ["2", "D"], ["3", "T"]]) {
                        if (glyphText.includes(keys[0]) || glyphText.toUpperCase().includes(keys[1])) {
                            action.actionType.value = "action";
                            action.actions.value = Number(keys[0]);
                        }
                    }
                    
                    if (glyphText.toUpperCase().includes("R")) {
                        action.actionType.value = "reaction";
                    }
                }
            }
        }
        
        if (!action.actionType.value) {
            //assume one action by default
            action.actionType.value = "action";
            action.actions.value = 1;
        }
        
        return action;
    }

    BG3UTILS.getItemAndAction = function(data, actor) {
        let action, item;
        if (data) {   
            if (actor) {
                if (data.system?.slug) {
                    item = data;
                    action = actor.system.actions.find(action => action.slug == item.system.slug && action.item == item);
                    if (!action) action = actor.system.actions.find(action => action.slug == item.system.slug);
                }
                else if(data.item?.linkedWeapon || data.item){
                    action = data;
                    item = data.item?.linkedWeapon ?? data.item;
                    if(item) {
                        if (item.getFlag(MODULE_NAME, "thrown") || item.getFlag(MODULE_NAME, "combination-melee")) {
                            if (action?.altUsages?.length) action = action.altUsages[0];
                            else {
                                if (item.getFlag(MODULE_NAME, "thrown")) {
                                    action = actor.system.actions.find(action => action.slug == item.name.toLowerCase() && action.options.includes("ranged"));
                                }
                                if (item.getFlag(MODULE_NAME, "combination-melee")) {
                                    action = actor.system.actions.find(action => action.slug == item.name.toLowerCase() && action.options.includes("melee"));
                                }
                            }
                        }
                    }
                } else if(data.uuid && actor.items.get(data.uuid)){
                    const tmpItem = actor.items.get(data.uuid);
                    if(tmpItem) {
                        item = tmpItem;
                        action = actor.system.actions.find(action => action.item == tmpItem);
                    }
                }
            }
        }
        
        return [item ?? data, action];
    }

    class PF2EAbilityContainer extends CONFIG.BG3HUD.COMPONENTS.PORTRAIT.ABILITY {
        constructor(data) {
            super(data);
        }

        getProfColor(proficient, rank) {
            return proficient ? rank > 1 ? 'color: #c866ff' : 'color: #3498db' : ''
        }

        getSaveMod(key) {
            let mod = 0,
                modString = '';
            const save = this.actor.saves[key];
            mod = save?.mod ?? 0;
            modString = mod >= 0 ? `+${mod}` : mod.toString();
            return {value: modString, style: this.getProfColor(save?.proficient, save?.rank)};
        }

        getAbilityMod(key) {
            let mod = 0,
                modString = '';
            const abilityScore = this.actor.abilities?.[key] || { value: 10, proficient: false };
            mod = abilityScore?.mod ?? 0;
            modString = mod >= 0 ? `+${mod}` : mod.toString();
            return {value: modString, style: this.getProfColor(abilityScore?.proficient, abilityScore?.rank)};
        }

        getSkillMod(key) {
            const skills = {},
                skillsList = this.getSkillsList();
            let count = 0;
            Object.entries(skillsList).forEach(([k, v]) => {
                if(v.attribute !== key) return;
                count++;
                const skill = skillsList?.[k] || { proficient: false },
                    mod = skill.mod ?? 0,
                    modStr = mod >= 0 ? `+${mod}` : mod.toString();
                skills[k] = {label:  v.label, icon: 'fas fa-dice-d20', value: modStr, style: this.getProfColor(skill?.proficient, skill?.rank), click: (event) => v.check.roll({event: event})}
            });
            return count > 0 ? skills : null;
        }

        getSkillsList() {
            const list = {perception : this.actor.perception, ...this.actor.skills}
            return Object.keys(list).sort().reduce(
                (obj, key) => { 
                    obj[key] = list[key]; 
                    return obj;
                }, 
                {}
            )
        }

        getInitMethod() {
            return this.actor.rollInitiative.bind(this.actor);
        }

        updateInitSkill(event) {
            this.actor.update({system : {initiative : {statistic : event.target.value}}});
        }

        getMenuBtns() {
            let btns = {};
            for(const save in this.actor.saves) {
                const saveMod = this.getSaveMod(save);
                btns[save] = {
                    label: game.i18n.localize(CONFIG.PF2E.saves[save]),
                    class: 'ability-container',
                    ...saveMod,
                    click: (event) => this.actor.saves[save].check.roll({event: event}),
                    icon: 'fas fa-dice-d20'
                }
            };
            btns['divider1'] = {label: 'divider'};
            for(const abl in this.actor.abilities) {
                const abilityMod = this.getAbilityMod(abl);
                btns[abl] = {
                    label: game.i18n.localize(CONFIG.PF2E.abilities[abl]),
                    class: 'ability-container',
                    ...abilityMod,
                    subMenu: [
                        {
                            position: 'topright', name: 'skillMenu', event: 'click',
                            buttons: this.getSkillMod(abl)
                        }
                    ]
                }
            };
            btns['divider2'] = {label: 'divider'};
            const initSelect = $('<select>'),
                skillsList = this.getSkillsList();
            for(const skill in skillsList) {
                initSelect.append($('<option>').attr('selected', skill === this.actor.system.initiative.statistic).val(skill).text(skillsList[skill].label));
            }
            initSelect.attr('name', 'init-select');
            
            btns['init'] = {
                label: game.i18n.localize('PF2E.InitiativeLabel'),
                custom: initSelect.get(0).outerHTML,
                click: (event) => {
                    event.preventDefault();
                    event.stopPropagation()
                }
            }
            $(this.element).off('change', 'select[name="init-select"]', this.updateInitSkill)
            $(this.element).on('change', 'select[name="init-select"]', this.updateInitSkill)
            return btns;
        }
    }

    class PF2EDeathSavesContainer extends CONFIG.BG3HUD.COMPONENTS.PORTRAIT.DEATH {
        constructor(data) {
            super(data);
        }

        getData() {
            return {
                display: game.settings.get(BG3CONFIG.MODULE_NAME, 'showDeathSavingThrow'), 
                data1: {
                    value: this.actor.system.attributes.dying?.value ?? 0,
                    max: this.actor.system.attributes.dying?.max ?? 0,
                    update: async (value) => {
                        const cond = this.actor.getCondition('dying');
                        if(cond) await game.pf2e.ConditionManager.updateConditionValue(cond.id, this.actor, value)
                    }
                },
                data2: {
                    value: this.actor.system.attributes.wounded?.value ?? 0,
                    max: this.actor.system.attributes.wounded?.max ?? 0,
                    update: async (value) => {
                        const cond = this.actor.getCondition('wounded');
                        if(cond) await game.pf2e.ConditionManager.updateConditionValue(cond.id, this.actor, value)
                    }
                }
            }
        }

        isVisible() {
            return this.getData().data1?.value > 0 || this.getData().data2?.value > 0;
        }

        async skullClick(event) {
            event.preventDefault();
            event.stopPropagation();
            this.getData().data1?.value > 0 && await this.actor.rollRecovery(event);
        }
    }

    class PF2ERestTurnContainer extends CONFIG.BG3HUD.COMPONENTS.RESTTURN {
        constructor(data) {
            super(data);
        }

        async getRestBtns() {
            const btnData = [];
            if(this.actor) {
                btnData.push(
                    {
                        type: 'div',
                        label: "Refocus",
                        class: ["rest-turn-button"],
                        visible: () => !game.combat?.started && this.actor.system.resources?.focus?.max,
                        events: {
                            'click': () => {
                                let value = Math.min(this.actor.system.resources.focus.max - this.actor.system.resources.focus.value, 1);
                                
                                if (value > 0) {
                                    this.actor.update({system : {resources : {focus : {value : Math.min(this.actor.system.resources.focus.value + value, this.actor.system.resources.focus.max)}}}});
                                    ChatMessage.create({content : `${this.actor.name} regained <b>${value}</b> focus point`})
                                }
                            }
                        },
                        icon: "fa-book-open-reader",
                        size: this.actor.skills.medicine.rank && this.actor.system.resources?.focus?.max ? 0.5 : 1
                    },
                    {
                        type: 'div',
                        class: ["rest-turn-button"],
                        label: (await fromUuid("Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9")).name,
                        icon: "fa-kit-medical",
                        visible: () => !game.combat?.started && this.actor.skills.medicine.rank,
                        events: {
                            'click': () => game.pf2e.actions.treatWounds({actors : this.actor})
                        },
                        size: this.actor.skills.medicine.rank && this.actor.system.resources?.focus?.max ? 0.5 : 1
                    },
                    {
                        type: 'div',
                        class: ["rest-turn-button"],
                        label: 'Rest for the Night',
                        icon: "fa-tent",
                        visible: () => !game.combat?.started,
                        events: {
                            'click': () => game.pf2e.actions.restForTheNight({actors: this.actor})
                        }
                    }
                )
            };
            return btnData;
        }
    }

    class PF2EFilterContainer extends CONFIG.BG3HUD.COMPONENTS.HOTBAR.FILTER {
        constructor(data) {
            super(data);
        }

        get filterData() {
            const countAction = this.getActorAction('action');
            const filterData = [
                {
                    id: 'action',
                    label: 'Action',
                    class: ['action-type-button', 'spell-level-button', 'filter-has-adv'],
                    adv: `<i class="action-glyph" style="z-index: 1">${countAction > 0 ? countAction : ''}</i><i class="action-glyph" style="position: absolute; color: darkred;">${maxActions.action}</i>`,
                    color: BG3CONFIG.COLORS.ACTION
                },
                {
                    id: 'reaction',
                    label: 'Reaction',
                    img: {class: 'action-glyph font-large', value: 'R'},
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.REACTION
                },
                {
                    id: 'free',
                    label: 'Free Action',
                    img: {class: 'action-glyph font-large', value: 'F'},
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.BONUS
                },
                {
                    id: 'feature',
                    label: 'Feature',
                    img: {class: 'action-glyph font-large', value: '◇'},
                    class: ['action-type-button'],
                    color: BG3CONFIG.COLORS.FEATURE_HIGHLIGHT
                }
            ];

            // Spells Filters
            let spellCasting = this.actor.items.filter(entry => entry.type == "spellcastingEntry");

            // Add focus spell
            let focus = spellCasting.filter(entry => entry.system.prepared.value == "focus");
            if(focus.length) {
                filterData.push({
                    id: 'spell',
                    label: 'Focus',
                    preparationMode: 'focus',
                    level: 0,
                    short: 'F',
                    max : this.actor.system.resources.focus.max,
                    value : this.actor.system.resources.focus.value,
                    class: ['spell-level-button', 'spell-focus-box'],
                    color: BG3CONFIG.COLORS.PACT_MAGIC
                });
            }
            

            let others = spellCasting.filter(entry => entry.system.prepared.value !== "focus"),
                otherSpell = others.flatMap(o => o.spells.contents);
            // Add cantrip spell
            let cantrips = otherSpell.filter(s => s.isCantrip)
            if(cantrips.length) {
                filterData.push({
                    id: 'spell',
                    label: 'Cantrip',
                    level: 0,
                    max: 1,
                    value: 1,
                    class: ['spell-level-button', 'spell-cantrip-box'],
                    color: BG3CONFIG.COLORS.SPELL_SLOT
                });
            }
            for (let level = 1; level <= 11; level++) {
                const spellLevelKey = `slot${level}`;
                const spellLevel = others.map(o => {
                    return {prepared: o.system.prepared, slot: o.system.slots[spellLevelKey]};
                }).reduce(
                    (accumulator, currentValue) => {
                        const tmpAcc = {value: accumulator.value + currentValue.slot.value, max: accumulator.max, rmax: accumulator.rmax + currentValue.slot.max}
                        if(currentValue.prepared.value === "spontaneous" || (currentValue.prepared.value === "prepared" && currentValue.prepared.flexible)) tmpAcc.max += currentValue.slot.max;
                        return tmpAcc;
                    },
                    {value: 0, max: 0, rmax: 0},
                );

                if (spellLevel?.rmax > 0) {
                    filterData.push({
                        id: 'spell',
                        label: 'Spell Rank',
                        level: level,
                        value: spellLevel.value,
                        max: spellLevel.max,
                        short: this._getRomanNumeral(level),
                        class: [...['spell-level-button'], ...(spellLevel.max === 0 ? ['filter-spell-point'] : [])],
                        color: BG3CONFIG.COLORS.SPELL_SLOT
                    });
                }
            }
            
            return filterData;
        }

        _autoCheckUsed() {
            if(!game.settings.get(MODULE_NAME,'synchroBRMidiQoL')) return;
            if(!game.combat?.started) return;

            const actionFilter = this.components.find(f => f.data.id === 'action'),
                reactionFilter = this.components.find(f => f.data.id === 'reaction'),
                actionCount = this.getActorAction('action'),
                reactionCount = this.getActorAction('reaction');

            if((!this.used.includes(actionFilter) && actionCount === 0) || (this.used.includes(actionFilter) && actionCount > 0)) this.used = actionFilter;

            if((!this.used.includes(reactionFilter) && reactionCount === 0) || (this.used.includes(reactionFilter) && reactionCount > 0)) this.used = reactionFilter;
        }

        getActorAction(actionType) {
            let actionCount = this.actor.getFlag(MODULE_NAME, actionType);
            if(actionCount === undefined) {
                this.actor.setFlag(MODULE_NAME, actionType, maxActions[actionType]);
                actionCount = maxActions[actionType];
            }
            return actionCount;
        }
    }

    class PF2EActiveContainer extends CONFIG.BG3HUD.COMPONENTS.HOTBAR.ACTIVE {
        constructor(data) {
            super(data);
        }

        get activesList() {
            if(!this.token && !this.actor) return null;
            const conditions = this.actor.conditions?.active ?? [],
                effects = this.actor.itemTypes.effect ?? [];

            // Get active effects from the actor's sheet.
            return [...conditions, ...effects];
        }
    }

    class PF2EAutoPopulateFeature extends CONFIG.BG3HUD.FEATURES.POPULATE {
        static getItemsList(actor, itemTypes, manager) {
            let itemsList = [];
            if(itemTypes.includes('spell')) {
                let spellCastings = actor.items.filter(entry => entry.type == "spellcastingEntry");
                for(let spellCasting of spellCastings) {
                    if(!(spellCasting.system.prepared.value == "prepared" && !spellCasting.system.prepared.flexible)) {
                        for(let spell of spellCasting.spells.contents) {
                            const item = actor.items.get(spell.id);
                            itemsList.push({uuid: item.uuid, type: item.type, actionType: item.system.actionType?.value, override: {level: item.system.level.value}});
                        }
                    } else {
                        for(let slot in spellCasting.system.slots) {
                            if(spellCasting.system.slots[slot].max) {
                                const level = slot.replace('slot', '');
                                for(let spell of spellCasting.system.slots[slot].prepared) {
                                    const item = actor.items.get(spell.id),
                                        isExists = itemsList.find(i => i.uuid === item.uuid && i.override?.level === level);
                                    if(!isExists) itemsList.push({uuid: item.uuid, type: item.type, actionType: item.system.actionType?.value, override: {level: level}});
                                }
                            }
                        }
                    }
                }
                itemTypes.splice(itemTypes.indexOf('spell'), 1);
            }

            return [...itemsList, ...actor.items.filter(i => itemTypes.includes(i.type)).map(i => {return {uuid: i.uuid, type: i.type, actionType: i.system.actionType?.value}})];
        }

        static constructItemData(item) {
            return item;
        }

        static async _getCombatActionsList(actor) {
            return game.settings.get(BG3CONFIG.MODULE_NAME, 'choosenCPRActions').map(a => {return {slug: a, type: 'common'}});
        }

        static async _populateWeaponsToken(actor, manager) {
            if (!actor) return;

            try {
                // Process each container
                const attacksList = actor.system.actions;
                if(attacksList.length) {
                    for(let i = 0; i < attacksList.length; i = i+2) {
                        const gridKey = `0-0`,
                            containerIndex = Math.floor(i/2),
                            item = attacksList[i],
                            item2 = attacksList[i+1];
                        if(i < 6) {
                            manager.containers.weapon[containerIndex].items = {};
                            const itemData = {slug: item.slug, uuid: item.item?.linkedWeapon?.uuid ?? item.item?.uuid ?? item.uuid ?? null};
                            manager.containers.weapon[containerIndex].items[gridKey] = itemData;
                            if(item2) {
                                const itemData2 = {slug: item2.slug, uuid: item2.item?.linkedWeapon?.uuid ?? item2.item?.uuid ?? item2.uuid ?? null};
                                manager.containers.weapon[containerIndex].items['1-0'] = itemData2;
                            }
                        }
                    }
                }     
            } catch (error) {
                console.error("BG3 Inspired Hotbar | Error auto-populating weapons token hotbar:", error);
            }
        }
    }

    class PF2EWeaponContainer extends CONFIG.BG3HUD.COMPONENTS.WEAPON {
        constructor(data) {
            super(data);
        }

        async autoEquipWeapons(c) {
            let toUpdate = [];
            const compareOld = c.index === this.activeSet ? c.oldWeapons : this.components.weapon[this.activeSet].data.items,
                otherSetsWeapons = this.components.weapon.filter(wc => wc.index !== c.index).flatMap(wc => Object.values(wc.data.items)),
                activeWeapons = Object.values(this.components.weapon[c.index].data.items),
                inactiveWeapons = otherSetsWeapons.filter(w => !Object.values(this.components.weapon[c.index].data.items).map(v => v.uuid).includes(w.uuid));
            inactiveWeapons.forEach((data) => {
                const item = this.actor.items.find(i => i.uuid === data.uuid);
                if(item && item.system?.equipped?.carryType !== 'worn') toUpdate.push({_id: item.id, name: item.name,system : {equipped : {carryType : "worn"}}});
            });
            activeWeapons.forEach((data) => {
                const item = this.actor.items.find(i => i.uuid === data.uuid);
                if(item && (item.system?.equipped?.carryType !== 'held' || item.system?.equipped?.handsHeld !== c.data.items['0-0']?.hands)) toUpdate.push({_id: item.id, name: item.name, system : {equipped : {carryType : "held", handsHeld : c.data.items['0-0']?.hands ?? 1}}});
            });
            c.oldWeapons = foundry.utils.deepClone(c.data.items);

            if(toUpdate.length) await this.actor.updateEmbeddedDocuments("Item", toUpdate);
        }
    }

    class PF2EGridCell extends CONFIG.BG3HUD.CORE.CELL {
        constructor(data, parent) {
            super(data, parent);
        }

        async useAction(actionType, actions = 1) {
            if(!game.combat?.started) return;
            let used = actions;
            
            if (isNaN(used)) used = 1;
            if(actionType === 'free') return used;

            const currentCount = this.actor.getFlag(MODULE_NAME, actionType);
            await this.actor.setFlag(MODULE_NAME, actionType, Math.min(Math.max(currentCount - used, 0), maxActions[actionType]));

            if(ui.BG3HOTBAR.components.container.components.filterContainer) {
                await ui.BG3HOTBAR.components.container.components.filterContainer.render();
                ui.BG3HOTBAR.components.container.components.filterContainer._autoCheckUsed()
            }
            
            return used;
        }

        getActionType(itemData) {
            const actionInfo = BG3UTILS.getItemAction(itemData);
            return actionInfo?.actionType?.value?.toLowerCase() ?? null;
        }

        getPreparationMode(itemData) {
            return itemData.spellcasting?.system?.prepared?.value ?? null;
        }

        async useItem(item, e, override) {
            let used = false,
                options = {};
            if(item?.type === 'spell') {
                const fpCost = item.system.cast.focusPoints;
                if(item.atWill || ((item.isFocusSpell || item.isCantrip) && fpCost === 0) || ((this.actor.system.resources.focus?.value ?? 0)) >= fpCost) {
                    if(item.toChat) item.toChat(e);
                    used = true;
                }
                item.spellcasting.cast(item, {consume : true, rank : Number(override?.level ?? item.system.level?.value)});
            } else {
                if(item.execute) item.execute();
                else if(item.roll) {
                    let mapFlag = this.actor.getFlag(BG3CONFIG.MODULE_NAME, "advState"),
                        map = mapFlag === 'advBtn' ? 1 : (mapFlag === 'disBtn' ? 2 : 0),
                        variant = item.variants?.[map];
                    used = await (variant ?? item).roll({event: e});
                }
                else if(item.use) {
                    options = {
                        configureDialog: false,
                        legacy: false,
                        event: e
                    };
                    used = await item.use(options, { event: e });
                } else if(item.consume) {
                    item.consume(e);
                    if(item.toChat) item.toChat(e);
                        used = true;
                } else if(this.data?.item?.type === 'common' && game.pf2e.actions[this.data.item.slug]) {
                    game.pf2e.actions[this.data.item.slug]({actors: this.actor})
                    used = true;
                } else if((item.type === "action" || item.type === "feat") && item.system.selfEffect) {
                    const effect = await fromUuid(item.system.selfEffect.uuid);
                    await BG3UTILS.applyEffect(this.actor, this.actor, item, effect);
                } else {
                    const settings = {actors: this.actor, event: e}
                    if (game.pf2e.actions[item.system?.slug]) {
                        game.pf2e.actions[item.system?.slug](settings);
                        used = true;
                    } else if (game.pf2e.actions.get(item.system?.slug)) {
                        game.pf2e.actions.get(item.system?.slug).toActionVariant().use(settings);
                        used = true;
                    } else if(item.toChat) {
                        item.toChat(e);
                        used = true;
                    } else if(item.sheet?.render) {
                        item.sheet.render(true);
                        used = true;
                    }
                }
            }
            const usedAction = BG3UTILS.getItemAction(item);
            if(usedAction.actionType.value && used) await this.useAction(usedAction.actionType.value, usedAction.actions.value);
            return used;
        }

        async getData() {
            let itemData = await this.item,
                data = {};
            if(itemData) {
                data = {...data, ...{
                        uuid: itemData.slug ?? itemData.uuid,
                        name: itemData.name ?? itemData.label,
                        icon: itemData.img ?? itemData.item?.linkedWeapon?.img ?? itemData.item?.img ?? 'icons/svg/book.svg',
                        actionType: this.getActionType(itemData),
                        itemType: itemData.type,
                        quantity: itemData.system?.quantity && itemData.system?.quantity > 1 ? itemData.system?.quantity : false
                    },
                    ...await this.getItemUses()
                };
            }
            return data; 
        }

        can2Handed(action) {
            return action?.auxiliaryActions?.find(action => action.annotation == "grip");
        }

        hasFeats(actor, featNames) {
            let featNamearray = Array.isArray(featNames) ? featNames : [featNames];
            
            return featNamearray.some(featName => {
                let featIDarray = Array.isArray(featIds[featName]) ? featIds[featName] : [featIds[featName]];
                
                return Boolean(actor.items.find(item => featIDarray.some(id => item.flags?.core?.sourceId?.includes(id))));
            });
        }

        async getItemMenuBtns() {
            let btns = {},
                cellItem = await this.item,
                [item, action] = BG3UTILS.getItemAndAction(cellItem, this.actor),
                actionType = BG3UTILS.getItemAction(cellItem)?.actionType?.value;
            if(item) {
                if (item.requiresAmmo || item.ammoRequired > 0) {
                    btns.ammo = {
                        icon : "fas fa-bow-arrow",
                        click : (event) => {},
                        change: (event) => {
                            item.update({system : {selectedAmmoId : event.target.value}});
                        },
                        keepOpen: true,
                        label : 'Ammo',
                        custom: `<select>${[{name : "", id : ""},...this.actor.items.filter(item => item.isAmmo)].map(a => `<option${item.system.selectedAmmoId == a.id ? ' selected' : ''} value="${a.id}">${a.name}</option>`)}</select>`
                    };
                }

                if ((item.type === "shield" || item.shield?.type === "shield") && (actionType === "action" || (actionType === "reaction" && this.hasFeats(this.actor,"reactive-shield")))) {
                    btns.raise = {
                        label: (await fromUuid("Compendium.pf2e.actionspf2e.Item.xjGwis0uaC2305pm")).name,
                        icon: 'fas fa-shield',
                        click: async () => {
                            await game.pf2e.actions.raiseAShield({actors : this.actor});
                            ui.BG3HOTBAR.components.portrait?._renderInner();
                        },
                        custom: this.actor.system.attributes.shield?.raised ? '<i class="fa-solid fa-check"></i>' : null
                    }
                }
                    
                let toggleoptions = ["versatile", "modular"];
                
                for (let togglekey of toggleoptions) {
                    if (item?.system?.traits.toggles) {
                        let toggle = item.system.traits.toggles[togglekey];
                        
                        if (toggle?.options?.length) {
                            let options = [null, ...toggle.options];
                            
                            let current = toggle.selected;
                            let currentid = options.indexOf(current);
                            let next = options[(currentid + 1)%options.length];
                            
                            if (current == null) {
                                current = item.system.damage.damageType;
                            }
                            
                            btns[togglekey] = {
                                label : game.i18n.localize("PF2E.Trait" + togglekey.charAt(0).toUpperCase() + togglekey.slice(1)),
                                icon : "fas " + BG3UTILS.getDamageIcon(current),
                                click : () => {
                                    item.update({system : {traits : {toggles : {[togglekey] : {selected : next}}}}})
                                }
                            };
                        }
                    }
                }
                    
                if (item.isThrowable && !item.system?.traits?.value?.includes("consumable")) {
                    let isthrown = item.getFlag(MODULE_NAME, "thrown");
                    
                    btns.throw = {
                        icon : "fas fa-arrow-right-to-arc",
                        click : () => {item.setFlag(MODULE_NAME, "thrown", !isthrown)},
                        label : game.i18n.localize("PF2E.TraitThrown"),
                        custom: isthrown ? '<i class="fa-solid fa-check"></i>' : null
                    };
                }
                    
                if (item?.system?.traits.value?.includes("combination")) {
                    let ismelee = item.getFlag(MODULE_NAME, "combination-melee");
                    btns.combination = {
                        icon : "fas fa-gun",
                        click : () => {item.setFlag(MODULE_NAME, "combination-melee", !ismelee)},
                        label : game.i18n.localize("PF2E.TraitCombination"),
                        custom: !ismelee ? '<i class="fa-solid fa-check"></i>' : null
                    };
                }
                    
                if (this.slotKey === '0-0' && actionType == "action") {
                    const gripAction = this.can2Handed(action);
                    if(gripAction) {
                        btns.grip = {
                            icon : "fas fa-hand-fist",
                            click : async () => {
                                await gripAction?.execute();
                                this.data.item.hands = item.system.equipped.handsHeld;
                            },
                            label : gripAction.label
                        };
                    }
                }
                    
                if (actionType == "action") {
                    let sdAction = action?.auxiliaryActions?.find(a => a.annotation == "sheathe" || a.annotation == "draw");
                    
                    if (sdAction) {
                        btns.sheathedraw = {
                            icon : "fas " + (sdAction === 'sheathe' ? 'fa-hand-back-fist' : 'fa-tshirt'),
                            click : async () => {
                                await sdAction?.execute();
                            },
                            label : sdAction?.label || ""
                        };
                    }
                }
            }
            return btns;
        }

        async getItemUses() {
            const item = await this.item,
                level = this.data.item?.override?.level ?? item.level;
            if(item) {
                if(item.spellcasting && !item.isCantrip) {
                    if(item.spellcasting.system.prepared.value === "prepared" && !item.spellcasting.system.prepared.flexible) {
                        const spellArray = item.spellcasting.system.slots[`slot${level}`]?.prepared.filter(s => s.id === item.id);
                        return spellArray.length ? {uses: {value: spellArray.filter(s => !s.expended).length, max: spellArray.length}} : null;
                    }
                }
            }
            return null;
        }
    }

    class PF2ECPRActionsDialog extends CONFIG.BG3HUD.DIALOGS.CPR {
        constructor () {
            super();
        }

        async getData() {
            const actions = [];
            for(const id in BG3CONFIG.COMMON_ACTIONS) {
                const action = await fromUuid("Compendium.pf2e.actionspf2e.Item." + id);
                if(game.pf2e.actions.get(action.slug)) actions.push({...game.pf2e.actions.get(action.slug), '_id': action.slug});
            }
                console.log(BG3CONFIG.COMMON_ACTIONS, game.settings.get(BG3CONFIG.MODULE_NAME, 'choosenCPRActions'))
            return {actions, selected: game.settings.get(BG3CONFIG.MODULE_NAME, 'choosenCPRActions')};
        }
    }

    class PF2EAdvContainer extends CONFIG.BG3HUD.COMPONENTS.ADVANTAGE {
        constructor(data) {
            super(data);
        }
        
        isVisible() {
            return game.settings.get(MODULE_NAME, 'addAdvBtnsMidiQoL');
        }
        
        getBtnData() {
            return [
                {
                    type: 'div',
                    key: 'advBtn',
                    label: '2nd',
                    title: 'Set your next action as the 2nd.',
                    events: {
                        'mouseup': this.setState.bind(this),
                    }
                },
                {
                    type: 'div',
                    key: 'disBtn',
                    label: '3rd',
                    title: 'Set your next action as the 3rd.',
                    events: {
                        'mouseup': this.setState.bind(this),
                    }
                }
            ];
        }
    
        async setState(event) {
            const key = event?.target?.closest('[data-key]')?.dataset.key;
            if(event === null || this.actor.getFlag(BG3CONFIG.MODULE_NAME, "advState") === key) await this.actor.unsetFlag(BG3CONFIG.MODULE_NAME, "advState");
            else await this.actor.setFlag(BG3CONFIG.MODULE_NAME, "advState", key);
            if(!this.actor.getFlag(BG3CONFIG.MODULE_NAME, "advOnce")) await this.actor.setFlag(BG3CONFIG.MODULE_NAME, "advOnce", false);
            
            this.updateButtons();
        }
    }

    class PF2EItemUpdateManager extends CONFIG.BG3HUD.MANAGERS.ITEM {
        constructor() {
            super();
        }
    
        async retrieveNewItem(data, cell) {
            let newItem = null,
                hasUpdate = false;
            if(data.type === 'Action') {
                const action = ui.BG3HOTBAR.manager.actor?.system.actions[data.index] ?? null;
                if(action) {
                    newItem = {slug: action.slug, uuid: action.item?.linkedWeapon?.uuid ?? action.item?.uuid ?? null};
                    hasUpdate = true;
                }
            } else {
                if(data.uuid) {
                    const item = await fromUuid(data.uuid);
                    if(item) {
                        hasUpdate = true;
                        const action = ui.BG3HOTBAR.manager.actor.system.actions.find(a => a.item?.linkedWeapon?.uuid === item.uuid || a.item?.uuid === item.uuid);
                        if(action && cell._parent.id === 'weapon') return await this.retrieveNewItem({type: 'Action', index: ui.BG3HOTBAR.manager.actor.system.actions.indexOf(action)}, cell);
                        else newItem = {uuid: data.uuid};
                    }
                }
            }
            return [newItem, hasUpdate];
        }
    }

    class PF2EActiveButton extends CONFIG.BG3HUD.BUTTONS.ACTIVE {
        constructor(data, parent) {
            super(data, parent);
        }

        async update() {
            return null;
        }

        get itemLabel() {
            return this.data.item.name;
        }
    }
    
    class PF2EBG3TooltipManager extends CONFIG.BG3HUD.MANAGERS.TOOLTIP {
        constructor() {
            super();
        }

        _init() {
            super._init();

            const oldActivate = TooltipManager.prototype.activate;
            TooltipManager.prototype.activate = function(element, {text, direction, cssClass, locked=false, content}={}) {
                oldActivate.bind(this)(element, {text, direction, cssClass, locked, content});
                if(this.tooltip.classList.contains('item-tooltip')) {
                    const loadingEl = this.tooltip.querySelector('section.loading'),
                        uuid = loadingEl?.dataset.uuid;
                    if(uuid) {
                        new Promise(async (resolve, reject) => {
                            const item = game.pf2e.actions.get(uuid) ?? await fromUuid(uuid);
                            if(!item) return;
                            const data = {
                                    ...(await ui.BG3HOTBAR.tooltipManager.getTooltipDetails(item)),
                                    controlHints: true
                                },
                                tooltipTpl = await renderTemplate(`modules/${MODULE_NAME}/templates/tooltips/item-tooltip.hbs`, data);
                            resolve(tooltipTpl);
                        }).then((result) => {
                            this.tooltip.innerHTML = result;
                            this._setAnchor(direction ?? 'UP');
                        })
                    }
                }
            }
        }

        traitsofItem(data, action) {
            let traits = (data.value ?? data)?.map((trait) => {return {id : trait}}) ?? [];
            
            if (action) {
                let actionTraits = action.traits.map(trait => {
                    return {
                        id : trait.name,
                        label : trait.label
                    }
                });
                
                actionTraits = actionTraits.concat(action.additionalEffects?.map((trait) => {
                    return {
                        id : trait.tag,
                        label : trait.label
                    }
                }));
                
                actionTraits = actionTraits.filter(trait => trait);
                
                actionTraits = actionTraits.filter(trait => !traits.find(includedtrait => includedtrait.id == trait.id));
                
                traits = traits.concat(actionTraits);
            }

            for(let trait of traits) {
                let localizationstring = trait.id?.split("-").map(string => BG3UTILS.firstUpper(string));
                let diceinfo = "";
                if (localizationstring?.length > 1) diceinfo = localizationstring.pop();
                if (!trait.label) {
                    let namelocalization = "PF2E.Trait" + localizationstring.join("");
                    let name = game.i18n.localize(namelocalization);
                    
                    if (namelocalization != name) {
                        trait.label = [name, diceinfo].join(" ");
                    }
                    else {
                        trait.label = trait.id.toUpperCase();
                    }
                }
                    
                let hintlocalization = "PF2E.TraitDescription" + localizationstring.join("");
                let hint = game.i18n.localize(hintlocalization);
                
                if (hintlocalization != hint) {
                    trait.hint = hint;
                }
            }
            
            return traits;
        }

        categoryIcon(category) {
            let iconclass = [];
            
            if (!category) return iconclass;
            
            switch (category.toLowerCase()) {
                case "interaction":
                    return ["fa-solid", "fa-hand"];
                case "defensive":
                    return ["fa-solid", "fa-circle-dot"];
                case "offensive":
                    return ["fa-solid", "fa-swords"];
                case "familiar":
                    return ["fa-solid", "fa-cat"];
                default:
                    return [];
            }
        }

        damagecategoryIcon(category) {
            switch (category) {
                case "persistent": return `<i class="fa-solid fa-hourglass"></i>`;
                case "precision": return `<i class="fa-solid fa-crosshair"></i>`;
                case "splash": return `<i class="fa-solid fa-burst"></i>`;
                default : return "";
            }
        }

        actionGlyphs(actionType, number = 0) {
            switch(actionType) {
                case "action":
                    return ["1", "2", "3"][number-1];
                case "free":
                    return "F";
                case "reaction":
                    return "R";
                case "passive":
                    return "◇";
                default:
                    return [];
            }
        }

        actionGlyphofItem(item) {
            if (item.system?.actionType?.value) {
                return this.actionGlyphs(item.system.actionType.value, item.system.actions.value);
            }
            
            let actionInfo = BG3UTILS.getItemAction(item);
            
            if (actionInfo) {
                return this.actionGlyphs(actionInfo.actionType.value, actionInfo.actions.value);
            }
        }

        MAPtext(item, MAP = 0) {
            let [_, action] = BG3UTILS.getItemAndAction(item, this.actor ?? null);
            
            let variant = action?.variants[MAP];
            
            if (action && variant) {
                let mapString = variant.label?.substring(
                    variant.label.indexOf("(") + 1, 
                    variant.label.lastIndexOf(")")
                );
                
                return mapString;
            }
            else {
                let penaltyLevel = 5;
                
                if (item?.system?.traits?.value?.includes("agile")) {
                    penaltyLevel = 4;
                }
                
                let penalty = -MAP * penaltyLevel;
                
                return BG3UTILS.replacewords(game.i18n.localize("PF2E.MAPAbbreviationLabel"), {penalty : penalty});
            }
        }

        getTooltipDetails = async function(itemData) {
            let title, description, subtitle, img, traits, details;
            
            const [item, action] = BG3UTILS.getItemAndAction(itemData, itemData.actor ?? null),
                actor = item.actor;
                    
            if (item.system?.identification?.status == "unidentified" && game.user.isGM) {
                title = item.system.identification.unidentified.name;
                description = item.system.identification.unidentified.data.description.value;
                subtitle = game.i18n.localize("PF2E.identification.Unidentified");
            }
            else {
                const system = item.system ?? item;

                title = game.i18n.localize(item.name);
                img = item.img ?? item.item?.linkedWeapon?.img ?? item.item?.img ?? 'icons/svg/book.svg';
                if(system) {
                    description = await TextEditor.enrichHTML(game.i18n.localize(system.description?.value ?? system.description));
                    subtitle = system.traits?.rarity ? game.i18n.localize("PF2E.Trait" + BG3UTILS.firstUpper(system.traits?.rarity)) : '';
                    if (system?.level?.hasOwnProperty("value")) {
                        subtitle = subtitle + ` ${BG3UTILS.replacewords(game.i18n.localize("PF2E.LevelN"), {level : system.level.value})}`;
                    }
                    if(system.traits) traits = this.traitsofItem(system.traits, action);

                    details = [];
            
                    let actionGlyph = this.actionGlyphofItem(item);
                    if (actionGlyph) {
                        title = `${title} <span class=\"action-glyph\">${actionGlyph}</span>`;
                    }
                    
                    if (item.type == "melee") {
                        details.push({
                            label: game.i18n.localize("PF2E.Roll.Type"),
                            value: item.isMelee ? game.i18n.localize("PF2E.NPCAttackMelee") : game.i18n.localize("PF2E.NPCAttackRanged")
                        });
                    }
                    
                    if (system.target?.value) {
                        details.push({
                            label: game.i18n.localize("PF2E.SpellTargetLabel"),
                            value: system.target?.value
                        });
                    }
                    
                    if (system.category && item.type == "action") {
                        let actionicon = this.categoryIcon(system.category);
                        
                        details.push({
                            label: game.i18n.localize("PF2E.Category"),
                            value: game.i18n.localize("PF2E.Item.Ability.Category." + BG3UTILS.firstUpper(system.category)) + (actionicon.length ? ` <i class="${actionicon.join(" ")}"></i>` : "")
                        });
                    }
                    
                    let range;
                    if (item.type == "weapon" || item.type == "shield") {
                        if (system.rangelabel) {
                            range = system.rangelabel;
                        }
                        else {
                            if (system.range) {
                                range = BG3UTILS.replacewords(game.i18n.localize("PF2E.WeaponRangeN"), {range : system.range});
                            }
                            else {
                                range = BG3UTILS.replacewords(game.i18n.localize("PF2E.Item.Weapon.NoRangeMelee"));
                            }
                        }
                    }
                    else {
                        if (system.range) {
                            range = system.range;
                            
                            if (range && range.hasOwnProperty("value")) {
                                range = range.value;
                            }
                        }
                    }
                    if (range) {
                        details.push({
                            label: game.i18n.localize("PF2E.TraitRange"),
                            value: range
                        });
                    }
                    
                    if (system.area) {
                        details.push({
                            label: game.i18n.localize("PF2E.Area.Label"),
                            value: BG3UTILS.replacewords(game.i18n.localize("PF2E.WeaponRangeN"), {range : system.area.value}) + " " + game.i18n.localize("PF2E.Area.Shape." + system.area.type)
                        });
                    }
                    
                    let Attackvalue = system.attackValue;
                    if (!Attackvalue) {
                        let action = item.actor?.system.actions.find(action => action.slug == system.slug);
                        if (action?.variants?.length) {
                            Attackvalue = action.variants[0].label;
                        }
                        
                        if (!Attackvalue && item.type == "melee") {
                            Attackvalue = system?.bonus?.value
                        }
                    }
                    if (Attackvalue || (Attackvalue === 0)) {
                        details.push({
                            label: game.i18n.localize("PF2E.TraitAttack"),
                            value: `${Attackvalue > 0 ? "+" : ""}${Number(Attackvalue)}`
                        });
                        
                        let mapValues = [this.MAPtext(item, 1), this.MAPtext(item, 2)].filter(map => map).map(map => map.split(" ")[1]);
                        if (mapValues.length == 2) {
                            details.push({
                                label: game.i18n.localize("PF2E.MAPAbbreviationLabel").split(" ")[0],
                                value: mapValues.join("/")
                            });
                        }
                    }
                    
                    if (system.acBonus) {
                        details.push({
                            label: game.i18n.localize("PF2E.ArmorArmorLabel"),
                            value: system.acBonus
                        });
                    }
                    
                    if (item.type == "shield") {
                        if (system.hasOwnProperty("hardness")) {
                            details.push({
                                label: game.i18n.localize("PF2E.HardnessLabel"),
                                value: system.hardness
                            });
                        }
                        
                        if (system.hp?.hasOwnProperty("brokenThreshold")) {
                            details.push({
                                label: game.i18n.localize("PF2E.Item.Physical.BrokenThreshold.Label"),
                                value: system.hp.brokenThreshold
                            });
                        }
                    }
                    
                    let damageentry;
                    if (item.type == "spell" || item.type == "melee") {
                        let damages = item.type == "spell" ? system.damage : system.damageRolls
                        let entries = [];
                        for (let key of Object.keys(damages)) {
                            let type = damages[key].type || damages[key].kind || damages[key].damageType,
                                formula = await BG3UTILS.damageToRange(damages[key].formula || damages[key].damage);
                            entries.push(`${formula} ${this.damagecategoryIcon(damages[key].category)} <i class="fas ${ BG3UTILS.getDamageIcon(type ?? Object.values(damages[key].kinds))}"></i>`)
                        }
                        damageentry = entries.join("<br>");
                    }
                    else {
                        if (system.damage) {
                            let type = system.damage.damageType || system.damage.kind;
                            
                            let formula = await BG3UTILS.damageToRange(system.damage.dice && system.damage.die ? `${system.damage.dice}${system.damage.die}` : system.damage.formula);
                            damageentry = `${formula} ${this.damagecategoryIcon(system.damage.category)} <i class="fas ${ BG3UTILS.getDamageIcon(type)}"></i>`
                        }
                    }
                    if (damageentry) {
                        details.push({
                            label: game.i18n.localize("PF2E.DamageLabel"),
                            value: damageentry
                        });
                    }
                    if (system.duration?.value > -1 || system.duration?.sustained) {
                        let symbol = "";
                        if (system.duration?.sustained) {
                            symbol = `<i class="fa-solid fa-s"></i> `;
                        }
                        
                        details.push({
                            label: game.i18n.localize("PF2E.Time.Duration"),
                            value: symbol + system.duration.value
                        });
                    }
                    
                    if (system.defense?.save?.statistic) {
                        details.push({
                            label: game.i18n.localize("PF2E.Item.Spell.Defense.Label"),
                            value: game.i18n.localize("PF2E.Saves" + BG3UTILS.firstUpper(system.defense.save.statistic))
                        });
                    }
                }
            }

            return { title, description, subtitle, img, traits, details };
        }
    }

    BG3Hotbar.overrideClass('COMPONENTS.PORTRAIT.ABILITY', PF2EAbilityContainer);
    BG3Hotbar.overrideClass('COMPONENTS.PORTRAIT.DEATH', PF2EDeathSavesContainer);
    BG3Hotbar.overrideClass('COMPONENTS.RESTTURN', PF2ERestTurnContainer);
    BG3Hotbar.overrideClass('COMPONENTS.ADVANTAGE', PF2EAdvContainer);
    BG3Hotbar.overrideClass('COMPONENTS.HOTBAR.FILTER', PF2EFilterContainer);
    BG3Hotbar.overrideClass('COMPONENTS.HOTBAR.ACTIVE', PF2EActiveContainer);
    BG3Hotbar.overrideClass('COMPONENTS.WEAPON', PF2EWeaponContainer);
    BG3Hotbar.overrideClass('DIALOGS.CPR', PF2ECPRActionsDialog);
    BG3Hotbar.overrideClass('MANAGERS.TOOLTIP', PF2EBG3TooltipManager);
    BG3Hotbar.overrideClass('CORE.CELL', PF2EGridCell);
    BG3Hotbar.overrideClass('FEATURES.POPULATE', PF2EAutoPopulateFeature);
    BG3Hotbar.overrideClass('MANAGERS.ITEM', PF2EItemUpdateManager);
    BG3Hotbar.overrideClass('BUTTONS.ACTIVE', PF2EActiveButton);

    game.settings.menus.get(BG3CONFIG.MODULE_NAME + ".chooseCPRActions").type = PF2ECPRActionsDialog;
    game.settings.menus.get(BG3CONFIG.MODULE_NAME + ".chooseCPRActions").visible = () => true;
    game.settings.settings.get(BG3CONFIG.MODULE_NAME + ".choosenCPRActions").default = ["feint", "grapple", "hide", "seek", "shove", "sneak"];
    game.settings.settings.get(BG3CONFIG.MODULE_NAME + ".dataExtraInfo").default = [
        {attr: 'attributes.ac.value', icon: 'fas fa-shield', color: '#5abef5', pos: 'Top Left'},
        {attr: 'resources.heroPoints.value', icon: 'fas fa-star', color: '#ffdd00', pos: 'Top Right'},
        {attr: '', icon: '', color: '', pos: 'Left'},
        {attr: '', icon: '', color: '', pos: 'Right'},
        {attr: '', icon: '', color: '', pos: 'Bottom Left'},
        {attr: '', icon: '', color: '', pos: 'Bottom Right'}
    ];
});


Hooks.once('ready', () => {
    game.settings.register(MODULE_NAME, 'synchroBRMidiQoL', {
        name: 'BG3.Settings.synchroMidiQoL.BR.Name',
        hint: 'BG3.Settings.synchroMidiQoL.BR.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        onChange: () => {
            if(ui.BG3HOTBAR.components?.container?.components?.filterContainer) ui.BG3HOTBAR.components.container.components.filterContainer._autoCheckUsed();
        }
    });

    game.settings.register(MODULE_NAME, 'addAdvBtnsMidiQoL', {
        name: 'BG3.Settings.synchroMidiQoL.ADV.Name',
        hint: 'BG3.Settings.synchroMidiQoL.ADV.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
        onChange: value => {
            if(ui.BG3HOTBAR.components?.advantage) {
                if(value) ui.BG3HOTBAR.components.advantage._renderInner();
                else ui.BG3HOTBAR.components.advantage.destroy();
            }
        }
    });
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if(!ui.BG3HOTBAR.manager) return;
    if(actor?.id !== ui.BG3HOTBAR.manager.actor?.id) return;
    if(changes?.system?.resources) ui.BG3HOTBAR.refresh.bind(ui.BG3HOTBAR)();
});

Hooks.on("updateItem", async (item, changes, options, userId) => {
    if(!ui.BG3HOTBAR.manager) return;
    if(!ui.BG3HOTBAR.manager.actor || ui.BG3HOTBAR.manager.actor.items.get(item.id) !== item) return;
    if(changes?.system?.slots) ui.BG3HOTBAR.refresh.bind(ui.BG3HOTBAR)();
});

Hooks.on("updateCombat", async (combat, updates) => {
    if (combat.active !== true || !(updates && ("round" in updates || "turn" in updates))) return;
    const currentCombatant = combat.combatants.get(combat.current.combatantId);
    let update = false;
    if(combat.current.round > combat.previous.round) {
        for(const c of combat.combatants) {
            const reactionCount = c.actor.getFlag(MODULE_NAME, 'reaction');
            if(reactionCount !== maxActions.reaction) {
                await c.actor.setFlag(MODULE_NAME, 'reaction', maxActions.reaction);
                if(c.actor === ui.BG3HOTBAR.manager.actor) update = true;
            }
        };
    }
    if(currentCombatant && (combat.current.round > combat.previous.round || combat.current.turn > combat.previous.turn)) {
        const actionCount = currentCombatant.actor.getFlag(MODULE_NAME, 'action');
        if(actionCount !== maxActions.action) {
            await currentCombatant.actor.setFlag(MODULE_NAME, 'action', maxActions.action);
            update = true;
        }
    }
    if(update) ui.BG3HOTBAR.refresh.bind(ui.BG3HOTBAR)();
});
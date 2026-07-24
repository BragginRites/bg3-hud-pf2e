/**
 * PF2e Weapon Set Container
 * Extends base WeaponSetContainer with PF2e specific features:
 * - Two-handed weapons occupy both slots (faded duplicate in the off-hand)
 * - Detects both usage "held-in-two-hands" (Maul) and "two-hand-dX" traits (War Axe)
 * - Equips those weapons with handsHeld: 2 from the carousel
 * - Prevents drops on locked second slots
 */

import { createLogger } from '/modules/bg3-hud-core/scripts/utils/logger.js';

const log = createLogger('bg3-hud-pf2e');

export async function createPf2eWeaponSetContainer() {
    const { WeaponSetContainer } = await import('../../../../bg3-hud-core/scripts/components/containers/WeaponSetContainer.js');

    return class Pf2eWeaponSetContainer extends WeaponSetContainer {
        constructor(options = {}) {
            super(options);
        }

        /**
         * Whether this weapon should occupy both carousel slots right now.
         * - Always: native 2H usage (Maul)
         * - While gripped 2H (active set only): any weapon with handsHeld === 2
         * - Default for two-hand-dX trait weapons when not explicitly 1H (War Axe)
         * @param {Item} item
         * @param {{respectGrip?: boolean}} [options]
         * @returns {boolean}
         * @private
         */
        _itemOccupiesBothSlots(item, { respectGrip = true } = {}) {
            if (!item || item.type !== 'weapon') return false;

            // True 2H-only weapons
            if (item.system?.usage?.value === 'held-in-two-hands') return true;
            if (item.hands === '2') return true;

            if (respectGrip) {
                const handsHeld = Number(item.system?.equipped?.handsHeld) || 0;
                // Any weapon currently wielded in two hands (versatile longsword, etc.)
                if (handsHeld >= 2) return true;
                // Explicit 1H grip: single slot even if the weapon can go 2H
                if (handsHeld === 1) return false;
            }

            // Not gripped yet (or grip ignored on inactive sets): two-hand-dX defaults to both slots
            const traits = item.system?.traits?.value ?? [];
            return Array.isArray(traits) && traits.some(
                (trait) => typeof trait === 'string' && trait.startsWith('two-hand')
            );
        }

        /**
         * Check if cell data points at a weapon that should fill both slots
         * @param {Object} cellData
         * @param {{respectGrip?: boolean}} [options]
         * @returns {Promise<boolean>}
         * @private
         */
        async _isTwoHandedWeapon(cellData, options = {}) {
            if (!cellData?.uuid || cellData.isTwoHandedDuplicate) return false;
            try {
                const item = await this._resolveActorItem(cellData.uuid)
                    || await fromUuid(cellData.uuid);
                return this._itemOccupiesBothSlots(item, options);
            } catch (error) {
                log.warn('Error checking two-handed weapon:', error);
                return false;
            }
        }

        /**
         * @returns {Promise<HTMLElement>}
         */
        async render() {
            await super.render();
            this._wrapGridContainerRenders();
            await this._updateTwoHandedWeapons();
            return this.element;
        }

        /**
         * Keep 2H duplicates after GridContainer re-renders (actor updates, etc.)
         * @private
         */
        _wrapGridContainerRenders() {
            for (let setIndex = 0; setIndex < this.gridContainers.length; setIndex++) {
                const gridContainer = this.gridContainers[setIndex];
                if (gridContainer._bg3TwoHandedWrapped) continue;

                const weaponSetContainer = this;
                const index = setIndex;
                const originalRender = gridContainer.render.bind(gridContainer);
                gridContainer.render = async function () {
                    const result = await originalRender();
                    await weaponSetContainer._updateSetTwoHandedWeapons(this, index);
                    return result;
                };
                gridContainer._bg3TwoHandedWrapped = true;
            }
        }

        /**
         * @private
         */
        async _updateTwoHandedWeapons() {
            for (let setIndex = 0; setIndex < this.gridContainers.length; setIndex++) {
                await this._updateSetTwoHandedWeapons(this.gridContainers[setIndex], setIndex);
            }
        }

        /**
         * Resolve a cell/stash uuid to an Item that exists on this.actor.
         * fromUuid alone can return a foreign/base-actor doc whose id is not in
         * this actor's EmbeddedCollection (common with token actor swaps).
         * @param {string} uuid
         * @returns {Promise<Item|null>}
         * @private
         */
        async _resolveActorItem(uuid) {
            const actor = this.actor;
            if (!uuid || !actor?.items) return null;

            const embedded = actor.items.find((i) => i.uuid === uuid);
            if (embedded) return embedded;

            // Actor.x.Item.y vs Scene.a.Token.b.Actor.x.Item.y
            if (uuid.includes('.Item.')) {
                const itemId = uuid.split('.Item.').pop()?.split('.')[0];
                if (itemId && actor.items.has(itemId)) {
                    return actor.items.get(itemId);
                }
            }

            try {
                const doc = await fromUuid(uuid);
                if (!doc || doc.documentName !== 'Item') return null;
                if (doc.id && actor.items.has(doc.id)) {
                    return actor.items.get(doc.id);
                }
            } catch (error) {
                log.warn('Failed to resolve actor item from uuid', { uuid }, error);
            }
            return null;
        }

        /**
         * Minimal off-hand payload to persist across 1H↔2H grip toggles.
         * @param {Object} cellData
         * @returns {Object|null}
         * @private
         */
        _toStashedOffHand(cellData) {
            if (!cellData?.uuid || cellData.isTwoHandedDuplicate) return null;
            return {
                uuid: cellData.uuid,
                name: cellData.name,
                img: cellData.img,
                type: cellData.type,
            };
        }

        /**
         * Whether this set's primary cell remembers a 2H layout (independent of live grip).
         * @param {Object|null} leftData
         * @returns {boolean}
         * @private
         */
        _hasRememberedTwoHand(leftData) {
            return !!(leftData && (leftData.gripHands === 2 || leftData.stashedOffHand));
        }

        /**
         * Build faded duplicate cell data for a 2H primary.
         * @param {Object} primaryData
         * @returns {Object}
         * @private
         */
        _toTwoHandedDuplicate(primaryData) {
            return {
                uuid: primaryData.uuid,
                name: primaryData.name,
                img: primaryData.img,
                type: primaryData.type,
                isTwoHandedDuplicate: true,
                sourceSlot: '0-0',
            };
        }

        /**
         * Persist weapon-set slot data to runtime grids + PersistenceManager.
         * GridCell.setData does not save on its own.
         * @param {number} setIndex
         * @param {Object|null} leftData
         * @param {Object|null} rightData
         * @private
         */
        async _persistSetSlots(setIndex, leftData, rightData) {
            const grid = this.gridContainers[setIndex];
            if (!grid) return;

            const leftCell = grid.getCell(0, 0);
            const rightCell = grid.getCell(1, 0);
            if (leftCell) await leftCell.setData(leftData, { skipSave: true });
            if (rightCell) await rightCell.setData(rightData, { skipSave: true });

            if (!this.weaponSets[setIndex]) {
                this.weaponSets[setIndex] = { rows: 1, cols: 2, items: {} };
            }
            if (!this.weaponSets[setIndex].items) {
                this.weaponSets[setIndex].items = {};
            }
            this.weaponSets[setIndex].items['0-0'] = leftData;
            this.weaponSets[setIndex].items['1-0'] = rightData;
            grid.items = this.weaponSets[setIndex].items;

            if (rightCell?.element) {
                if (rightData?.isTwoHandedDuplicate) {
                    rightCell.element.classList.add('two-handed-duplicate');
                    rightCell.element.dataset.locked = 'true';
                } else {
                    rightCell.element.classList.remove('two-handed-duplicate');
                    delete rightCell.element.dataset.locked;
                }
            }

            if (this.persistenceManager?.updateCells) {
                await this.persistenceManager.updateCells([
                    {
                        container: 'weaponSet',
                        containerIndex: setIndex,
                        slotKey: '0-0',
                        data: leftData,
                    },
                    {
                        container: 'weaponSet',
                        containerIndex: setIndex,
                        slotKey: '1-0',
                        data: rightData,
                    },
                ]);
            }
        }

        /**
         * Apply dormant 2H layout: primary + stashed off-hand + faded duplicate.
         * @param {number} setIndex
         * @param {Object} primaryData - Primary weapon cell data
         * @param {Object|null} [existingRightData] - Current right cell (to stash if real)
         * @private
         */
        async _enterTwoHandedLayout(setIndex, primaryData, existingRightData = null) {
            if (!primaryData?.uuid) return;

            const leftData = {
                uuid: primaryData.uuid,
                name: primaryData.name,
                img: primaryData.img,
                type: primaryData.type,
                gripHands: 2,
            };
            if (primaryData.stashedOffHand) {
                leftData.stashedOffHand = primaryData.stashedOffHand;
            } else {
                const stash = this._toStashedOffHand(existingRightData);
                if (stash) leftData.stashedOffHand = stash;
            }

            const rightData = this._toTwoHandedDuplicate(leftData);

            const grid = this.gridContainers[setIndex];
            const curLeft = grid?.getCell(0, 0)?.data;
            const curRight = grid?.getCell(1, 0)?.data;
            const alreadyApplied = curLeft?.uuid === leftData.uuid
                && curLeft?.gripHands === 2
                && (curLeft?.stashedOffHand?.uuid || null) === (leftData.stashedOffHand?.uuid || null)
                && curRight?.isTwoHandedDuplicate
                && curRight?.uuid === leftData.uuid;

            if (alreadyApplied) {
                const rightCell = grid.getCell(1, 0);
                if (rightCell?.element) {
                    rightCell.element.classList.add('two-handed-duplicate');
                    rightCell.element.dataset.locked = 'true';
                }
                return;
            }

            await this._persistSetSlots(setIndex, leftData, rightData);
        }

        /**
         * Restore stashed off-hand and clear set-local 2H memory.
         * @param {number} setIndex
         * @private
         */
        async _leaveTwoHandedLayout(setIndex) {
            const grid = this.gridContainers[setIndex];
            if (!grid) return;
            const leftCell = grid.getCell(0, 0);
            if (!leftCell?.data) return;

            const stash = leftCell.data.stashedOffHand || null;
            const leftData = {
                uuid: leftCell.data.uuid,
                name: leftCell.data.name,
                img: leftCell.data.img,
                type: leftCell.data.type,
            };
            await this._persistSetSlots(setIndex, leftData, stash);
        }

        /**
         * Sync visual 2H state from remembered / inherent weapon data.
         * Does not clear a remembered 2H layout when the set is inactive.
         * @param {GridContainer} gridContainer
         * @param {number} [setIndex]
         * @private
         */
        async _updateSetTwoHandedWeapons(gridContainer, setIndex = null) {
            if (gridContainer.rows !== 1 || gridContainer.cols !== 2) return;

            const leftCell = gridContainer.getCell(0, 0);
            const rightCell = gridContainer.getCell(1, 0);
            if (!leftCell || !rightCell) return;

            const index = setIndex ?? this.gridContainers.indexOf(gridContainer);
            if (index < 0) return;

            // Set-local memory always wins (survives set switches + unequip)
            if (this._hasRememberedTwoHand(leftCell.data)) {
                await this._enterTwoHandedLayout(index, leftCell.data, rightCell.data);
                return;
            }

            const isActive = index === this.getActiveSet();
            const leftIs2H = leftCell.data && await this._isTwoHandedWeapon(leftCell.data, {
                respectGrip: isActive,
            });
            const rightIs2H = rightCell.data
                && !rightCell.data.isTwoHandedDuplicate
                && await this._isTwoHandedWeapon(rightCell.data, { respectGrip: isActive });

            if (leftIs2H) {
                await this._enterTwoHandedLayout(index, leftCell.data, rightCell.data);
                return;
            }

            if (rightIs2H) {
                await this._enterTwoHandedLayout(index, rightCell.data, leftCell.data?.uuid ? leftCell.data : null);
                return;
            }

            // Orphan duplicate with no remembered 2H state
            if (rightCell.data?.isTwoHandedDuplicate) {
                await this._persistSetSlots(index, leftCell.data, null);
            } else if (rightCell.element) {
                rightCell.element.classList.remove('two-handed-duplicate');
                delete rightCell.element.dataset.locked;
            }
        }

        /**
         * @param {number} setIndex
         * @param {Object} newData
         */
        async updateSet(setIndex, newData) {
            await super.updateSet(setIndex, newData);
            const gridContainer = this.gridContainers[setIndex];
            if (gridContainer) {
                await this._updateSetTwoHandedWeapons(gridContainer, setIndex);
            }
        }

        /**
         * @param {GridCell} cell
         * @returns {boolean}
         */
        isCellLocked(cell) {
            return cell.element?.dataset?.locked === 'true';
        }

        /**
         * @param {GridCell} targetCell
         * @returns {boolean}
         */
        shouldPreventDrop(targetCell) {
            if (this.isCellLocked(targetCell)) {
                ui.notifications.warn(game.i18n.localize('bg3-hud-pf2e.Notifications.SlotOccupiedByTwoHandedWeapon'));
                return true;
            }
            return false;
        }

        /**
         * @param {number} setIndex
         * @param {string} slotKey
         */
        async onCellUpdated(setIndex, slotKey) {
            const gridContainer = this.gridContainers[setIndex];
            if (gridContainer) {
                await this._updateSetTwoHandedWeapons(gridContainer, setIndex);
            }
        }

        /**
         * Equip target set and unequip previously active set
         * @param {number} setIndex
         * @param {GridContainer} setContainer
         */
        async onSetSwitch(setIndex, setContainer) {
            const actor = this.actor;
            if (!actor) return;

            const currentActiveIndex = this.getActiveSet();
            const currentGrid = this.gridContainers[currentActiveIndex];

            const resolveSetItems = async (grid) => {
                if (!grid?.cells) return [];
                const items = [];
                for (const cell of grid.cells) {
                    const cellData = cell?.data;
                    if (!cellData?.uuid || cellData.isTwoHandedDuplicate) continue;
                    const item = await this._resolveActorItem(cellData.uuid);
                    if (!item || !this._isManagedEquipment(item)) continue;
                    items.push(item);
                }
                return items;
            };

            const resolveStashedItems = async (grid) => {
                if (!grid?.cells) return [];
                const items = [];
                for (const cell of grid.cells) {
                    const stash = cell?.data?.stashedOffHand;
                    if (!stash?.uuid) continue;
                    const item = await this._resolveActorItem(stash.uuid);
                    if (!item || !this._isManagedEquipment(item)) continue;
                    items.push(item);
                }
                return items;
            };

            const [itemsToUnequip, itemsToEquip, stashedLeaving, stashedEntering] = await Promise.all([
                resolveSetItems(currentGrid),
                resolveSetItems(setContainer),
                resolveStashedItems(currentGrid),
                resolveStashedItems(setContainer),
            ]);

            const desiredStates = new Map();
            for (const item of itemsToUnequip) {
                desiredStates.set(item.id, {
                    item,
                    carryType: 'worn',
                    handsHeld: 0,
                    inSlot: false,
                });
            }
            // Keep stashed off-hands worn while their set is inactive / 2H
            for (const item of [...stashedLeaving, ...stashedEntering]) {
                desiredStates.set(item.id, {
                    item,
                    carryType: 'worn',
                    handsHeld: 0,
                    inSlot: false,
                });
            }
            for (const item of itemsToEquip) {
                desiredStates.set(item.id, {
                    item,
                    carryType: 'held',
                    handsHeld: this._getHandsHeldForSet(item, setContainer),
                    inSlot: true,
                });
            }

            const updates = [];
            for (const { item, carryType, handsHeld, inSlot } of desiredStates.values()) {
                if (!item?.id || !actor.items.has(item.id)) continue;
                const equipped = item.system?.equipped || {};
                const needsUpdate =
                    equipped.carryType !== carryType ||
                    equipped.handsHeld !== handsHeld ||
                    equipped.inSlot !== inSlot;

                if (needsUpdate) {
                    updates.push({
                        _id: item.id,
                        'system.equipped.carryType': carryType,
                        'system.equipped.handsHeld': handsHeld,
                        'system.equipped.inSlot': inSlot,
                    });
                }
            }

            if (updates.length) {
                await actor.updateEmbeddedDocuments('Item', updates);
            }

            // Re-apply remembered 2H visuals for the set we are entering
            await this._updateSetTwoHandedWeapons(setContainer, setIndex);
        }

        /**
         * @param {Item} item
         * @returns {boolean}
         * @private
         */
        _isManagedEquipment(item) {
            if (!item) return false;
            if (item.type === 'weapon' || item.type === 'shield') return true;
            if (item.type === 'equipment') {
                const usage = item.system?.usage?.value || '';
                if (typeof usage === 'string' && usage.includes('hand')) return true;
                const traits = item.system?.traits?.value || [];
                return Array.isArray(traits) && traits.includes('implement');
            }
            return false;
        }

        /**
         * Hands to hold for an item in a specific weapon set.
         * Prefers set-local gripHands / stashedOffHand over live equipped.handsHeld.
         * @param {Item} item
         * @param {GridContainer} [grid]
         * @returns {number}
         * @private
         */
        _getHandsHeldForSet(item, grid = null) {
            if (!item) return 0;
            if (item.type !== 'weapon') return 1;

            const leftData = grid?.getCell?.(0, 0)?.data;
            if (
                leftData?.uuid
                && this._itemUuidMatches(leftData.uuid, item)
                && this._hasRememberedTwoHand(leftData)
            ) {
                return 2;
            }

            return this._getHandsHeld(item);
        }

        /**
         * @param {string} uuid
         * @param {Item} item
         * @returns {boolean}
         * @private
         */
        _itemUuidMatches(uuid, item) {
            if (!uuid || !item) return false;
            if (item.uuid === uuid) return true;
            if (uuid.includes('.Item.')) {
                const itemId = uuid.split('.Item.').pop()?.split('.')[0];
                return !!itemId && item.id === itemId;
            }
            return false;
        }

        /**
         * Hands to hold when no set-local 2H memory applies.
         * @param {Item} item
         * @returns {number}
         * @private
         */
        _getHandsHeld(item) {
            if (!item) return 0;
            if (item.type !== 'weapon') return 1;

            if (item.system?.usage?.value === 'held-in-two-hands' || item.hands === '2') return 2;

            const current = Number(item.system?.equipped?.handsHeld) || 0;
            if (current === 2) return 2;

            const traits = item.system?.traits?.value ?? [];
            const hasTwoHandTrait = Array.isArray(traits) && traits.some(
                (trait) => typeof trait === 'string' && trait.startsWith('two-hand')
            );
            if (hasTwoHandTrait && current !== 1) return 2;

            return 1;
        }

        /**
         * After a grip toggle: enter or leave set-local 2H layout, then sync equip.
         * @returns {Promise<void>}
         */
        async refreshTwoHandedDisplay() {
            const active = this.getActiveSet();
            const grid = this.gridContainers[active];
            if (!grid) return;

            const leftCell = grid.getCell(0, 0);
            const rightCell = grid.getCell(1, 0);
            const leftData = leftCell?.data;
            if (!leftData?.uuid) {
                await this._updateSetTwoHandedWeapons(grid, active);
                await this._syncActiveSetEquipment();
                return;
            }

            const item = await this._resolveActorItem(leftData.uuid);
            const liveHands = Number(item?.system?.equipped?.handsHeld) || 0;
            const wantsTwoHand = liveHands >= 2
                || this._itemOccupiesBothSlots(item, { respectGrip: true });

            if (wantsTwoHand) {
                await this._enterTwoHandedLayout(active, leftData, rightCell?.data);
            } else if (this._hasRememberedTwoHand(leftData)) {
                await this._leaveTwoHandedLayout(active);
            } else {
                await this._updateSetTwoHandedWeapons(grid, active);
            }

            await this._syncActiveSetEquipment();
        }

        /**
         * Apply held/worn state for the active set from current cell + stash data.
         * @private
         */
        async _syncActiveSetEquipment() {
            const actor = this.actor;
            if (!actor?.items) return;

            const active = this.getActiveSet();
            const grid = this.gridContainers[active];
            if (!grid?.cells) return;

            const desiredStates = new Map();

            for (const cell of grid.cells) {
                const stash = cell?.data?.stashedOffHand;
                if (!stash?.uuid) continue;
                const item = await this._resolveActorItem(stash.uuid);
                if (!item || !this._isManagedEquipment(item)) continue;
                desiredStates.set(item.id, {
                    item,
                    carryType: 'worn',
                    handsHeld: 0,
                    inSlot: false,
                });
            }

            for (const cell of grid.cells) {
                const cellData = cell?.data;
                if (!cellData?.uuid || cellData.isTwoHandedDuplicate) continue;
                const item = await this._resolveActorItem(cellData.uuid);
                if (!item || !this._isManagedEquipment(item)) continue;
                desiredStates.set(item.id, {
                    item,
                    carryType: 'held',
                    handsHeld: this._getHandsHeldForSet(item, grid),
                    inSlot: true,
                });
            }

            const updates = [];
            for (const { item, carryType, handsHeld, inSlot } of desiredStates.values()) {
                if (!item?.id || !actor.items.has(item.id)) continue;
                const equipped = item.system?.equipped || {};
                if (
                    equipped.carryType !== carryType ||
                    equipped.handsHeld !== handsHeld ||
                    equipped.inSlot !== inSlot
                ) {
                    updates.push({
                        _id: item.id,
                        'system.equipped.carryType': carryType,
                        'system.equipped.handsHeld': handsHeld,
                        'system.equipped.inSlot': inSlot,
                    });
                }
            }

            if (updates.length) {
                await actor.updateEmbeddedDocuments('Item', updates);
            }
        }
    };
}

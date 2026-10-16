import { register } from 'node:module';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pf2eAutoSort.js imports its base class from a Foundry-absolute module
// path that only resolves inside a running Foundry server. Register a
// stub loader (see testFoundryCoreStub.mjs) before importing the module
// under test so this file can load under bare `node --test`.
register(new URL('./testFoundryCoreStub.mjs', import.meta.url));

const { Pf2eAutoSort } = await import('./Pf2eAutoSort.js');

describe('Pf2eAutoSort.sortItems', () => {
    const sort = new Pf2eAutoSort();

    it('orders items by the PF2e type priority: weapon, melee, action, feat, spell, consumable, ammo, equipment, armor, shield, backpack', async () => {
        const items = [
            { name: 'Backpack Item', type: 'backpack' },
            { name: 'Shield', type: 'shield' },
            { name: 'Armor', type: 'armor' },
            { name: 'Equipment', type: 'equipment' },
            { name: 'Ammo', type: 'ammo' },
            { name: 'Potion', type: 'consumable' },
            { name: 'Fireball', type: 'spell' },
            { name: 'Feat', type: 'feat' },
            { name: 'Action', type: 'action' },
            { name: 'Melee', type: 'melee' },
            { name: 'Weapon', type: 'weapon' }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), [
            'Weapon', 'Melee', 'Action', 'Feat', 'Fireball', 'Potion', 'Ammo', 'Equipment', 'Armor', 'Shield', 'Backpack Item'
        ]);
    });

    it('sorts a type not in typeOrder last, after every known type', async () => {
        const items = [
            { name: 'Mystery', type: 'something-else' },
            { name: 'Weapon', type: 'weapon' },
            { name: 'Backpack Item', type: 'backpack' }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), ['Weapon', 'Backpack Item', 'Mystery']);
    });

    it('secondary-sorts spells by spellLevel ascending (cantrips are level 0)', async () => {
        const items = [
            { name: 'Fireball', type: 'spell', sortData: { spellLevel: 3 } },
            { name: 'Prestidigitation', type: 'spell', sortData: { spellLevel: 0 } },
            { name: 'Magic Missile', type: 'spell', sortData: { spellLevel: 1 } }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), ['Prestidigitation', 'Magic Missile', 'Fireball']);
    });

    it('secondary-sorts actions by actionCost ascending', async () => {
        const items = [
            { name: 'Three-Action', type: 'action', sortData: { actionCost: 3 } },
            { name: 'One-Action', type: 'action', sortData: { actionCost: 1 } },
            { name: 'Two-Action', type: 'action', sortData: { actionCost: 2 } }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), ['One-Action', 'Two-Action', 'Three-Action']);
    });

    it('secondary-sorts feats by actionCost ascending, same as actions', async () => {
        const items = [
            { name: 'Big Feat', type: 'feat', sortData: { actionCost: 2 } },
            { name: 'Free Feat', type: 'feat', sortData: { actionCost: 0 } }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), ['Free Feat', 'Big Feat']);
    });

    it('falls back to alphabetical order when type and secondary key are equal', async () => {
        const items = [
            { name: 'Zed', type: 'weapon' },
            { name: 'Alpha', type: 'weapon' },
            { name: 'Mid', type: 'weapon' }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name), ['Alpha', 'Mid', 'Zed']);
    });

    it('falls back to sortData.name when item.name is absent, then to empty string', async () => {
        const items = [
            { type: 'weapon', sortData: { name: 'Alpha' } },
            { type: 'weapon' }
        ];
        await sort.sortItems(items);
        assert.deepEqual(items.map((i) => i.name || i.sortData?.name || ''), ['', 'Alpha']);
    });
});

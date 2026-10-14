import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iteratePreparedSlots, resolveCastRank } from './SpellCastRank.js';

describe('resolveCastRank', () => {
    it('prepared caster: casts at the slot rank holding this spell (array-form prepared list)', () => {
        const result = resolveCastRank({
            tradition: 'prepared',
            slots: {
                slot1: { prepared: [{ id: 'spellA', expended: false }] },
                slot2: { prepared: [{ id: 'spellB', expended: false }] }
            },
            itemId: 'spellB',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 2, slotId: 0, consume: true });
    });

    it('prepared caster: casts at the slot rank holding this spell (object-keyed prepared list)', () => {
        const result = resolveCastRank({
            tradition: 'prepared',
            slots: {
                slot3: { prepared: { 2: { id: 'spellC', expended: false } } }
            },
            itemId: 'spellC',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 3, slotId: 2, consume: true });
    });

    it('prepared caster: skips an expended preparation and finds the next non-expended one', () => {
        const result = resolveCastRank({
            tradition: 'prepared',
            slots: {
                slot1: { prepared: [{ id: 'spellA', expended: true }] },
                slot2: { prepared: [{ id: 'spellA', expended: false }] }
            },
            itemId: 'spellA',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 2, slotId: 0, consume: true });
    });

    it('prepared caster: returns null when every preparation of the spell is expended', () => {
        const result = resolveCastRank({
            tradition: 'prepared',
            slots: {
                slot1: { prepared: [{ id: 'spellA', expended: true }] }
            },
            itemId: 'spellA',
            baseRank: 1
        });
        assert.equal(result, null);
    });

    it('prepared caster: returns null when the spell has no preparation at all', () => {
        const result = resolveCastRank({
            tradition: 'prepared',
            slots: {},
            itemId: 'spellA',
            baseRank: 1
        });
        assert.equal(result, null);
    });

    it('spontaneous caster: falls back to the base rank when no higher slot is available', () => {
        const result = resolveCastRank({
            tradition: 'spontaneous',
            slots: { slot1: { value: 0 } },
            itemId: 'spellA',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 1, consume: true });
    });

    it('spontaneous caster: casts at the highest affordable rank when heightened into a higher slot', () => {
        const result = resolveCastRank({
            tradition: 'spontaneous',
            slots: {
                slot1: { value: 2 },
                slot2: { value: 0 },
                slot3: { value: 1 }
            },
            itemId: 'spellA',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 3, consume: true });
    });

    it('innate caster: behaves the same as spontaneous (any non-prepared tradition)', () => {
        const result = resolveCastRank({
            tradition: 'innate',
            slots: { slot1: { value: 1 } },
            itemId: 'spellA',
            baseRank: 1
        });
        assert.deepEqual(result, { rank: 1, consume: true });
    });

    it('spontaneous caster: never casts below the spell\'s own base rank even if a lower slot has value', () => {
        const result = resolveCastRank({
            tradition: 'spontaneous',
            slots: {
                slot1: { value: 5 },
                slot2: { value: 0 }
            },
            itemId: 'spellA',
            baseRank: 2
        });
        assert.deepEqual(result, { rank: 2, consume: true });
    });

    it('spontaneous caster: tolerates missing slots entirely and falls back to base rank', () => {
        const result = resolveCastRank({
            tradition: 'spontaneous',
            slots: undefined,
            itemId: 'spellA',
            baseRank: 3
        });
        assert.deepEqual(result, { rank: 3, consume: true });
    });
});

describe('iteratePreparedSlots', () => {
    it('yields nothing for empty/undefined slots', () => {
        assert.deepEqual([...iteratePreparedSlots(undefined)], []);
        assert.deepEqual([...iteratePreparedSlots({})], []);
    });

    it('yields rank/slotId/prep for both array-form and object-keyed prepared lists', () => {
        const results = [...iteratePreparedSlots({
            slot0: { prepared: [{ id: 'cantrip' }] },
            slot2: { prepared: { 1: { id: 'fireball' } } }
        })];
        assert.deepEqual(results, [
            { rank: 0, slotId: 0, prep: { id: 'cantrip' } },
            { rank: 2, slotId: 1, prep: { id: 'fireball' } }
        ]);
    });
});

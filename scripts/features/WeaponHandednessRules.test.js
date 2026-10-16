import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    isManagedEquipment,
    isNativeTwoHanded,
    isTwoHanded,
    getHandsHeld
} from './WeaponHandednessRules.js';

describe('isManagedEquipment', () => {
    it('returns false for a falsy item', () => {
        assert.equal(isManagedEquipment(null), false);
        assert.equal(isManagedEquipment(undefined), false);
    });

    it('returns true for a weapon', () => {
        assert.equal(isManagedEquipment({ type: 'weapon' }), true);
    });

    it('returns true for a shield', () => {
        assert.equal(isManagedEquipment({ type: 'shield' }), true);
    });

    it('returns true for equipment whose usage mentions "hand"', () => {
        const item = { type: 'equipment', system: { usage: { value: 'held-in-one-hand' } } };
        assert.equal(isManagedEquipment(item), true);
    });

    it('returns true for equipment carrying the "implement" trait even without a hand-usage', () => {
        const item = {
            type: 'equipment',
            system: { usage: { value: 'worn' }, traits: { value: ['implement'] } }
        };
        assert.equal(isManagedEquipment(item), true);
    });

    it('returns false for equipment with neither a hand-usage nor the implement trait', () => {
        const item = {
            type: 'equipment',
            system: { usage: { value: 'worn' }, traits: { value: ['magical'] } }
        };
        assert.equal(isManagedEquipment(item), false);
    });

    it('returns false for equipment with no usage/traits data at all', () => {
        assert.equal(isManagedEquipment({ type: 'equipment' }), false);
    });

    it('returns false for other item types (e.g. consumable)', () => {
        assert.equal(isManagedEquipment({ type: 'consumable' }), false);
    });
});

describe('isNativeTwoHanded', () => {
    it('returns false for a falsy item', () => {
        assert.equal(isNativeTwoHanded(null), false);
    });

    it('returns true when usage is "held-in-two-hands" (e.g. Maul)', () => {
        assert.equal(isNativeTwoHanded({ system: { usage: { value: 'held-in-two-hands' } } }), true);
    });

    it('returns true when the item\'s `hands` field is literally the string \'2\'', () => {
        assert.equal(isNativeTwoHanded({ hands: '2' }), true);
    });

    it('returns false for a one-handed weapon with neither signal', () => {
        const item = { system: { usage: { value: 'held-in-one-hand' } }, hands: '1' };
        assert.equal(isNativeTwoHanded(item), false);
    });

    it('returns false for a versatile two-hand-trait weapon (War Axe) that is not natively 2H', () => {
        const item = {
            system: { usage: { value: 'held-in-one-hand' }, traits: { value: ['two-hand-d8'] } }
        };
        assert.equal(isNativeTwoHanded(item), false);
    });
});

describe('isTwoHanded', () => {
    it('returns false for a falsy item', () => {
        assert.equal(isTwoHanded(null), false);
    });

    it('returns true for an item carrying a "two-hand-dX" trait (e.g. War Axe)', () => {
        const item = { system: { traits: { value: ['two-hand-d8'] } } };
        assert.equal(isTwoHanded(item), true);
    });

    it('returns false when traits do not include a "two-hand" trait', () => {
        const item = { system: { traits: { value: ['agile', 'finesse'] } } };
        assert.equal(isTwoHanded(item), false);
    });

    it('returns false when traits is missing entirely', () => {
        assert.equal(isTwoHanded({ system: {} }), false);
    });

    it('returns false when traits is not an array', () => {
        const item = { system: { traits: { value: 'two-hand-d8' } } };
        assert.equal(isTwoHanded(item), false);
    });

    it('ignores non-string trait entries without throwing', () => {
        const item = { system: { traits: { value: [null, 42, 'finesse'] } } };
        assert.equal(isTwoHanded(item), false);
    });
});

describe('getHandsHeld', () => {
    it('returns 0 for a falsy item', () => {
        assert.equal(getHandsHeld(null), 0);
    });

    it('returns 1 for non-weapon managed equipment (e.g. a shield)', () => {
        assert.equal(getHandsHeld({ type: 'shield' }), 1);
    });

    it('returns 2 for a natively two-handed weapon (Maul) regardless of grip state', () => {
        const item = {
            type: 'weapon',
            system: { usage: { value: 'held-in-two-hands' }, equipped: { handsHeld: 1 } }
        };
        assert.equal(getHandsHeld(item), 2);
    });

    it('returns 2 when the weapon is already explicitly gripped two-handed', () => {
        const item = {
            type: 'weapon',
            system: { usage: { value: 'held-in-one-hand' }, equipped: { handsHeld: 2 } }
        };
        assert.equal(getHandsHeld(item), 2);
    });

    it('returns 2 for a versatile two-hand-trait weapon (War Axe) not explicitly gripped one-handed', () => {
        const item = {
            type: 'weapon',
            system: {
                usage: { value: 'held-in-one-hand' },
                traits: { value: ['two-hand-d8'] },
                equipped: { handsHeld: 0 }
            }
        };
        assert.equal(getHandsHeld(item), 2);
    });

    it('returns 1 for a versatile two-hand-trait weapon explicitly gripped one-handed', () => {
        const item = {
            type: 'weapon',
            system: {
                usage: { value: 'held-in-one-hand' },
                traits: { value: ['two-hand-d8'] },
                equipped: { handsHeld: 1 }
            }
        };
        assert.equal(getHandsHeld(item), 1);
    });

    it('returns 1 for a plain one-handed weapon with no two-hand trait', () => {
        const item = {
            type: 'weapon',
            system: { usage: { value: 'held-in-one-hand' }, equipped: { handsHeld: 1 } }
        };
        assert.equal(getHandsHeld(item), 1);
    });

    it('returns 1 for a weapon with no equipped/handsHeld data at all', () => {
        const item = { type: 'weapon', system: {} };
        assert.equal(getHandsHeld(item), 1);
    });
});

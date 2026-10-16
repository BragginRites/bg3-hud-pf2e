import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// Imported from ShieldCoverRules.js (not ShieldCoverService.js) so this test
// doesn't pull in ShieldCoverService's Foundry-global/core-logger import,
// which only resolves inside a running Foundry instance.
import { classifyShieldCover } from './ShieldCoverRules.js';

describe('classifyShieldCover', () => {
    it('classifies a tower shield (by baseItem) as greater cover', () => {
        const shield = { system: { baseItem: 'tower-shield', traits: { value: [] } } };
        assert.deepEqual(classifyShieldCover(shield), { bonus: 4, level: 'greater', isTowerShield: true });
    });

    it('classifies a fortress shield (by baseItem) as greater cover', () => {
        const shield = { system: { baseItem: 'fortress-shield', traits: { value: [] } } };
        assert.deepEqual(classifyShieldCover(shield), { bonus: 4, level: 'greater', isTowerShield: true });
    });

    it('classifies a shield carrying the "tower" trait as greater cover even with a different baseItem', () => {
        const shield = { system: { baseItem: 'steel-shield', traits: { value: ['tower'] } } };
        assert.deepEqual(classifyShieldCover(shield), { bonus: 4, level: 'greater', isTowerShield: true });
    });

    it('classifies a shield carrying the "tower-shield" trait as greater cover', () => {
        const shield = { system: { baseItem: 'steel-shield', traits: { value: ['tower-shield'] } } };
        assert.deepEqual(classifyShieldCover(shield), { bonus: 4, level: 'greater', isTowerShield: true });
    });

    it('classifies a normal shield as standard cover', () => {
        const shield = { system: { baseItem: 'steel-shield', traits: { value: [] } } };
        assert.deepEqual(classifyShieldCover(shield), { bonus: 2, level: 'standard', isTowerShield: false });
    });

    it('classifies a missing/no shield as standard cover', () => {
        assert.deepEqual(classifyShieldCover(null), { bonus: 2, level: 'standard', isTowerShield: false });
        assert.deepEqual(classifyShieldCover(undefined), { bonus: 2, level: 'standard', isTowerShield: false });
    });

    it('tolerates a shield with no system/traits data at all', () => {
        assert.deepEqual(classifyShieldCover({}), { bonus: 2, level: 'standard', isTowerShield: false });
    });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTargetRequirements } from './Pf2eTargetingRules.js';

function itemWithArea(type, value) {
    return { system: { area: { type, value } } };
}

describe('getTargetRequirements areas', () => {
    it('treats a burst as a circle placed at the click', () => {
        const requirements = getTargetRequirements({ item: itemWithArea('burst', 20) });
        assert.equal(requirements.hasTemplate, true);
        assert.deepEqual(requirements.template, { type: 'burst', size: 20 });
    });

    it('places a Pathfinder 8 ring as a one-square band centered on the radius', () => {
        const requirements = getTargetRequirements({ item: itemWithArea('ring', 20) });
        assert.deepEqual(requirements.template, { type: 'ring', size: 22.5, width: 5 });
    });

    it('keeps an emanation attached to the caster', () => {
        const requirements = getTargetRequirements({ item: itemWithArea('emanation', 10) });
        assert.deepEqual(requirements.template, { type: 'emanation', size: 10 });
    });
});

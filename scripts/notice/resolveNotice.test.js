import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePf2eNotice } from './resolveNotice.js';

describe('resolvePf2eNotice', () => {
    it('maps selectedPassives flags to Passives', () => {
        const notice = resolvePf2eNotice({
            flags: { 'bg3-hud-pf2e': { selectedPassives: [] } }
        });
        assert.deepEqual(notice.fills, ['passives']);
    });

    it('maps token-image flags to Face', () => {
        const notice = resolvePf2eNotice({
            flags: { 'bg3-hud-pf2e': { useTokenImage: false } }
        });
        assert.deepEqual(notice.fills, ['portrait:face']);
    });

    it('maps focus to Filter and parked focus-spell Cells', () => {
        const actor = {
            items: [
                { type: 'spell', uuid: 'Item.focus', system: { traits: { value: ['focus'] } } },
                { type: 'spell', uuid: 'Item.slot', system: { traits: { value: [] } } }
            ]
        };
        const notice = resolvePf2eNotice({
            system: { resources: { focus: { value: 0 } } }
        }, actor);
        assert.deepEqual(notice.fills, ['filter']);
        assert.deepEqual(notice.cells, { parked: ['Item.focus'] });
    });
});

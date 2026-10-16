/**
 * Node ESM loader hook used only by this repo's test suite (see
 * Pf2eAutoSort.test.js).
 *
 * The PF2e adapter classes import their base framework classes from the
 * sibling bg3-hud-core module via a Foundry-VTT-absolute module path, e.g.:
 *   import { AutoSortFramework } from '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js';
 *
 * That path is only resolvable by a running Foundry server (which rewrites
 * "/modules/<id>/..." to the installed module's files); it does not exist on
 * disk, so bare `node --test` can't import the adapter files directly.
 *
 * AutoSortFramework.js is special-cased to redirect to the real file in the
 * sibling bg3-hud-core checkout (repos are siblings under the same workspace
 * root). Pf2eAutoSort.sortItems() calls the real, shared
 * `compareByTypeThenKey` helper exported from that file, so a no-op stand-in
 * would no longer exercise the behavior under test - this lets the test
 * suite verify sortItems() against the actual shared comparator rather than
 * a hand-duplicated copy of its logic. AutoSortFramework.js's own module-load
 * side effects are safe here: it only imports `Logger`/`gridFill.js`, neither
 * of which touches Foundry globals at import time.
 *
 * Pf2eAutoSort.js also imports `createLogger` from bg3-hud-core's
 * utils/logger.js (also Foundry-absolute); that specifier is redirected to
 * the real sibling file too, for the same reason and with the same
 * import-time safety (it only reads `game.settings` lazily inside a
 * try/catch at call time, never at module load).
 *
 * Every other "/modules/bg3-hud-core/..." specifier (AutoPopulateFramework,
 * FilterContainer, ...) still substitutes a bare, no-op base class, matching
 * the equivalent stub in bg3-hud-dc20rpg.
 */
const REAL_AUTO_SORT_FRAMEWORK_URL = new URL(
    '../../../bg3-hud-core/scripts/features/AutoSortFramework.js',
    import.meta.url
).href;
const REAL_LOGGER_URL = new URL(
    '../../../bg3-hud-core/scripts/utils/logger.js',
    import.meta.url
).href;

export async function resolve(specifier, context, nextResolve) {
    if (specifier === '/modules/bg3-hud-core/scripts/features/AutoSortFramework.js') {
        return nextResolve(REAL_AUTO_SORT_FRAMEWORK_URL, context);
    }
    if (specifier === '/modules/bg3-hud-core/scripts/utils/logger.js') {
        return nextResolve(REAL_LOGGER_URL, context);
    }
    if (specifier.startsWith('/modules/bg3-hud-core/')) {
        return { url: `foundry-core-stub:${specifier}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
    if (url.startsWith('foundry-core-stub:')) {
        return {
            format: 'module',
            shortCircuit: true,
            source: `
                export class AutoSortFramework {}
                export class AutoPopulateFramework {}
                export class FilterContainer {}
            `
        };
    }
    return nextLoad(url, context);
}

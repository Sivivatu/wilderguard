import { EFFECTS, MAX_TOWER_LEVEL, meteorDamage, REGIONS, TOWER_TYPES, towerStats, type TowerType } from './game';
import { SPELL_NAMES } from './save';

const number = (value: number) => String(Number(value.toFixed(2)));
export function towerSummary(type: TowerType, level: number) {
  const stats = towerStats(type, level);
  return `${number(stats.damage)} damage · every ${number(stats.interval)} seconds · ${stats.range} range`;
}

export function defenseGuide(regionIndex: number) {
  const roles: Record<TowerType, string> = {
    archer: 'Fast shots, low damage per hit. Longest range; attacks one enemy at a time.',
    cannon: `Slow shots, high damage. Splash hits enemies less than ${EFFECTS.splashDistance} path units from the target. Best against groups.`,
    frost: `Low damage, crowd control. Every hit has a 100% chance to slow its target by ${(1 - EFFECTS.frostSpeed) * 100}% for ${EFFECTS.frostSeconds} seconds. Repeated hits refresh the slow; they do not stack.`,
  };
  return `<span class="eyebrow">KNOW YOUR DEFENSES</span><h2>Towers &amp; abilities</h2>
    <p>Choose a tower, then tap a + pad to build. Tap a built tower for its current stats, upgrades or a 60% sale refund. Range uses battlefield units.</p>
    ${(Object.keys(TOWER_TYPES) as TowerType[]).map(type => `<section class="defense-detail"><h3>${TOWER_TYPES[type].name} <small>${TOWER_TYPES[type].cost} diamonds</small></h3><p>${roles[type]}</p><ul>${Array.from({ length: MAX_TOWER_LEVEL }, (_, i) => `<li><strong>Level ${i + 1}</strong> · ${towerSummary(type, i + 1)}</li>`).join('')}</ul></section>`).join('')}
    <h2 class="abilities-heading">Special abilities</h2>
    <p>Each cast uses one item. Use during a wave; rewards replenish your supplies.</p>
    <section class="defense-detail"><h3>${SPELL_NAMES.meteor}</h3><p>${number(meteorDamage(regionIndex))} damage to every visible enemy in ${REGIONS[regionIndex].name}. Instant, no range limit. Damage increases by 25% of its base 110 per region; enemies still waiting offscreen are not hit.</p></section>
    <section class="defense-detail"><h3>${SPELL_NAMES.freeze}</h3><p>Slow the entire wave by ${(1 - EFFECTS.freezeSpeed) * 100}% for ${EFFECTS.freezeSeconds} seconds. A stronger slow than the frost tower; effects do not stack. Casting again refreshes the duration.</p></section>
    <section class="defense-detail"><h3>${SPELL_NAMES.heal}</h3><p>Restore ${EFFECTS.healHealth} kingdom health, up to ${EFFECTS.maxHealth}. Only usable when health is missing. Does no damage.</p></section>`;
}

import { EFFECTS, FROST_NOVA, MAX_TOWER_LEVEL, meteorDamage, REGIONS, TOWER_TYPES, towerStats, type TowerType } from './game';
import { SPELL_NAMES } from './save';
import { AXE_THROWER } from './tower-combat';

const number = (value: number) => String(Number(value.toFixed(2)));
export function towerSummary(type: TowerType, level: number) {
  const stats = towerStats(type, level);
  return `${number(stats.damage)} damage · every ${number(stats.interval)} seconds · ${stats.range} range${type === 'frost' ? ` · ${number(EFFECTS.frostChance * 100)}% chill` : ''}${type === 'frost' && level === FROST_NOVA.level ? ' · Frost nova' : ''}`;
}

export function defenseGuide(regionIndex: number) {
  const roles: Record<TowerType, string> = {
    archer: 'Fast shots, low damage per hit. Longest range; attacks one enemy at a time.',
    cannon: `Slow shots, high damage. Splash hits enemies less than ${EFFECTS.splashDistance} path units from the target. Best against groups.`,
    frost: `Low damage, crowd control. Each hit has an ${number(EFFECTS.frostChance * 100)}% chance to slow its target by ${(1 - EFFECTS.frostSpeed) * 100}% for ${EFFECTS.frostSeconds} seconds, with a ${number((1 - EFFECTS.frostChance) * 100)}% failure chance. Damage always lands. Prefers enemies not already chilled in range, checking again before every shot; if all are chilled, it keeps attacking. Successful hits refresh the slow; failed hits do not refresh it. Slows do not stack. <strong>Level ${FROST_NOVA.level} unlocks Frost nova:</strong> a successful chill also marks its target. If a mob dies while carrying this tower's chill, it bursts, spreading the same slow to mobs within ${FROST_NOVA.radius} battlefield units. Any tower or Starfall can trigger the kill. The burst always spreads chill to nearby mobs, which can burst again if killed before their chill expires. Bursts add no damage; Deep Freeze alone does not trigger them.`,
  };
  return `<span class="eyebrow">KNOW YOUR DEFENSES</span><h2>Towers &amp; abilities</h2>
    <p>Choose a tower, then tap a + pad to build. Tap a built tower for its current stats, upgrades or a 60% sale refund. Range uses battlefield units.</p>
    ${(Object.keys(TOWER_TYPES) as TowerType[]).map(type => `<section class="defense-detail"><h3>${TOWER_TYPES[type].name} <small>${TOWER_TYPES[type].cost} diamonds</small></h3><p>${roles[type]}</p><ul>${Array.from({ length: MAX_TOWER_LEVEL }, (_, i) => `<li><strong>Level ${i + 1}</strong> · ${towerSummary(type, i + 1)}</li>`).join('')}</ul></section>`).join('')}
    <section class="defense-detail"><h3>Axe-throwing orcs</h3><p>First appear midway through Greenfields wave 3, after the opening enemies. They throw at the nearest tower within ${AXE_THROWER.range} battlefield units every ${AXE_THROWER.interval} seconds, dealing ${AXE_THROWER.damage + AXE_THROWER.regionDamage * regionIndex} tower damage in this region. Send soldiers to interrupt their throws. Towers show health bars; tap a damaged tower to repair it for diamonds. Damage carries between waves. Destroyed towers leave an empty build pad, and their deployed soldiers keep fighting.</p></section>
    <h2 class="abilities-heading">Special abilities</h2>
    <p>Each cast uses one item. Use during a wave; rewards replenish your supplies.</p>
    <section class="defense-detail"><h3>${SPELL_NAMES.meteor}</h3><p>${number(meteorDamage(regionIndex))} damage to every visible enemy in ${REGIONS[regionIndex].name}. Instant, no range limit. Damage increases by 25% of its base 110 per region; enemies still waiting offscreen are not hit.</p></section>
    <section class="defense-detail"><h3>${SPELL_NAMES.freeze}</h3><p>Slow the entire wave by ${(1 - EFFECTS.freezeSpeed) * 100}% for ${EFFECTS.freezeSeconds} seconds. A stronger slow than the frost tower; effects do not stack. Casting again refreshes the duration.</p></section>
    <section class="defense-detail"><h3>${SPELL_NAMES.heal}</h3><p>Restore ${EFFECTS.healHealth} castle health, up to ${EFFECTS.maxHealth}. The castle meter and roof bar show its health; escaping orcs damage it. Only usable when health is missing. Towers use their own confirmed diamond repairs. Does no damage.</p></section>`;
}

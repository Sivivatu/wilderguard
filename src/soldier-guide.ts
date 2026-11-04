import type { GameState } from './game';
import { SOLDIERS, soldierStats, trainingCost } from './soldiers';

export function soldierGuide(state: GameState, towerId: string): string {
  const stats = soldierStats(state.soldierTrainingLevel);
  const deployed = state.deployments.some(squad => squad.towerId === towerId);
  const survivors = state.soldiers.filter(soldier => soldier.towerId === towerId && soldier.hp > 0).length;
  const canDeploy = state.phase === 'wave' && !deployed && state.diamonds >= SOLDIERS.deployCost;
  const canTrain = state.soldierTrainingLevel < SOLDIERS.maxLevel && state.diamonds >= trainingCost(state.soldierTrainingLevel);
  return `<h2>Tower soldiers</h2>
    <p>Campaign training · level ${state.soldierTrainingLevel} / ${SOLDIERS.maxLevel}. Each soldier has ${stats.hp} health and deals ${stats.damage} damage every ${stats.interval} seconds.</p>
    <div class="soldier-summary"><strong>${deployed ? `${survivors} soldiers still standing` : '2 soldiers in each squad'}</strong>
    <p>Soldiers march toward the entrance, block nearby orcs, and fight with swords. Send one squad from each tower per wave.</p></div>
    <p>Deploy for ${SOLDIERS.deployCost} diamonds. Each survivor returns ${SOLDIERS.deployCost / SOLDIERS.squadSize} diamonds when you clear the wave. Fallen soldiers return nothing.</p>
    <div class="soldier-actions"><button class="primary-button" data-action="deploy-soldiers" ${canDeploy ? '' : 'disabled'}>${deployed ? 'Squad already sent' : `Deploy squad · ${SOLDIERS.deployCost} diamonds`}</button>
    <button class="secondary-button" data-action="train-soldiers" ${canTrain ? '' : 'disabled'}>${state.soldierTrainingLevel === SOLDIERS.maxLevel ? 'Training complete' : `Train soldiers · ${trainingCost(state.soldierTrainingLevel)} diamonds`}</button></div>
    <p class="soldier-note">Training improves future squads from every tower and carries between regions. Towers upgrade separately.${state.phase === 'wave' ? '' : ' Start a wave to deploy.'}</p>`;
}

// The lair grade (plan P1-03, the second named scenario): a young hero (Melee 2, 20 HP, no items, no army, fighting
// hand to hand every round and refusing duels) searches the Weak lair in their realm's home province, which every home
// is dealt. Its guardian is the one the world dealt, so the runs sample the Weak grade's guardians. One try each.
import { order, plan } from '../../lib/scenario.js';
import { heroOf, measure, place, type Scenario, type World } from '../../../tools/balance/scenario.ts';

const scenario: Scenario = {
  title: 'A young hero (Melee 2, 20 HP, no items) searches a Weak lair',
  runs: 400,
  figures: ['lairs: cleared | by grade: Weak', 'lairs: hero fled', 'lairs: hero killed'],
  async play(sc) {
    const turn = await sc.turn<World, { hero: number; lair: number }>({
      realms: 2,
      seaPct: 10,
      prepare(S) {
        const home = S.world.provinces[S.players[0]?.homeProvinceId ?? -1];
        const lair = (home?.features ?? []).findIndex((f) => f.monster?.power === 'Weak' && !f.cleared);
        const feature = home?.features?.[lair];
        if (!home || !feature) throw new Error('could not stage: no Weak lair in the home province');
        feature.discovered = true;
        const hero = heroOf(S, 0);
        place(S, hero, home);
        hero.items = [];
        hero.armies = [];
        hero.skills = { melee: 2 };
        hero.hp = hero.maxHp = 20;
        hero.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
        return { hero: hero.id, lair };
      },
      orders: (_S, x) => ({ [x.hero]: plan(order('search', x.lair)) }),
    });
    return measure(turn);
  },
};
export default scenario;

# Level 3 Frost nova

As a player, I want a level 3 Frost tower to spread its chill when a chilled enemy dies, so upgrading rewards mixed defenses and well-timed kills.

Level 3 hits apply the existing 50% slow for two seconds and a matching nova mark. Any damage source killing a marked mob triggers a visible ice burst within 90 battlefield units. The burst refreshes the same slow and mark on living, visible nearby enemies, allowing later death chains without extra burst damage. Lower-level towers and Deep Freeze alone do not grant the mark. Expired marks do not trigger.

Use immutable combat state, a separate transient burst list, and Euclidean distance between path positions. Resolve deaths against one snapshot so simultaneous deaths cannot depend on array order. Resolve spell deaths immediately before a later tick can expire the mark or move the corpse. Clear effects between waves; saved checkpoints keep their existing format.

Render an expanding ice ring with pixel shards, show a stronger chill indicator on marked mobs, and describe Frost nova in the guide and level 3 popover. Fade effects even after the last mob dies, while respecting pause.

Validation: RED then GREEN combat tests for hit/death sources, spread/expiry/radius/chains, immutable state, visual lifetime, and old saves; browser test for real level 3 burst drawing and guide text; existing campaign, phone/tablet, offline, coverage and Android release checks. Keep source local, publish beta 4 through the existing signed binary-only feed after verification.

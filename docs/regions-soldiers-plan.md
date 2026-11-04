# Wilderguard: regions, confirmations, and soldiers

Players should read wave status easily on a landscape phone, confirm diamond purchases, defend distinct routes, and send independently trained soldiers from their towers.

## Interface

Enlarge the battlefield status caption and wave count without reducing the usable map. Show build and upgrade cost confirmations; cancellation, Escape, and dismissal spend nothing. Pause during confirmations and restore the earlier pause state afterward. Revalidate the target and cost when confirming. Put soldier deployment and campaign training in a tower's garrison dialog with the same purchase confirmation.

## Campaign and combat

Five region routes share one geometry module used for roads, enemy movement, targeting, Frost nova, and soldier deployment. Preserve the Greenfields route and existing save IDs. Bundle accepted realistic pixel-photo terrain offline; generate terrain without roads so the drawn route matches combat exactly.

Campaign soldier training starts at level 1 and has two upgrades costing 35 and 70 diamonds. Towers launch two-soldier squads for 30 diamonds during a wave, once per tower per wave. Training affects future squads and carries between regions. Squads march toward approaching mobs, block them, and exchange melee attacks. They interact with towers and Frost nova through the shared enemy state. At wave end, refund 15 diamonds per surviving soldier, once per deployment; two survivors return the full 30 diamonds. Upgrade costs are permanent. Defeat restores the existing pre-wave checkpoint; no extra refund is issued.

## Data and delivery

Save only the campaign training level alongside the existing version-1 checkpoint, defaulting older saves to level 1. Validate its bounds and preserve backward compatibility. Soldiers and deployment records are transient. Keep the beta 4 release tag immutable and source local. Build and publish the next beta only after gameplay, save, phone, offline, signing, and public feed checks.

## Verification

Use RED then GREEN unit tests for route geometry and soldier combat/economy, browser tests for purchase confirmation and readable phone controls, and the existing full-campaign/Frost nova tests. Review code and security before commits. The user approved concept B; five matching final backgrounds are bundled offline; the user selected direct Sunburst generation with the existing OpenCode key after the default controller model was blocked by workspace guardrails.

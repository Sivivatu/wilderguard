# Phone battle layout and defense details

Player journeys: play in short landscape without losing the battlefield or result actions; inspect tower and spell strengths without spending resources; resume the battle after closing help.

Design: retain the woodland palette, reduce decorative spacing and artwork in short landscape, keep touch controls at least 44px high, and dedicate the remaining height to the map. Use a scrollable modal for detailed numbers and compact result overlays for short battlefields.

Implementation: share tower upgrade calculations and Starfall damage between combat and descriptions; add an always-available details button and current tower stats; compact landscape chrome; preserve saved campaigns and combat balance.

Validation: unit combat/stat tests, Playwright short phones (844×390, 740×360, 667×375), existing tablet/portrait/offline flows, coverage, Android build and signed beta verification. Known limit: browser emulation cannot establish physical Android/F-Droid installation.

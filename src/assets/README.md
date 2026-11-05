# Orc sprite provenance

Eric selected the Sunburst option from the three generated concepts. The original concept is `output/imagegen/orc-compare-sunburst-v1.png`, generated with `openai/gpt-image-2.5-sunburst` through OpenRouter at 1536×1024. Its exact prompt and generation settings are in [`comparison-v1.json`](../../output/imagegen/comparison-v1.json).

The game uses transparent pixel-art cutouts from that selected image. The neutral background was removed and the characters were reduced with nearest-neighbor scaling to preserve the blocky pixel edges. Their source-image SHA-256 values are:

| Sprite | Image size | SHA-256 |
| --- | --- | --- |
| `orc-clubber.png` | 122×176 | `d05d764bd64c7e85e4e647e09ab280f42e1db802e32b7cab7663bbf077102785` |
| `orc-axeman.png` | 127×176 | `2f6613fc4127c915de581af31f2846850880ac20fa6a9e3f01acf073d1651803` |
| `orc-chieftain.png` | 128×169 | `5a11b787085c067d3c57b7ca19621fad371b08ae2a83d2a2a28793add93bd8ea` |

All sprites are bundled locally for offline play. Their use here does not assign a license to Eric’s game or make the source code open source; the project license remains unchosen.

## Region terrain

The user approved terrain concept **B**, the more pixelated photographic style, before replacement. Five individual backgrounds were then generated with `openai/gpt-image-2.5-sunburst` through OpenRouter using the existing OpenCode credential in memory. Each is terrain only; the game draws its actual region road and defenses on top. Exact prompts, request parameters, generation times and sanitized usage are in `output/imagegen/terrain-*-final-v1.json`.

The 1536×864 originals were center-fitted with nearest-neighbor scaling to 1100×600 and saved as WebP at quality 92 for offline Android use. Source and bundled hashes are in [`terrain-bundle-v1.json`](../../output/imagegen/terrain-bundle-v1.json).

| Background | Bundled size | SHA-256 |
| --- | --- | --- |
| `terrain-greenfields.webp` | 387,098 bytes | `6402608c26b1a8ee17850113add6ffcba19001f0d4a561410892d480b1563466` |
| `terrain-woods.webp` | 361,878 bytes | `271bbba3f3c9cb8fe0b27aedcf840d2f662b1da73a2f94ec23f14eb39d053b78` |
| `terrain-sunstone.webp` | 348,746 bytes | `c5743d10a9acd86bdb8c1e369f17bfe50dd04ec4d2e3b4c61b7ac8616154890f` |
| `terrain-frostfall.webp` | 269,730 bytes | `08d3c7a53197ccc8f26ef10e34f38483eccc424d25f1a2f07b42954ec971dbba` |
| `terrain-hollow-crown.webp` | 336,136 bytes | `2bccc868c672d312ff1cd0c95216cde50cac970a96b0ea9b1517f07f81f4dcb9` |

## Axe-throwing orc

The user approved `output/imagegen/orc-thrower-concept-v1.png` for the new ranged attacker. It was generated with `openai/gpt-image-2.5-sunburst` through OpenRouter using the existing OpenCode credential in memory. The exact prompt, parameters and sanitized result are recorded in `output/imagegen/orc-thrower-concept-v1.json`. The prompt requests a single child-friendly green orc in a throwing pose, small iron hatchets and a dark teal shoulder wrap, matching the approved pixelated photographic style.

The 1024×1024 concept was cut out by removing border-connected neutral gray pixels, cropped and reduced with nearest-neighbor scaling. The bundled transparent `orc-thrower.png` is 169×176 pixels, SHA-256 `539f02229767126881e5f050dfd1e0f3b2023fc2f2e901da1dea548a318b3557`. Source SHA-256: `085d2a39601b122812365cb2dfc90f5f3e3303b2ff24dae3b378352a26319b4e`. Transformation details are in `output/imagegen/orc-thrower-bundle-v1.json`. Spinning thrown axes and damage effects are drawn in Canvas.

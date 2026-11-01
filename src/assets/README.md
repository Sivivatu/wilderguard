# Orc sprite provenance

Eric selected the Sunburst option from the three generated concepts. The original concept is `output/imagegen/orc-compare-sunburst-v1.png`, generated with `openai/gpt-image-2.5-sunburst` through OpenRouter at 1536×1024. Its exact prompt and generation settings are in [`comparison-v1.json`](../../output/imagegen/comparison-v1.json).

The game uses transparent pixel-art cutouts from that selected image. The neutral background was removed and the characters were reduced with nearest-neighbor scaling to preserve the blocky pixel edges. Their source-image SHA-256 values are:

| Sprite | Image size | SHA-256 |
| --- | --- | --- |
| `orc-clubber.png` | 122×176 | `d05d764bd64c7e85e4e647e09ab280f42e1db802e32b7cab7663bbf077102785` |
| `orc-axeman.png` | 127×176 | `2f6613fc4127c915de581af31f2846850880ac20fa6a9e3f01acf073d1651803` |
| `orc-chieftain.png` | 128×169 | `5a11b787085c067d3c57b7ca19621fad371b08ae2a83d2a2a28793add93bd8ea` |

All sprites are bundled locally for offline play. Their use here does not assign a license to Eric’s game or make the source code open source; the project license remains unchosen.

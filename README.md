# game-preview-ui-world
chat was ist das?


## Generate MFCG burg CSV from Azgaar JSON

Use this script to build a `City Generator Link` CSV directly from an Azgaar `.json` map (seed + burg data):

```bash
node scripts/generate_mfcg_burgs.cjs "afmg/Praneland Full 2025-12-28-23-09.json"
```

If no file is passed, the newest `.json` file in `afmg/` is used.

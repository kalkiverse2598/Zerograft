# SpriteMancer AI Prompts

This directory contains the system instruction and stage-specific prompt templates.

## Files

- `system_instruction.json` - Master AI identity and rules
- `stage_1_dna.txt` - DNA extraction prompt template
- `stage_3_budget.txt` - Frame budget computation prompt
- `stage_4_intent.txt` - Intent mirroring prompt
- `stage_5_script.txt` - Biomechanical script generation
- `stage_6_image.txt` - Spritesheet generation prompt

## Usage

```python
from app.prompts import load_prompt

# Load and format a stage prompt
prompt = load_prompt("stage_6_image", {
    "action_type": "Attack",
    "frame_count": 8,
    "character_dna": dna_dict,
})
```

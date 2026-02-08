/**
 * Audio System Recipe
 * Music, sound effects, and AudioStreamPlayer
 */

export const AUDIO_SYSTEM_RECIPE = `
# Audio System Setup

## Audio Nodes
| Node | Use For |
|------|---------|
| AudioStreamPlayer | Background music, UI sounds (non-positional) |
| AudioStreamPlayer2D | Game world sounds (positional) |
| AudioStreamPlayer3D | 3D positional audio |

## Level Audio Structure
\`\`\`
Level.tscn
├── ...
├── AudioStreamPlayer (name: BGM)    ← Background music
└── Player
    └── AudioStreamPlayer2D (name: JumpSound)
\`\`\`

## Playing Sounds
\`\`\`gdscript
# One-shot sound
$JumpSound.play()

# Check if playing
if not $BGM.playing:
    $BGM.play()

# Stop music
$BGM.stop()
\`\`\`

## Music Manager Autoload
\`\`\`gdscript
# autoloads/music_manager.gd
extends Node

@onready var player: AudioStreamPlayer = $AudioStreamPlayer

func play_music(track: AudioStream, fade_in: float = 1.0) -> void:
    player.stream = track
    player.volume_db = -80
    player.play()
    
    var tween = create_tween()
    tween.tween_property(player, "volume_db", 0, fade_in)

func stop_music(fade_out: float = 1.0) -> void:
    var tween = create_tween()
    tween.tween_property(player, "volume_db", -80, fade_out)
    await tween.finished
    player.stop()
\`\`\`

## Sound Effect Player
\`\`\`gdscript
# Player.gd
@onready var jump_sound: AudioStreamPlayer2D = $JumpSound
@onready var land_sound: AudioStreamPlayer2D = $LandSound

func _jump() -> void:
    velocity.y = JUMP_VELOCITY
    jump_sound.play()

func _on_landed() -> void:
    land_sound.play()
\`\`\`

## Volume Control (dB)
\`\`\`gdscript
# Full volume = 0 dB
# Half volume ≈ -6 dB
# Silent = -80 dB (or lower)

audio_player.volume_db = -10  # Quieter
audio_player.volume_db = 0    # Full volume
\`\`\`

## Audio Bus
Project Settings → Audio → Buses
- Master
- Music (for BGM, can mute in settings)
- SFX (for effects)

\`\`\`gdscript
# Set bus
audio_player.bus = "Music"
audio_player.bus = "SFX"
\`\`\`
`;

export const AUDIO_KEYWORDS = [
    'audio', 'music', 'sound', 'sfx', 'audiostreamplayer',
    'play', 'volume', 'fade', 'bus'
];

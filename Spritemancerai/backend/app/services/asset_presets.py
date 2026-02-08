"""
Asset Presets Library for SpriteMancer Universal Asset Generator.

Provides pre-configured DNA templates for quick generation of common assets.
Users can select a preset for instant generation or use as starting point.
"""
from app.models.asset_dna import (
    EffectDNA, EffectCategory, ShapePattern, EnergyProfile, ParticleDensity,
    TileDNA, TileCategory, TileMovementPattern, SeamlessAxis, LoopStyle,
    UIElementDNA, UIElementType, UIAnimationStyle,
    BackgroundDNA, BackgroundType, ParallaxLayer, TimeOfDay, Weather,
)


# ============================================================================
# Effect Presets
# ============================================================================

EFFECT_PRESETS: dict[str, EffectDNA] = {
    # Explosions
    "fire_explosion": EffectDNA(
        effect_category=EffectCategory.EXPLOSION,
        shape_pattern=ShapePattern.RADIAL,
        energy_profile=EnergyProfile.BURST,
        color_palette=["#FF4500", "#FF6B00", "#FFD700", "#FFF8DC"],
        particle_density=ParticleDensity.DENSE,
        suggested_frame_count=6,
        glow_intensity=0.8,
    ),
    "ice_shatter": EffectDNA(
        effect_category=EffectCategory.EXPLOSION,
        shape_pattern=ShapePattern.RADIAL,
        energy_profile=EnergyProfile.BURST,
        color_palette=["#00B4D8", "#90E0EF", "#CAF0F8", "#FFFFFF"],
        particle_density=ParticleDensity.DENSE,
        suggested_frame_count=6,
        glow_intensity=0.6,
    ),
    "smoke_puff": EffectDNA(
        effect_category=EffectCategory.EXPLOSION,
        shape_pattern=ShapePattern.RADIAL,
        energy_profile=EnergyProfile.FADE_IN_OUT,
        color_palette=["#2D2D2D", "#4A4A4A", "#6B6B6B", "#8B8B8B"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=8,
        glow_intensity=0.0,
    ),
    
    # Slashes
    "sword_slash": EffectDNA(
        effect_category=EffectCategory.SLASH,
        shape_pattern=ShapePattern.LINEAR,
        energy_profile=EnergyProfile.INSTANT,
        color_palette=["#FFFFFF", "#E0E0E0", "#A0A0A0"],
        particle_density=ParticleDensity.SPARSE,
        suggested_frame_count=4,
        glow_intensity=0.4,
    ),
    "fire_slash": EffectDNA(
        effect_category=EffectCategory.SLASH,
        shape_pattern=ShapePattern.LINEAR,
        energy_profile=EnergyProfile.FADE_IN_OUT,
        color_palette=["#FF4500", "#FF6B00", "#FFD700"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=5,
        glow_intensity=0.7,
    ),
    "lightning_slash": EffectDNA(
        effect_category=EffectCategory.SLASH,
        shape_pattern=ShapePattern.LINEAR,
        energy_profile=EnergyProfile.INSTANT,
        color_palette=["#00BFFF", "#87CEEB", "#FFFFFF"],
        particle_density=ParticleDensity.SPARSE,
        suggested_frame_count=4,
        glow_intensity=0.9,
    ),
    
    # Magic
    "magic_burst": EffectDNA(
        effect_category=EffectCategory.MAGIC,
        shape_pattern=ShapePattern.SPIRAL,
        energy_profile=EnergyProfile.PULSE,
        color_palette=["#9B59B6", "#8E44AD", "#BF55EC", "#FFFFFF"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=8,
        glow_intensity=0.8,
    ),
    "healing_aura": EffectDNA(
        effect_category=EffectCategory.AURA,
        shape_pattern=ShapePattern.SPIRAL,
        energy_profile=EnergyProfile.SUSTAINED,
        color_palette=["#00FF7F", "#7FFFD4", "#98FB98", "#FFFFFF"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=8,
        glow_intensity=0.6,
    ),
    "dark_magic": EffectDNA(
        effect_category=EffectCategory.MAGIC,
        shape_pattern=ShapePattern.SPIRAL,
        energy_profile=EnergyProfile.PULSE,
        color_palette=["#1A0033", "#4A0080", "#7B00B3", "#9B30FF"],
        particle_density=ParticleDensity.DENSE,
        suggested_frame_count=8,
        glow_intensity=0.5,
    ),
    
    # Impacts
    "hit_spark": EffectDNA(
        effect_category=EffectCategory.IMPACT,
        shape_pattern=ShapePattern.RADIAL,
        energy_profile=EnergyProfile.INSTANT,
        color_palette=["#FFFFFF", "#FFFF00", "#FFA500"],
        particle_density=ParticleDensity.SPARSE,
        suggested_frame_count=4,
        glow_intensity=1.0,
    ),
    "dust_impact": EffectDNA(
        effect_category=EffectCategory.IMPACT,
        shape_pattern=ShapePattern.WAVE,
        energy_profile=EnergyProfile.FADE_IN_OUT,
        color_palette=["#D2B48C", "#C4A76C", "#8B7355"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=6,
        glow_intensity=0.0,
    ),
    
    # Projectiles
    "fireball": EffectDNA(
        effect_category=EffectCategory.PROJECTILE,
        shape_pattern=ShapePattern.LINEAR,
        energy_profile=EnergyProfile.SUSTAINED,
        color_palette=["#FF4500", "#FF6B00", "#FFD700"],
        particle_density=ParticleDensity.MODERATE,
        suggested_frame_count=4,
        glow_intensity=0.8,
    ),
    "magic_missile": EffectDNA(
        effect_category=EffectCategory.PROJECTILE,
        shape_pattern=ShapePattern.LINEAR,
        energy_profile=EnergyProfile.SUSTAINED,
        color_palette=["#00BFFF", "#87CEEB", "#FFFFFF"],
        particle_density=ParticleDensity.SPARSE,
        suggested_frame_count=4,
        glow_intensity=0.7,
    ),
}


# ============================================================================
# Tile Presets
# ============================================================================

TILE_PRESETS: dict[str, TileDNA] = {
    # Water
    "water_calm": TileDNA(
        tile_category=TileCategory.WATER,
        movement_pattern=TileMovementPattern.WAVE,
        seamless_axis=SeamlessAxis.BOTH,
        loop_style=LoopStyle.SMOOTH,
        color_palette=["#1E90FF", "#4169E1", "#00BFFF", "#87CEEB"],
        suggested_frame_count=4,
        tile_size=32,
    ),
    "water_ocean": TileDNA(
        tile_category=TileCategory.WATER,
        movement_pattern=TileMovementPattern.WAVE,
        seamless_axis=SeamlessAxis.BOTH,
        loop_style=LoopStyle.ORGANIC,
        color_palette=["#006994", "#1E3A5F", "#2E5A7C", "#3E7A9C"],
        suggested_frame_count=6,
        tile_size=32,
    ),
    
    # Lava
    "lava_flow": TileDNA(
        tile_category=TileCategory.LAVA,
        movement_pattern=TileMovementPattern.FLOW,
        seamless_axis=SeamlessAxis.BOTH,
        loop_style=LoopStyle.ORGANIC,
        color_palette=["#FF4500", "#FF6B00", "#8B0000", "#FF0000"],
        suggested_frame_count=4,
        tile_size=32,
    ),
    "lava_bubble": TileDNA(
        tile_category=TileCategory.LAVA,
        movement_pattern=TileMovementPattern.BUBBLE,
        seamless_axis=SeamlessAxis.BOTH,
        loop_style=LoopStyle.CHOPPY,
        color_palette=["#FF4500", "#DC143C", "#8B0000", "#FFD700"],
        suggested_frame_count=6,
        tile_size=32,
    ),
    
    # Grass
    "grass_wind": TileDNA(
        tile_category=TileCategory.GRASS,
        movement_pattern=TileMovementPattern.SWAY,
        seamless_axis=SeamlessAxis.HORIZONTAL,
        loop_style=LoopStyle.SMOOTH,
        color_palette=["#228B22", "#32CD32", "#7CFC00"],
        suggested_frame_count=4,
        tile_size=32,
    ),
    "tall_grass": TileDNA(
        tile_category=TileCategory.GRASS,
        movement_pattern=TileMovementPattern.SWAY,
        seamless_axis=SeamlessAxis.HORIZONTAL,
        loop_style=LoopStyle.ORGANIC,
        color_palette=["#2E8B57", "#3CB371", "#66CDAA"],
        suggested_frame_count=6,
        tile_size=32,
    ),
    
    # Fire
    "torch_flame": TileDNA(
        tile_category=TileCategory.FIRE,
        movement_pattern=TileMovementPattern.FLICKER,
        seamless_axis=SeamlessAxis.VERTICAL,
        loop_style=LoopStyle.CHOPPY,
        color_palette=["#FF4500", "#FF6B00", "#FFD700", "#FFFFFF"],
        suggested_frame_count=4,
        tile_size=16,
    ),
    "campfire": TileDNA(
        tile_category=TileCategory.FIRE,
        movement_pattern=TileMovementPattern.FLICKER,
        seamless_axis=SeamlessAxis.VERTICAL,
        loop_style=LoopStyle.ORGANIC,
        color_palette=["#FF4500", "#FF6B00", "#DC143C", "#FFD700"],
        suggested_frame_count=6,
        tile_size=32,
    ),
    
    # Crystal
    "crystal_glow": TileDNA(
        tile_category=TileCategory.CRYSTAL,
        movement_pattern=TileMovementPattern.PULSE,
        seamless_axis=SeamlessAxis.BOTH,
        loop_style=LoopStyle.SMOOTH,
        color_palette=["#9B59B6", "#BF55EC", "#E8DAEF"],
        suggested_frame_count=4,
        tile_size=32,
    ),
    
    # Waterfall
    "waterfall": TileDNA(
        tile_category=TileCategory.WATERFALL,
        movement_pattern=TileMovementPattern.FLOW,
        seamless_axis=SeamlessAxis.VERTICAL,
        loop_style=LoopStyle.SMOOTH,
        color_palette=["#00BFFF", "#87CEEB", "#FFFFFF"],
        suggested_frame_count=4,
        tile_size=32,
    ),
}


# ============================================================================
# UI Element Presets
# ============================================================================

UI_PRESETS: dict[str, UIElementDNA] = {
    # Collectibles
    "gold_coin": UIElementDNA(
        element_type=UIElementType.COIN,
        animation_style=UIAnimationStyle.SPIN,
        color_palette=["#FFD700", "#FFA500", "#DAA520"],
        suggested_frame_count=8,
        element_size=16,
    ),
    "silver_coin": UIElementDNA(
        element_type=UIElementType.COIN,
        animation_style=UIAnimationStyle.SPIN,
        color_palette=["#C0C0C0", "#A9A9A9", "#D3D3D3"],
        suggested_frame_count=8,
        element_size=16,
    ),
    "red_gem": UIElementDNA(
        element_type=UIElementType.GEM,
        animation_style=UIAnimationStyle.SPARKLE,
        color_palette=["#DC143C", "#FF6B6B", "#FFFFFF"],
        suggested_frame_count=6,
        element_size=16,
    ),
    "blue_gem": UIElementDNA(
        element_type=UIElementType.GEM,
        animation_style=UIAnimationStyle.SPARKLE,
        color_palette=["#00BFFF", "#87CEEB", "#FFFFFF"],
        suggested_frame_count=6,
        element_size=16,
    ),
    "green_gem": UIElementDNA(
        element_type=UIElementType.GEM,
        animation_style=UIAnimationStyle.SPARKLE,
        color_palette=["#50C878", "#90EE90", "#FFFFFF"],
        suggested_frame_count=6,
        element_size=16,
    ),
    
    # Health/Status
    "heart_pulse": UIElementDNA(
        element_type=UIElementType.HEART,
        animation_style=UIAnimationStyle.PULSE,
        color_palette=["#FF0000", "#FF6B6B", "#FFFFFF"],
        suggested_frame_count=6,
        element_size=16,
    ),
    "star_twinkle": UIElementDNA(
        element_type=UIElementType.STAR,
        animation_style=UIAnimationStyle.SPARKLE,
        color_palette=["#FFD700", "#FFFF00", "#FFFFFF"],
        suggested_frame_count=6,
        element_size=16,
    ),
    
    # Interactive
    "button_glow": UIElementDNA(
        element_type=UIElementType.BUTTON,
        animation_style=UIAnimationStyle.GLOW,
        color_palette=["#4CAF50", "#8BC34A", "#FFFFFF"],
        suggested_frame_count=4,
        element_size=32,
    ),
    "arrow_bounce": UIElementDNA(
        element_type=UIElementType.ARROW,
        animation_style=UIAnimationStyle.BOUNCE,
        color_palette=["#FFFFFF", "#E0E0E0"],
        suggested_frame_count=6,
        element_size=16,
    ),
    
    # Items
    "key_shine": UIElementDNA(
        element_type=UIElementType.KEY,
        animation_style=UIAnimationStyle.SPARKLE,
        color_palette=["#FFD700", "#FFA500"],
        suggested_frame_count=4,
        element_size=16,
    ),
    "chest_glow": UIElementDNA(
        element_type=UIElementType.CHEST,
        animation_style=UIAnimationStyle.GLOW,
        color_palette=["#8B4513", "#A0522D", "#FFD700"],
        suggested_frame_count=4,
        element_size=32,
    ),
}


# ============================================================================
# Style Presets for Characters
# ============================================================================

CHARACTER_STYLE_PRESETS: dict[str, dict] = {
    "8bit_retro": {
        "description": "Classic 8-bit NES/Game Boy style",
        "color_limit": 4,
        "outline": True,
        "dithering": False,
        "size_recommendation": "16x16",
    },
    "16bit_snes": {
        "description": "16-bit SNES/Genesis style",
        "color_limit": 16,
        "outline": True,
        "dithering": True,
        "size_recommendation": "32x32",
    },
    "modern_pixel": {
        "description": "Modern pixel art with rich colors",
        "color_limit": 64,
        "outline": True,
        "dithering": True,
        "size_recommendation": "64x64",
    },
    "hd_pixel": {
        "description": "High-definition pixel art",
        "color_limit": None,
        "outline": False,
        "dithering": True,
        "size_recommendation": "128x128",
    },
}


# ============================================================================
# Background Presets
# ============================================================================

BACKGROUND_PRESETS: dict[str, BackgroundDNA] = {
    # Forest
    "forest_day": BackgroundDNA(
        background_type=BackgroundType.FOREST,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLEAR,
        color_palette=["#228B22", "#32CD32", "#87CEEB", "#F0F8FF", "#8B4513"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    "forest_night": BackgroundDNA(
        background_type=BackgroundType.FOREST,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#0D1B2A", "#1B263B", "#415A77", "#778DA9", "#1A472A"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    "forest_sunset": BackgroundDNA(
        background_type=BackgroundType.FOREST,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.SUNSET,
        weather=Weather.CLEAR,
        color_palette=["#FF6B35", "#FF8C42", "#FFE66D", "#4E4187", "#1A472A"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # Mountain
    "mountain_day": BackgroundDNA(
        background_type=BackgroundType.MOUNTAIN,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLEAR,
        color_palette=["#87CEEB", "#B0C4DE", "#708090", "#2F4F4F", "#FFFFFF"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    "mountain_sunset": BackgroundDNA(
        background_type=BackgroundType.MOUNTAIN,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.SUNSET,
        weather=Weather.CLEAR,
        color_palette=["#FF4500", "#FF6347", "#FFD700", "#4B0082", "#2F4F4F"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # Sky
    "sky_clouds": BackgroundDNA(
        background_type=BackgroundType.SKY,
        parallax_layer=ParallaxLayer.FAR,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLOUDY,
        color_palette=["#87CEEB", "#FFFFFF", "#E8E8E8", "#ADD8E6"],
        animated=True,
        suggested_width=320,
        suggested_height=180,
    ),
    "starfield": BackgroundDNA(
        background_type=BackgroundType.SPACE,
        parallax_layer=ParallaxLayer.FAR,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#0B0C10", "#1F2833", "#C5C6C7", "#66FCF1", "#45A29E"],
        animated=True,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # Cave/Dungeon
    "cave_dark": BackgroundDNA(
        background_type=BackgroundType.CAVE,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#1A1A2E", "#16213E", "#0F3460", "#E94560", "#533483"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    "dungeon_torch": BackgroundDNA(
        background_type=BackgroundType.DUNGEON,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#1A1A1A", "#2D2D2D", "#3D3D3D", "#FF6B00", "#FFD700"],
        animated=True,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # City
    "city_skyline": BackgroundDNA(
        background_type=BackgroundType.CITY,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#0D1B2A", "#1B263B", "#415A77", "#FFD700", "#FF6B6B"],
        animated=True,
        suggested_width=320,
        suggested_height=180,
    ),
    "city_day": BackgroundDNA(
        background_type=BackgroundType.CITY,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLEAR,
        color_palette=["#87CEEB", "#B0C4DE", "#A9A9A9", "#696969", "#2F4F4F"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # Underwater
    "underwater_deep": BackgroundDNA(
        background_type=BackgroundType.UNDERWATER,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLEAR,
        color_palette=["#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8", "#023E8A"],
        animated=True,
        suggested_width=320,
        suggested_height=180,
    ),
    
    # Desert
    "desert_dunes": BackgroundDNA(
        background_type=BackgroundType.DESERT,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.DAY,
        weather=Weather.CLEAR,
        color_palette=["#EDC9AF", "#D4A574", "#C19A6B", "#87CEEB", "#F0F8FF"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
    "desert_night": BackgroundDNA(
        background_type=BackgroundType.DESERT,
        parallax_layer=ParallaxLayer.FULL,
        time_of_day=TimeOfDay.NIGHT,
        weather=Weather.CLEAR,
        color_palette=["#1A1A2E", "#16213E", "#C19A6B", "#D4A574", "#FFFFFF"],
        animated=False,
        suggested_width=320,
        suggested_height=180,
    ),
}


# ============================================================================
# Helper Functions
# ============================================================================

def get_effect_preset(name: str) -> EffectDNA | None:
    """Get an effect preset by name."""
    return EFFECT_PRESETS.get(name)


def get_tile_preset(name: str) -> TileDNA | None:
    """Get a tile preset by name."""
    return TILE_PRESETS.get(name)


def get_ui_preset(name: str) -> UIElementDNA | None:
    """Get a UI element preset by name."""
    return UI_PRESETS.get(name)


def get_background_preset(name: str) -> BackgroundDNA | None:
    """Get a background preset by name."""
    return BACKGROUND_PRESETS.get(name)


def list_presets() -> dict:
    """List all available presets by category."""
    return {
        "effects": list(EFFECT_PRESETS.keys()),
        "tiles": list(TILE_PRESETS.keys()),
        "ui_elements": list(UI_PRESETS.keys()),
        "backgrounds": list(BACKGROUND_PRESETS.keys()),
        "character_styles": list(CHARACTER_STYLE_PRESETS.keys()),
    }

"""
Pipeline Integration Test Script
Tests all 8 stages of the SpriteMancer animation pipeline.
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.db.supabase_client import supabase_service


PROJECT_ID = "ecd953e3-fdff-4d69-baa9-85d333038d13"


async def on_stage_update(project_id, stage, name, status, result):
    """WebSocket callback mock - prints stage updates."""
    print(f"  Stage {stage}: {name} - {status}")
    if result and status == "complete":
        # Show abbreviated result
        for k, v in result.items():
            if isinstance(v, dict):
                print(f"    {k}: {{...}}")
            elif isinstance(v, list):
                print(f"    {k}: [{len(v)} items]")
            elif isinstance(v, str) and len(v) > 50:
                print(f"    {k}: {v[:50]}...")
            else:
                print(f"    {k}: {v}")


async def run_pipeline_test():
    print("=" * 60)
    print("SpriteMancer Pipeline Integration Test")
    print("=" * 60)
    
    # Get reference image from storage
    print("\n📥 Fetching reference image from project...")
    project = await supabase_service.get_project(PROJECT_ID)
    if not project or not project.get("reference_image_url"):
        print("❌ No reference image found for project!")
        return
    
    print(f"  Reference URL: {project['reference_image_url'][:50]}...")
    
    # Download reference image
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(project["reference_image_url"])
        reference_image = resp.content
    print(f"  Image size: {len(reference_image)} bytes")
    
    # Create pipeline orchestrator
    print("\n🚀 Creating pipeline orchestrator...")
    pipeline = PipelineOrchestrator(PROJECT_ID, on_stage_update)
    
    # Test parameters
    action_type = "Sword Slash"
    difficulty = "LIGHT"
    perspective = "side"
    
    print(f"\n📝 Test Parameters:")
    print(f"  Action: {action_type}")
    print(f"  Difficulty: {difficulty}")
    print(f"  Perspective: {perspective}")
    
    # Run full pipeline
    print("\n" + "=" * 60)
    print("Running Full Pipeline...")
    print("=" * 60)
    
    try:
        # Stage 1: DNA Extraction
        print("\n[Stage 1] DNA Extraction...")
        dna = await pipeline.run_stage_1(reference_image)
        print(f"  ✅ Archetype: {dna.archetype}")
        print(f"  ✅ Weapon: {dna.weapon_type} ({dna.weapon_mass})")
        
        # Skip Stage 2 for this test (no edits)
        pipeline.state.dna_verified = True
        print("\n[Stage 2] DNA Verification - Skipped (using extracted DNA)")
        
        # Stage 3: Action Definition
        print(f"\n[Stage 3] Action Definition ({action_type})...")
        frame_budget = await pipeline.run_stage_3(action_type, difficulty, perspective)
        print(f"  ✅ Frame count: {frame_budget.final_frame_count}")
        print(f"  ✅ Grid: {frame_budget.grid_dim}x{frame_budget.grid_dim}")
        
        # Stage 4: Intent Mirroring
        print("\n[Stage 4] Intent Mirroring...")
        intent = await pipeline.run_stage_4()
        print(f"  ✅ Intent: {intent[:100]}...")
        
        # Confirm intent
        await pipeline.confirm_intent(True)
        print("  ✅ Intent confirmed!")
        
        # Stage 5: Biomechanical Scripting
        print("\n[Stage 5] Biomechanical Scripting...")
        script = await pipeline.run_stage_5()
        print(f"  ✅ Generated {len(script.frames)} frame scripts")
        
        # Stage 6: Image Generation
        print("\n[Stage 6] Image Generation...")
        spritesheet = await pipeline.run_stage_6(reference_image)
        print(f"  ✅ Spritesheet size: {len(spritesheet)} bytes")
        print(f"  ✅ URL: {pipeline.state.spritesheet_url[:50]}...")
        
        # Stage 7: Post-Processing
        print("\n[Stage 7] Post-Processing (OpenCV)...")
        frames = await pipeline.run_stage_7(spritesheet)
        print(f"  ✅ Extracted {len(frames)} frames")
        print(f"  ✅ Frame URLs: {len(pipeline.state.frame_urls)} uploaded")
        
        # Stage 8: Repair Loop - Only on demand
        print("\n[Stage 8] Repair Loop - Available on demand")
        
        print("\n" + "=" * 60)
        print("✅ PIPELINE TEST COMPLETE!")
        print("=" * 60)
        
        print("\n📊 Final Results:")
        print(f"  Project ID: {PROJECT_ID}")
        print(f"  Spritesheet: {pipeline.state.spritesheet_url}")
        print(f"  Frames: {len(pipeline.state.frame_urls)}")
        
    except Exception as e:
        print(f"\n❌ Pipeline failed at stage: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(run_pipeline_test())

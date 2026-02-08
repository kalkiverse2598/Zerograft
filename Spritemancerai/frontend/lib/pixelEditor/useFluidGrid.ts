/**
 * Fluid Grid Simulation Hook
 * GPU-accelerated Navier-Stokes fluid simulation using WebGL
 * Based on Jos Stam's "Stable Fluids" algorithm
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    initWebGL,
    createDoubleFBO,
    createFBO,
    disposeDoubleFBO,
    disposeFBO,
    createProgram,
    renderToFBO,
    readPixels,
    initQuadBuffer,
    DoubleFBO,
    FBO,
    ShaderProgram,
    WebGLResources,
} from './webgl/useWebGLContext';
import { FLUID_SHADERS } from './webgl/fluidShaders';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FluidGridConfig {
    resolution: number;           // Simulation grid size (64, 128, 256)
    dyeResolution: number;        // Color/dye resolution (can be higher than sim)
    viscosity: number;            // Fluid thickness (0.0 - 1.0)
    diffusion: number;            // Color spread rate
    pressureIterations: number;   // Jacobi iterations (20-80)
    curlStrength: number;         // Vorticity confinement (0-50)
    velocityDissipation: number;  // Velocity decay (0.9-1.0)
    densityDissipation: number;   // Color decay (0.9-1.0)
    splatRadius: number;          // Force/color application radius
    splatForce: number;           // Force multiplier
    // Color ramp for density-to-color mapping (5 colors: outside to inside)
    colorRamp: [
        [number, number, number], // Color 0 - Darkest (outside)
        [number, number, number], // Color 1
        [number, number, number], // Color 2
        [number, number, number], // Color 3
        [number, number, number], // Color 4 - Brightest (inside/hot)
    ];
    alphaThreshold: number;       // Threshold for crisp alpha edges
    useColorRamp: boolean;        // Whether to use color ramp rendering
}

interface FluidState {
    velocity: DoubleFBO | null;
    density: DoubleFBO | null;
    curl: FBO | null;
    divergence: FBO | null;
    pressure: DoubleFBO | null;
}

interface CompiledPrograms {
    clear: ShaderProgram;
    splat: ShaderProgram;
    advection: ShaderProgram;
    curl: ShaderProgram;
    vorticity: ShaderProgram;
    divergence: ShaderProgram;
    pressure: ShaderProgram;
    gradientSubtract: ShaderProgram;
    display: ShaderProgram;
    displayColorRamp: ShaderProgram;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_FLUID_GRID_CONFIG: FluidGridConfig = {
    resolution: 128,
    dyeResolution: 256,
    viscosity: 0.0001,
    diffusion: 0.001,
    pressureIterations: 40,
    curlStrength: 30,
    velocityDissipation: 0.98,
    densityDissipation: 0.97,
    splatRadius: 0.005,
    splatForce: 6000,
    // Default fire gradient (outside → inside)
    colorRamp: [
        [0.1, 0.0, 0.0],   // Dark red (outside)
        [0.8, 0.1, 0.0],   // Red-orange
        [1.0, 0.5, 0.0],   // Orange
        [1.0, 0.8, 0.2],   // Yellow-orange
        [1.0, 1.0, 0.8],   // Bright white-yellow (inside/hot)
    ],
    alphaThreshold: 0.05,
    useColorRamp: true,
};

// ============================================================================
// Main Hook
// ============================================================================

export function useFluidGrid() {
    const [config, setConfig] = useState<FluidGridConfig>(DEFAULT_FLUID_GRID_CONFIG);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const glResourcesRef = useRef<WebGLResources | null>(null);
    const stateRef = useRef<FluidState>({
        velocity: null,
        density: null,
        curl: null,
        divergence: null,
        pressure: null,
    });
    const programsRef = useRef<CompiledPrograms | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    /**
     * Update config
     */
    const updateConfig = useCallback((updates: Partial<FluidGridConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Initialize WebGL and compile shaders
     */
    const initSimulation = useCallback((canvas: HTMLCanvasElement): boolean => {
        // Initialize WebGL context
        const resources = initWebGL(canvas);
        if (!resources) {
            console.error('Failed to initialize WebGL');
            return false;
        }

        const { gl } = resources;
        glResourcesRef.current = resources;
        canvasRef.current = canvas;

        // Initialize quad buffer
        initQuadBuffer(gl);

        // Compile all shader programs
        const programs: Partial<CompiledPrograms> = {};

        const shaderKeys: (keyof typeof FLUID_SHADERS)[] = [
            'clear', 'splat', 'advection', 'curl', 'vorticity',
            'divergence', 'pressure', 'gradientSubtract', 'display', 'displayColorRamp'
        ];

        for (const key of shaderKeys) {
            const shader = FLUID_SHADERS[key];
            const program = createProgram(gl, shader.vertex, shader.fragment);
            if (!program) {
                console.error(`Failed to compile ${key} shader`);
                return false;
            }
            programs[key as keyof CompiledPrograms] = program;
        }

        programsRef.current = programs as CompiledPrograms;

        // Create framebuffers
        const simRes = config.resolution;
        const dyeRes = config.dyeResolution;

        const state = stateRef.current;
        state.velocity = createDoubleFBO(gl, simRes, simRes, gl.RG16F, gl.RG, gl.HALF_FLOAT);
        state.density = createDoubleFBO(gl, dyeRes, dyeRes);
        state.curl = createFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT);
        state.divergence = createFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT);
        state.pressure = createDoubleFBO(gl, simRes, simRes, gl.R16F, gl.RED, gl.HALF_FLOAT);

        if (!state.velocity || !state.density || !state.curl || !state.divergence || !state.pressure) {
            console.error('Failed to create framebuffers');
            return false;
        }

        setIsInitialized(true);
        console.log('✅ Fluid simulation initialized');
        return true;
    }, [config.resolution, config.dyeResolution]);

    /**
     * Add a splat (force + color) at a point
     */
    const splat = useCallback((x: number, y: number, dx: number, dy: number, color: [number, number, number]) => {
        const gl = glResourcesRef.current?.gl;
        const programs = programsRef.current;
        const state = stateRef.current;

        if (!gl || !programs || !state.velocity || !state.density) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const aspectRatio = canvas.width / canvas.height;

        // Splat velocity
        renderToFBO(gl, state.velocity.write, programs.splat, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uTarget') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform1f(uniforms.get('uAspectRatio') || null, aspectRatio);
            gl.uniform2f(uniforms.get('uPoint') || null, x, y);
            gl.uniform3f(uniforms.get('uColor') || null, dx * config.splatForce, dy * config.splatForce, 0);
            gl.uniform1f(uniforms.get('uRadius') || null, config.splatRadius);
        });
        state.velocity.swap();

        // Splat color
        renderToFBO(gl, state.density.write, programs.splat, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uTarget') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);
            gl.uniform1f(uniforms.get('uAspectRatio') || null, aspectRatio);
            gl.uniform2f(uniforms.get('uPoint') || null, x, y);
            gl.uniform3f(uniforms.get('uColor') || null, color[0], color[1], color[2]);
            gl.uniform1f(uniforms.get('uRadius') || null, config.splatRadius);
        });
        state.density.swap();
    }, [config.splatRadius, config.splatForce]);

    /**
     * Run one simulation step
     */
    const step = useCallback((dt: number) => {
        const gl = glResourcesRef.current?.gl;
        const programs = programsRef.current;
        const state = stateRef.current;

        if (!gl || !programs || !state.velocity || !state.density || !state.curl || !state.divergence || !state.pressure) {
            return;
        }

        const simRes = config.resolution;
        const dyeRes = config.dyeResolution;
        const texelSize = [1.0 / simRes, 1.0 / simRes];
        const dyeTexelSize = [1.0 / dyeRes, 1.0 / dyeRes];

        // 1. Calculate curl
        renderToFBO(gl, state.curl, programs.curl, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uVelocity') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
        });

        // 2. Apply vorticity confinement
        renderToFBO(gl, state.velocity.write, programs.vorticity, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uVelocity') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform1i(uniforms.get('uCurl') || null, 1);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, state.curl!.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
            gl.uniform1f(uniforms.get('uCurlStrength') || null, config.curlStrength);
            gl.uniform1f(uniforms.get('uDt') || null, dt);
        });
        state.velocity.swap();

        // 3. Calculate divergence
        renderToFBO(gl, state.divergence, programs.divergence, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uVelocity') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
        });

        // 4. Clear pressure
        renderToFBO(gl, state.pressure.read, programs.clear, (gl, uniforms) => {
            gl.uniform4f(uniforms.get('uValue') || null, 0, 0, 0, 1);
        });

        // 5. Solve pressure (Jacobi iteration)
        for (let i = 0; i < config.pressureIterations; i++) {
            renderToFBO(gl, state.pressure.write, programs.pressure, (gl, uniforms) => {
                gl.uniform1i(uniforms.get('uPressure') || null, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, state.pressure!.read.texture);
                gl.uniform1i(uniforms.get('uDivergence') || null, 1);
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, state.divergence!.texture);
                gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
            });
            state.pressure.swap();
        }

        // 6. Subtract pressure gradient from velocity
        renderToFBO(gl, state.velocity.write, programs.gradientSubtract, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uPressure') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.pressure!.read.texture);
            gl.uniform1i(uniforms.get('uVelocity') || null, 1);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
        });
        state.velocity.swap();

        // 7. Advect velocity
        renderToFBO(gl, state.velocity.write, programs.advection, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uVelocity') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform1i(uniforms.get('uSource') || null, 1);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, texelSize);
            gl.uniform1f(uniforms.get('uDt') || null, dt);
            gl.uniform1f(uniforms.get('uDissipation') || null, config.velocityDissipation);
        });
        state.velocity.swap();

        // 8. Advect density (dye)
        renderToFBO(gl, state.density.write, programs.advection, (gl, uniforms) => {
            gl.uniform1i(uniforms.get('uVelocity') || null, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.velocity!.read.texture);
            gl.uniform1i(uniforms.get('uSource') || null, 1);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);
            gl.uniform2fv(uniforms.get('uTexelSize') || null, dyeTexelSize);
            gl.uniform1f(uniforms.get('uDt') || null, dt);
            gl.uniform1f(uniforms.get('uDissipation') || null, config.densityDissipation);
        });
        state.density.swap();
    }, [config]);

    /**
     * Render to canvas
     */
    const render = useCallback(() => {
        const gl = glResourcesRef.current?.gl;
        const programs = programsRef.current;
        const state = stateRef.current;
        const canvas = canvasRef.current;

        if (!gl || !programs || !state.density || !canvas) return;

        // Render density to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Use color ramp shader for polished fire/smoke look
        if (config.useColorRamp) {
            renderToFBO(gl, null, programs.displayColorRamp, (gl, uniforms) => {
                gl.uniform1i(uniforms.get('uTexture') || null, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);

                // Set 5-point color gradient uniforms
                const ramp = config.colorRamp;
                gl.uniform3f(uniforms.get('uColor0') || null, ramp[0][0], ramp[0][1], ramp[0][2]);
                gl.uniform3f(uniforms.get('uColor1') || null, ramp[1][0], ramp[1][1], ramp[1][2]);
                gl.uniform3f(uniforms.get('uColor2') || null, ramp[2][0], ramp[2][1], ramp[2][2]);
                gl.uniform3f(uniforms.get('uColor3') || null, ramp[3][0], ramp[3][1], ramp[3][2]);
                gl.uniform3f(uniforms.get('uColor4') || null, ramp[4][0], ramp[4][1], ramp[4][2]);
                gl.uniform1f(uniforms.get('uAlphaThreshold') || null, config.alphaThreshold);
            });
        } else {
            // Original display shader
            renderToFBO(gl, null, programs.display, (gl, uniforms) => {
                gl.uniform1i(uniforms.get('uTexture') || null, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);
            });
        }
    }, [config.useColorRamp, config.colorRamp, config.alphaThreshold]);

    /**
     * Get current frame as ImageData
     */
    const getImageData = useCallback((width: number, height: number): ImageData | null => {
        const gl = glResourcesRef.current?.gl;
        const state = stateRef.current;

        if (!gl || !state.density) return null;

        // Render density to a temporary FBO at the target resolution
        const tempFBO = createFBO(gl, width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        if (!tempFBO) return null;

        const programs = programsRef.current;
        if (!programs) {
            disposeFBO(gl, tempFBO);
            return null;
        }

        // Use color ramp shader for polished output
        if (config.useColorRamp) {
            renderToFBO(gl, tempFBO, programs.displayColorRamp, (gl, uniforms) => {
                gl.uniform1i(uniforms.get('uTexture') || null, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);

                // Set 5-point color gradient uniforms
                const ramp = config.colorRamp;
                gl.uniform3f(uniforms.get('uColor0') || null, ramp[0][0], ramp[0][1], ramp[0][2]);
                gl.uniform3f(uniforms.get('uColor1') || null, ramp[1][0], ramp[1][1], ramp[1][2]);
                gl.uniform3f(uniforms.get('uColor2') || null, ramp[2][0], ramp[2][1], ramp[2][2]);
                gl.uniform3f(uniforms.get('uColor3') || null, ramp[3][0], ramp[3][1], ramp[3][2]);
                gl.uniform3f(uniforms.get('uColor4') || null, ramp[4][0], ramp[4][1], ramp[4][2]);
                gl.uniform1f(uniforms.get('uAlphaThreshold') || null, config.alphaThreshold);
            });
        } else {
            renderToFBO(gl, tempFBO, programs.display, (gl, uniforms) => {
                gl.uniform1i(uniforms.get('uTexture') || null, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, state.density!.read.texture);
            });
        }

        const imageData = readPixels(gl, tempFBO, width, height);
        disposeFBO(gl, tempFBO);

        return imageData;
    }, [config.useColorRamp, config.colorRamp, config.alphaThreshold]);

    /**
     * Generate animation frames
     */
    const generateAnimation = useCallback(async (
        width: number,
        height: number,
        duration: number,
        autoSplat: boolean = false  // Disabled by default - colors come from user interaction
    ): Promise<{ frames: ImageData[]; width: number; height: number }> => {
        setIsGenerating(true);

        const frames: ImageData[] = [];
        const dt = 0.016; // 60fps

        try {
            for (let i = 0; i < duration; i++) {
                // Auto-splat disabled by default - user paints the colors they want
                // Only simulation physics runs here

                step(dt);
                render();

                const imageData = getImageData(width, height);
                if (imageData) {
                    frames.push(imageData);
                }
            }
        } finally {
            setIsGenerating(false);
        }

        return { frames, width, height };
    }, [step, render, splat, getImageData]);

    /**
     * Dispose of all WebGL resources
     */
    const dispose = useCallback(() => {
        const gl = glResourcesRef.current?.gl;
        const state = stateRef.current;

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if (gl) {
            if (state.velocity) disposeDoubleFBO(gl, state.velocity);
            if (state.density) disposeDoubleFBO(gl, state.density);
            if (state.curl) disposeFBO(gl, state.curl);
            if (state.divergence) disposeFBO(gl, state.divergence);
            if (state.pressure) disposeDoubleFBO(gl, state.pressure);

            // Delete shader programs
            if (programsRef.current) {
                Object.values(programsRef.current).forEach(prog => {
                    gl.deleteProgram(prog.program);
                });
            }
        }

        stateRef.current = {
            velocity: null,
            density: null,
            curl: null,
            divergence: null,
            pressure: null,
        };
        programsRef.current = null;
        glResourcesRef.current = null;
        setIsInitialized(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            dispose();
        };
    }, [dispose]);

    return {
        config,
        setConfig,
        updateConfig,
        isInitialized,
        isGenerating,
        initSimulation,
        step,
        render,
        splat,
        getImageData,
        generateAnimation,
        dispose,
    };
}

export default useFluidGrid;

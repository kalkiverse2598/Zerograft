/**
 * WebGL Context Hook
 * Provides WebGL2 context initialization, texture management, and framebuffer utilities
 * for GPU-accelerated fluid simulation.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WebGLResources {
    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
    extensions: WebGLExtensions;
}

export interface WebGLExtensions {
    floatTexture: boolean;
    linearFiltering: boolean;
}

export interface DoubleFBO {
    read: FBO;
    write: FBO;
    swap: () => void;
}

export interface FBO {
    texture: WebGLTexture;
    framebuffer: WebGLFramebuffer;
    width: number;
    height: number;
}

export interface ShaderProgram {
    program: WebGLProgram;
    uniforms: Map<string, WebGLUniformLocation>;
}

// ============================================================================
// WebGL Initialization
// ============================================================================

/**
 * Initialize WebGL2 context with required extensions
 */
export function initWebGL(canvas: HTMLCanvasElement): WebGLResources | null {
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
    });

    if (!gl) {
        console.error('WebGL2 not supported');
        return null;
    }

    // Check for floating-point texture support
    const floatTexture = Boolean(gl.getExtension('EXT_color_buffer_float'));
    const linearFiltering = Boolean(gl.getExtension('OES_texture_float_linear'));

    if (!floatTexture) {
        console.warn('Floating-point textures not supported, using fallback');
    }

    return {
        gl,
        canvas,
        extensions: {
            floatTexture,
            linearFiltering,
        },
    };
}

// ============================================================================
// Texture Creation
// ============================================================================

/**
 * Create a floating-point texture for simulation data
 */
export function createTexture(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number = gl.RGBA16F,
    format: number = gl.RGBA,
    type: number = gl.HALF_FLOAT,
    filter: number = gl.LINEAR
): WebGLTexture | null {
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    return texture;
}

/**
 * Create a standard RGBA8 texture (for display)
 */
export function createRGBA8Texture(
    gl: WebGL2RenderingContext,
    width: number,
    height: number
): WebGLTexture | null {
    return createTexture(gl, width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
}

// ============================================================================
// Framebuffer Objects (FBO)
// ============================================================================

/**
 * Create a single framebuffer with attached texture
 */
export function createFBO(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number = gl.RGBA16F,
    format: number = gl.RGBA,
    type: number = gl.HALF_FLOAT,
    filter: number = gl.LINEAR
): FBO | null {
    const texture = createTexture(gl, width, height, internalFormat, format, type, filter);
    if (!texture) return null;

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
        gl.deleteTexture(texture);
        return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Framebuffer incomplete:', status);
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(framebuffer);
        return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture, framebuffer, width, height };
}

/**
 * Create a double-buffered FBO for ping-pong rendering
 */
export function createDoubleFBO(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number = gl.RGBA16F,
    format: number = gl.RGBA,
    type: number = gl.HALF_FLOAT,
    filter: number = gl.LINEAR
): DoubleFBO | null {
    const fbo1 = createFBO(gl, width, height, internalFormat, format, type, filter);
    const fbo2 = createFBO(gl, width, height, internalFormat, format, type, filter);

    if (!fbo1 || !fbo2) {
        if (fbo1) disposeFBO(gl, fbo1);
        if (fbo2) disposeFBO(gl, fbo2);
        return null;
    }

    let read = fbo1;
    let write = fbo2;

    return {
        get read() { return read; },
        get write() { return write; },
        swap: () => {
            const temp = read;
            read = write;
            write = temp;
        },
    };
}

/**
 * Dispose of an FBO and its resources
 */
export function disposeFBO(gl: WebGL2RenderingContext, fbo: FBO): void {
    gl.deleteTexture(fbo.texture);
    gl.deleteFramebuffer(fbo.framebuffer);
}

/**
 * Dispose of a double FBO
 */
export function disposeDoubleFBO(gl: WebGL2RenderingContext, doubleFBO: DoubleFBO): void {
    disposeFBO(gl, doubleFBO.read);
    disposeFBO(gl, doubleFBO.write);
}

// ============================================================================
// Shader Compilation
// ============================================================================

/**
 * Compile a shader from source
 */
export function compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

/**
 * Create a shader program from vertex and fragment sources
 */
export function createProgram(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
): ShaderProgram | null {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }

    // Clean up shaders (they're linked into the program now)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Extract uniform locations
    const uniforms = new Map<string, WebGLUniformLocation>();
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        if (info) {
            const location = gl.getUniformLocation(program, info.name);
            if (location) {
                uniforms.set(info.name, location);
            }
        }
    }

    return { program, uniforms };
}

// ============================================================================
// Rendering Utilities
// ============================================================================

/**
 * Fullscreen quad vertex positions (two triangles)
 */
const QUAD_VERTICES = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
]);

let quadBuffer: WebGLBuffer | null = null;

/**
 * Set up the fullscreen quad vertex buffer
 */
export function initQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer | null {
    if (quadBuffer) return quadBuffer;

    quadBuffer = gl.createBuffer();
    if (!quadBuffer) return null;

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    return quadBuffer;
}

/**
 * Bind the quad buffer and set up vertex attributes
 */
export function bindQuad(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    if (!quadBuffer) {
        quadBuffer = initQuadBuffer(gl);
    }

    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    if (positionLoc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    }
}

/**
 * Render to a framebuffer
 */
export function renderToFBO(
    gl: WebGL2RenderingContext,
    fbo: FBO | null,
    program: ShaderProgram,
    setupUniforms: (gl: WebGL2RenderingContext, uniforms: Map<string, WebGLUniformLocation>) => void
): void {
    if (fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
        gl.viewport(0, 0, fbo.width, fbo.height);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    gl.useProgram(program.program);
    bindQuad(gl, program.program);
    setupUniforms(gl, program.uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/**
 * Read pixels from framebuffer as ImageData
 */
export function readPixels(
    gl: WebGL2RenderingContext,
    fbo: FBO | null,
    width: number,
    height: number
): ImageData {
    if (fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip Y (WebGL has origin at bottom-left)
    const flipped = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const srcRow = (height - 1 - y) * width * 4;
        const dstRow = y * width * 4;
        for (let x = 0; x < width * 4; x++) {
            flipped[dstRow + x] = pixels[srcRow + x];
        }
    }

    return new ImageData(flipped, width, height);
}

// ============================================================================
// Common Shaders
// ============================================================================

/**
 * Fullscreen quad vertex shader
 */
export const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;

void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * Simple passthrough fragment shader (for testing)
 */
export const PASSTHROUGH_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;

void main() {
    fragColor = texture(uTexture, vUv);
}
`;

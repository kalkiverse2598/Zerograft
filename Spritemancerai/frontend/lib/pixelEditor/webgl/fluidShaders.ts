/**
 * Fluid Simulation Shaders
 * GLSL shaders for GPU-accelerated Navier-Stokes fluid simulation
 * Based on Jos Stam's "Stable Fluids" algorithm
 */

import { VERTEX_SHADER } from './useWebGLContext';

// ============================================================================
// Common Shader Code
// ============================================================================

const PRECISION = `#version 300 es
precision highp float;
precision highp sampler2D;
`;

// ============================================================================
// Clear Shader - Initialize/reset textures
// ============================================================================

export const CLEAR_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform vec4 uValue;

void main() {
    fragColor = uValue;
}
`;

// ============================================================================
// Splat Shader - Add force/color at a point
// ============================================================================

export const SPLAT_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTarget;
uniform float uAspectRatio;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;

void main() {
    vec2 pos = vUv - uPoint;
    pos.x *= uAspectRatio;
    vec3 splat = exp(-dot(pos, pos) / uRadius) * uColor;
    vec3 base = texture(uTarget, vUv).rgb;
    fragColor = vec4(base + splat, 1.0);
}
`;

// ============================================================================
// Advection Shader - Move quantities through velocity field
// ============================================================================

export const ADVECTION_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;

void main() {
    vec2 velocity = texture(uVelocity, vUv).xy;
    vec2 prevUv = vUv - velocity * uDt * uTexelSize;
    
    // Clamp to valid UV range
    prevUv = clamp(prevUv, uTexelSize, 1.0 - uTexelSize);
    
    fragColor = uDissipation * texture(uSource, prevUv);
}
`;

// ============================================================================
// Advection Shader with Manual Interpolation (for velocity field)
// ============================================================================

export const ADVECTION_MANUAL_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uDyeTexelSize;
uniform float uDt;
uniform float uDissipation;

vec4 bilerp(sampler2D tex, vec2 uv, vec2 texelSize) {
    vec2 st = uv / texelSize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    
    vec4 a = texture(tex, (iuv + vec2(0.5, 0.5)) * texelSize);
    vec4 b = texture(tex, (iuv + vec2(1.5, 0.5)) * texelSize);
    vec4 c = texture(tex, (iuv + vec2(0.5, 1.5)) * texelSize);
    vec4 d = texture(tex, (iuv + vec2(1.5, 1.5)) * texelSize);
    
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main() {
    vec2 velocity = bilerp(uVelocity, vUv, uTexelSize).xy;
    vec2 prevUv = vUv - velocity * uDt;
    
    prevUv = clamp(prevUv, uDyeTexelSize, 1.0 - uDyeTexelSize);
    
    fragColor = uDissipation * bilerp(uSource, prevUv, uDyeTexelSize);
}
`;

// ============================================================================
// Curl Shader - Calculate curl/vorticity of velocity field
// ============================================================================

export const CURL_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform vec2 uTexelSize;

void main() {
    float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
    float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
    float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
    float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
    
    float curl = R - L - T + B;
    fragColor = vec4(curl, 0.0, 0.0, 1.0);
}
`;

// ============================================================================
// Vorticity Shader - Apply vorticity confinement force
// ============================================================================

export const VORTICITY_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform float uCurlStrength;
uniform float uDt;

void main() {
    float L = texture(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x;
    float T = texture(uCurl, vUv + vec2(0.0, uTexelSize.y)).x;
    float B = texture(uCurl, vUv - vec2(0.0, uTexelSize.y)).x;
    float C = texture(uCurl, vUv).x;
    
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= uCurlStrength * C;
    force.y *= -1.0;
    
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity += force * uDt;
    
    fragColor = vec4(velocity, 0.0, 1.0);
}
`;

// ============================================================================
// Divergence Shader - Calculate divergence of velocity field
// ============================================================================

export const DIVERGENCE_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform vec2 uTexelSize;

void main() {
    float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
    float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    
    float divergence = 0.5 * (R - L + T - B);
    fragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;

// ============================================================================
// Pressure Shader - Jacobi iteration to solve pressure
// ============================================================================

export const PRESSURE_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;

void main() {
    float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float C = texture(uDivergence, vUv).x;
    
    float pressure = (L + R + B + T - C) * 0.25;
    fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

// ============================================================================
// Gradient Subtract Shader - Subtract pressure gradient from velocity
// ============================================================================

export const GRADIENT_SUBTRACT_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;

void main() {
    float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    
    vec2 velocity = texture(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    
    fragColor = vec4(velocity, 0.0, 1.0);
}
`;

// ============================================================================
// Display Shader - Render density to screen
// ============================================================================

export const DISPLAY_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;

void main() {
    vec3 color = texture(uTexture, vUv).rgb;
    // Calculate alpha based on color brightness for transparency
    float alpha = max(color.r, max(color.g, color.b));
    // Clamp alpha to reasonable range
    alpha = clamp(alpha * 2.0, 0.0, 1.0);
    fragColor = vec4(color, alpha);
}
`;

// ============================================================================
// Display with Color Ramp - Map density to gradient for polished look
// ============================================================================

export const DISPLAY_COLORRAMP_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
// 5-point color gradient (outside to inside / cold to hot)
uniform vec3 uColor0; // Darkest (outside)
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4; // Brightest (inside/hot)
uniform float uAlphaThreshold;

// Smooth interpolation through 5 colors based on t (0-1)
vec3 getGradientColor(float t) {
    t = clamp(t, 0.0, 1.0);
    
    if (t < 0.25) {
        return mix(uColor0, uColor1, t * 4.0);
    } else if (t < 0.5) {
        return mix(uColor1, uColor2, (t - 0.25) * 4.0);
    } else if (t < 0.75) {
        return mix(uColor2, uColor3, (t - 0.5) * 4.0);
    } else {
        return mix(uColor3, uColor4, (t - 0.75) * 4.0);
    }
}

void main() {
    vec3 density = texture(uTexture, vUv).rgb;
    
    // Calculate intensity (how "hot" this area is)
    float intensity = max(density.r, max(density.g, density.b));
    
    // Map intensity to gradient color
    vec3 color = getGradientColor(intensity);
    
    // Alpha based on intensity with threshold for crisp edges
    float alpha = intensity > uAlphaThreshold ? clamp(intensity * 1.5, 0.0, 1.0) : 0.0;
    
    fragColor = vec4(color, alpha);
}
`;

// ============================================================================
// Display with Shading - Render with lighting effect
// ============================================================================

export const DISPLAY_SHADING_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;

void main() {
    vec3 L = texture(uTexture, vUv - vec2(uTexelSize.x, 0.0)).rgb;
    vec3 R = texture(uTexture, vUv + vec2(uTexelSize.x, 0.0)).rgb;
    vec3 T = texture(uTexture, vUv + vec2(0.0, uTexelSize.y)).rgb;
    vec3 B = texture(uTexture, vUv - vec2(0.0, uTexelSize.y)).rgb;
    vec3 C = texture(uTexture, vUv).rgb;
    
    float dx = length(R) - length(L);
    float dy = length(T) - length(B);
    
    vec3 normal = normalize(vec3(-dx, -dy, 0.3));
    vec3 lightDir = normalize(vec3(0.4, 0.4, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    vec3 color = C * (0.7 + 0.3 * diffuse);
    fragColor = vec4(color, 1.0);
}
`;

// ============================================================================
// Bloom Threshold - Extract bright areas
// ============================================================================

export const BLOOM_THRESHOLD_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uSoftness;

void main() {
    vec3 color = texture(uTexture, vUv).rgb;
    float brightness = max(color.r, max(color.g, color.b));
    float contribution = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness, brightness);
    fragColor = vec4(color * contribution, 1.0);
}
`;

// ============================================================================
// Blur Shader - Gaussian blur for bloom
// ============================================================================

export const BLUR_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uTexelSize;

void main() {
    vec4 color = vec4(0.0);
    color += texture(uTexture, vUv - 4.0 * uDirection * uTexelSize) * 0.0162162162;
    color += texture(uTexture, vUv - 3.0 * uDirection * uTexelSize) * 0.0540540541;
    color += texture(uTexture, vUv - 2.0 * uDirection * uTexelSize) * 0.1216216216;
    color += texture(uTexture, vUv - 1.0 * uDirection * uTexelSize) * 0.1945945946;
    color += texture(uTexture, vUv) * 0.2270270270;
    color += texture(uTexture, vUv + 1.0 * uDirection * uTexelSize) * 0.1945945946;
    color += texture(uTexture, vUv + 2.0 * uDirection * uTexelSize) * 0.1216216216;
    color += texture(uTexture, vUv + 3.0 * uDirection * uTexelSize) * 0.0540540541;
    color += texture(uTexture, vUv + 4.0 * uDirection * uTexelSize) * 0.0162162162;
    fragColor = color;
}
`;

// ============================================================================
// Combine Shader - Blend bloom with original
// ============================================================================

export const COMBINE_SHADER = `${PRECISION}
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform float uIntensity;

void main() {
    vec3 color = texture(uTexture, vUv).rgb;
    vec3 bloom = texture(uBloom, vUv).rgb;
    fragColor = vec4(color + bloom * uIntensity, 1.0);
}
`;

// ============================================================================
// Shader Program Collection
// ============================================================================

export interface FluidShaders {
    clear: { vertex: string; fragment: string };
    splat: { vertex: string; fragment: string };
    advection: { vertex: string; fragment: string };
    advectionManual: { vertex: string; fragment: string };
    curl: { vertex: string; fragment: string };
    vorticity: { vertex: string; fragment: string };
    divergence: { vertex: string; fragment: string };
    pressure: { vertex: string; fragment: string };
    gradientSubtract: { vertex: string; fragment: string };
    display: { vertex: string; fragment: string };
    displayColorRamp: { vertex: string; fragment: string };
    displayShading: { vertex: string; fragment: string };
    bloomThreshold: { vertex: string; fragment: string };
    blur: { vertex: string; fragment: string };
    combine: { vertex: string; fragment: string };
}

export const FLUID_SHADERS: FluidShaders = {
    clear: { vertex: VERTEX_SHADER, fragment: CLEAR_SHADER },
    splat: { vertex: VERTEX_SHADER, fragment: SPLAT_SHADER },
    advection: { vertex: VERTEX_SHADER, fragment: ADVECTION_SHADER },
    advectionManual: { vertex: VERTEX_SHADER, fragment: ADVECTION_MANUAL_SHADER },
    curl: { vertex: VERTEX_SHADER, fragment: CURL_SHADER },
    vorticity: { vertex: VERTEX_SHADER, fragment: VORTICITY_SHADER },
    divergence: { vertex: VERTEX_SHADER, fragment: DIVERGENCE_SHADER },
    pressure: { vertex: VERTEX_SHADER, fragment: PRESSURE_SHADER },
    gradientSubtract: { vertex: VERTEX_SHADER, fragment: GRADIENT_SUBTRACT_SHADER },
    display: { vertex: VERTEX_SHADER, fragment: DISPLAY_SHADER },
    displayColorRamp: { vertex: VERTEX_SHADER, fragment: DISPLAY_COLORRAMP_SHADER },
    displayShading: { vertex: VERTEX_SHADER, fragment: DISPLAY_SHADING_SHADER },
    bloomThreshold: { vertex: VERTEX_SHADER, fragment: BLOOM_THRESHOLD_SHADER },
    blur: { vertex: VERTEX_SHADER, fragment: BLUR_SHADER },
    combine: { vertex: VERTEX_SHADER, fragment: COMBINE_SHADER },
};

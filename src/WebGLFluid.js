const vertex = `#version 300 es
precision highp float;
out vec2 vUv;
void main () {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = (source) => `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
${source}`;

const shaders = {
  splat: fragment(`
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec2 point;
    uniform vec3 color;
    uniform float radius;
    void main () {
      vec2 p = vUv - point;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      fragColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
    }
  `),
  copy: fragment(`
    uniform sampler2D uTexture;
    uniform float value;
    void main () { fragColor = value * texture(uTexture, vUv); }
  `),
  curl: fragment(`
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
      float L = texture(uVelocity, vUv - vec2(texelSize.x, 0)).y;
      float R = texture(uVelocity, vUv + vec2(texelSize.x, 0)).y;
      float T = texture(uVelocity, vUv + vec2(0, texelSize.y)).x;
      float B = texture(uVelocity, vUv - vec2(0, texelSize.y)).x;
      fragColor = vec4(0.5 * (R - L - T + B), 0, 0, 1);
    }
  `),
  vorticity: fragment(`
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform sampler2D uDye;
    uniform vec2 texelSize;
    uniform float dt;
    uniform float curlStrength;
    void main () {
      float L = texture(uCurl, vUv - vec2(texelSize.x, 0)).x;
      float R = texture(uCurl, vUv + vec2(texelSize.x, 0)).x;
      float T = texture(uCurl, vUv + vec2(0, texelSize.y)).x;
      float B = texture(uCurl, vUv - vec2(0, texelSize.y)).x;
      float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curlStrength * C;
      force.y *= -1.0;
      vec2 velocity = texture(uVelocity, vUv).xy;
      velocity += force * dt;
      fragColor = vec4(clamp(velocity, vec2(-800), vec2(800)), 0, 1);
    }
  `),
  viscosity: fragment(`
    uniform sampler2D uOriginal;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    uniform float alpha;
    void main () {
      vec2 neighbors = texture(uVelocity, vUv-vec2(texelSize.x,0)).xy
        + texture(uVelocity, vUv+vec2(texelSize.x,0)).xy
        + texture(uVelocity, vUv-vec2(0,texelSize.y)).xy
        + texture(uVelocity, vUv+vec2(0,texelSize.y)).xy;
      vec2 original = texture(uOriginal, vUv).xy;
      fragColor = vec4((original+alpha*neighbors)/(1.0+4.0*alpha),0,1);
    }
  `),
  divergence: fragment(`
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
      vec2 C = texture(uVelocity, vUv).xy;
      float L = texture(uVelocity, vUv - vec2(texelSize.x, 0)).x;
      float R = texture(uVelocity, vUv + vec2(texelSize.x, 0)).x;
      float T = texture(uVelocity, vUv + vec2(0, texelSize.y)).y;
      float B = texture(uVelocity, vUv - vec2(0, texelSize.y)).y;
      if (vUv.x - texelSize.x < 0.0) L = -C.x;
      if (vUv.x + texelSize.x > 1.0) R = -C.x;
      if (vUv.y + texelSize.y > 1.0) T = -C.y;
      if (vUv.y - texelSize.y < 0.0) B = -C.y;
      fragColor = vec4(0.5 * (R - L + T - B), 0, 0, 1);
    }
  `),
  pressure: fragment(`
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 texelSize;
    void main () {
      float L = texture(uPressure, vUv - vec2(texelSize.x, 0)).x;
      float R = texture(uPressure, vUv + vec2(texelSize.x, 0)).x;
      float T = texture(uPressure, vUv + vec2(0, texelSize.y)).x;
      float B = texture(uPressure, vUv - vec2(0, texelSize.y)).x;
      float div = texture(uDivergence, vUv).x;
      fragColor = vec4((L + R + B + T - div) * 0.25, 0, 0, 1);
    }
  `),
  gradient: fragment(`
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
      float L = texture(uPressure, vUv - vec2(texelSize.x, 0)).x;
      float R = texture(uPressure, vUv + vec2(texelSize.x, 0)).x;
      float T = texture(uPressure, vUv + vec2(0, texelSize.y)).x;
      float B = texture(uPressure, vUv - vec2(0, texelSize.y)).x;
      vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
      fragColor = vec4(velocity, 0, 1);
    }
  `),
  advection: fragment(`
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 sourceTexelSize;
    uniform float dt;
    uniform float dissipation;
    uniform float diffusion;
    void main () {
      vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
      vec4 result = texture(uSource, coord);
      vec4 neighbors = texture(uSource, coord + vec2(sourceTexelSize.x, 0))
        + texture(uSource, coord - vec2(sourceTexelSize.x, 0))
        + texture(uSource, coord + vec2(0, sourceTexelSize.y))
        + texture(uSource, coord - vec2(0, sourceTexelSize.y));
      result = mix(result, neighbors * 0.25, diffusion);
      fragColor = result / (1.0 + dissipation * dt);
    }
  `),
  display: fragment(`
    uniform sampler2D uDye;
    uniform vec2 texelSize;
    void main () {
      vec2 blur = texelSize * 0.8;
      vec3 color = texture(uDye, vUv).rgb * 0.4;
      color += texture(uDye, vUv - vec2(blur.x, 0)).rgb * 0.15;
      color += texture(uDye, vUv + vec2(blur.x, 0)).rgb * 0.15;
      color += texture(uDye, vUv - vec2(0, blur.y)).rgb * 0.15;
      color += texture(uDye, vUv + vec2(0, blur.y)).rgb * 0.15;
      color = max(color, vec3(0));
      float density = max(color.r, max(color.g, color.b));
      vec3 pigment = pow(color / max(density, 0.00001), vec3(1.1));
      float alpha = smoothstep(0.018, 0.38, density) * 0.96;
      float L = length(texture(uDye,vUv-vec2(texelSize.x,0)).rgb);
      float R = length(texture(uDye,vUv+vec2(texelSize.x,0)).rgb);
      float T = length(texture(uDye,vUv+vec2(0,texelSize.y)).rgb);
      float B = length(texture(uDye,vUv-vec2(0,texelSize.y)).rgb);
      vec3 normal = normalize(vec3((R-L)*2.0,(T-B)*2.0,0.3));
      float gloss = pow(max(dot(normal,normalize(vec3(-0.5,0.6,1))),0.0),24.0)*0.12;
      fragColor = vec4(mix(pigment,vec3(1),gloss) * alpha, alpha);
    }
  `),
};

// A velocity field carries the color field; pressure projection and vorticity
// turn each brush stroke into drifting, curling smoke instead of expanding rings.
export default class WebGLFluid {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    const gl = this.gl;
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Floating-point WebGL is unavailable');
    this.programs = {};
    this.targets = [];
    try {
      Object.entries(shaders).forEach(([name, source]) => {
        this.programs[name] = this.createProgram(source);
      });
    } catch (error) {
      this.destroy();
      throw error;
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  createProgram(source) {
    const gl = this.gl;
    const compile = (type, text) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, source);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    for (let index = 0; index < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); index++) {
      const uniform = gl.getActiveUniform(program, index);
      uniforms[uniform.name] = { location: gl.getUniformLocation(program, uniform.name), type: uniform.type };
    }
    return { program, uniforms };
  }

  createTarget(width, height, linear = true) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float framebuffer is unavailable');
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const target = { texture, framebuffer, width, height };
    this.targets.push(target);
    return target;
  }

  doubleTarget(width, height, linear = true) {
    return {
      read: this.createTarget(width, height, linear),
      write: this.createTarget(width, height, linear),
      swap() { [this.read, this.write] = [this.write, this.read]; },
    };
  }

  resolution(size, width, height) {
    const aspect = width / height;
    return aspect >= 1 ? [Math.round(size * aspect), size] : [size, Math.round(size / aspect)];
  }

  resize(width, height, dpr) {
    const previousTargets = this.targets;
    const previousDye = this.dye;
    this.targets = [];
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.aspect = width / height;
    const mobile = width < 760;
    const [sw, sh] = this.resolution(mobile ? 100 : 150, width, height);
    const [dw, dh] = this.resolution(mobile ? 320 : 520, width, height);
    this.texelSize = [1 / sw, 1 / sh];
    this.dyeTexelSize = [1 / dw, 1 / dh];
    this.velocity = this.doubleTarget(sw, sh);
    this.viscositySource = this.createTarget(sw, sh);
    this.dye = this.doubleTarget(dw, dh);
    this.pressure = this.doubleTarget(sw, sh, false);
    this.curl = this.createTarget(sw, sh, false);
    this.divergence = this.createTarget(sw, sh, false);
    if (previousDye) this.pass('copy', this.dye.read, { uTexture: previousDye.read, value: 1 });
    previousTargets.forEach((target) => this.deleteTarget(target));
    this.pressureIterations = mobile ? 12 : 16;
  }

  pass(name, target, values) {
    const gl = this.gl;
    const { program, uniforms } = this.programs[name];
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height);
    let textureUnit = 0;
    Object.entries(values).forEach(([key, value]) => {
      const uniform = uniforms[key];
      if (!uniform) return;
      if (value?.texture) {
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, value.texture);
        gl.uniform1i(uniform.location, textureUnit++);
      } else if (Array.isArray(value) || value instanceof Float32Array) {
        if (value.length === 2) gl.uniform2fv(uniform.location, value);
        else gl.uniform3fv(uniform.location, value);
      } else gl.uniform1f(uniform.location, value);
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  splat(x, y, dx, dy, color, size = 60, boost = 1) {
    const radius = (0.00012 + Math.pow(size / 100, 2) * 0.0008) * boost;
    const values = { aspectRatio: this.aspect, point: [x, y], radius };
    this.pass('splat', this.velocity.write, { ...values, uTarget: this.velocity.read, color: [dx, dy, 0] });
    this.velocity.swap();
    this.pass('splat', this.dye.write, { ...values, uTarget: this.dye.read, color });
    this.dye.swap();
  }

  step(dt, viscosity = 0.82) {
    const texelSize = this.texelSize;
    this.pass('curl', this.curl, { texelSize, uVelocity: this.velocity.read });
    this.pass('vorticity', this.velocity.write, { texelSize, uVelocity: this.velocity.read, uCurl: this.curl, dt, curlStrength: 2 + (1-viscosity)*6 });
    this.velocity.swap();
    this.pass('copy', this.viscositySource, { uTexture: this.velocity.read, value: 1 });
    // An implicit viscosity solve smooths momentum without blurring the pigment.
    for (let index = 0; index < 6; index++) {
      this.pass('viscosity', this.velocity.write, { texelSize, uOriginal: this.viscositySource, uVelocity: this.velocity.read, alpha: viscosity*dt*110 });
      this.velocity.swap();
    }
    this.pass('divergence', this.divergence, { texelSize, uVelocity: this.velocity.read });
    this.pass('copy', this.pressure.write, { uTexture: this.pressure.read, value: 0.75 });
    this.pressure.swap();
    for (let index = 0; index < this.pressureIterations; index++) {
      this.pass('pressure', this.pressure.write, { texelSize, uPressure: this.pressure.read, uDivergence: this.divergence });
      this.pressure.swap();
    }
    this.pass('gradient', this.velocity.write, { texelSize, uPressure: this.pressure.read, uVelocity: this.velocity.read });
    this.velocity.swap();
    this.pass('advection', this.velocity.write, { texelSize, sourceTexelSize: texelSize, uVelocity: this.velocity.read, uSource: this.velocity.read, dt, dissipation: 2 + viscosity*6, diffusion: 0 });
    this.velocity.swap();
    this.pass('advection', this.dye.write, { texelSize, sourceTexelSize: this.dyeTexelSize, uVelocity: this.velocity.read, uSource: this.dye.read, dt, dissipation: 0.45 + viscosity*0.35, diffusion: 0.015 });
    this.dye.swap();
  }

  display() {
    this.pass('display', null, { uDye: this.dye.read, texelSize: this.dyeTexelSize });
    return this.canvas;
  }

  clear() {
    const gl = this.gl;
    this.targets.forEach((target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
  }

  deleteTarget(target) {
    this.gl.deleteTexture(target.texture);
    this.gl.deleteFramebuffer(target.framebuffer);
  }

  destroy() {
    this.targets.forEach((target) => this.deleteTarget(target));
    Object.values(this.programs).forEach(({ program }) => this.gl.deleteProgram(program));
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

import * as T from "three";
export function waterMaterial() {
  const uniforms = {
    monsoonTime: { value: 0 },
    rippleStrength: { value: 0 },
    softenEdges: { value: 1 },
  };
  const material = new T.MeshStandardMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.76,
    roughness: 0.38,
    metalness: 0.06,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      "attribute vec4 dryEdges; varying vec4 vDryEdges; varying vec2 vWaterUV; varying vec3 vWaterWorld;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvDryEdges = dryEdges; vWaterUV = uv; vWaterWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;",
    );
    shader.fragmentShader =
      "uniform float monsoonTime; uniform float rippleStrength; uniform float softenEdges; varying vec4 vDryEdges; varying vec2 vWaterUV; varying vec3 vWaterWorld;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      float wx = sin(vWaterWorld.x * .32 + vWaterWorld.z * .15 + monsoonTime * 1.8);
      float wz = cos(vWaterWorld.z * .27 - vWaterWorld.x * .09 + monsoonTime * 1.3);
      normal = normalize(normal + mat3(viewMatrix) * vec3(wx * .022, 0.0, wz * .018) * rippleStrength);
      float shore = 1.0;
      shore *= mix(1.0, smoothstep(0.0,.07,vWaterUV.x), vDryEdges.x);
      shore *= mix(1.0, smoothstep(0.0,.07,1.0-vWaterUV.x), vDryEdges.y);
      shore *= mix(1.0, smoothstep(0.0,.07,1.0-vWaterUV.y), vDryEdges.z);
      shore *= mix(1.0, smoothstep(0.0,.07,vWaterUV.y), vDryEdges.w);
      diffuseColor.a *= mix(1.0, shore, softenEdges);
    `,
    );
  };
  material.customProgramCacheKey = () => "monsoon-water-r6";
  return { material, uniforms };
}

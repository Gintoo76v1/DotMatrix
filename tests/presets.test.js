import { describe, it, expect } from 'vitest';
import { presetToYaml, yamlToPreset } from '../js/preset-yaml.js';
import { SYSTEM_PRESETS } from '../js/config.js';

function normalised(p) {
  // Drop fields that the YAML serialiser explicitly skips
  const { id, system, ...rest } = p;
  return rest;
}

describe('preset YAML — roundtrip', () => {
  for (const preset of SYSTEM_PRESETS) {
    it(`roundtrips system preset "${preset.id}"`, () => {
      const yaml = presetToYaml(preset);
      const back = yamlToPreset(yaml);
      expect(back).toEqual(normalised(preset));
    });
  }

  it('roundtrips empty wearLayers', () => {
    const p = { name: 'Empty', profile: 'oki_microline', wearLayers: [] };
    expect(yamlToPreset(presetToYaml(p))).toEqual(p);
  });

  it('roundtrips null paper', () => {
    const p = { name: 'X', paper: null, ink: [10, 20, 30] };
    expect(yamlToPreset(presetToYaml(p))).toEqual(p);
  });

  it('roundtrips negative numbers', () => {
    const p = { name: 'Neg', brightness: -50, contrast: -10 };
    expect(yamlToPreset(presetToYaml(p))).toEqual(p);
  });

  it('roundtrips floating-point numbers', () => {
    const p = { name: 'F', gamma: 1.45, jitterScale: 2.7 };
    expect(yamlToPreset(presetToYaml(p))).toEqual(p);
  });
});

describe('preset YAML — edge cases', () => {
  it('quotes strings that look like numbers', () => {
    const p = { name: '123' };
    const yaml = presetToYaml(p);
    expect(yaml).toContain('"123"');
    expect(yamlToPreset(yaml)).toEqual(p);
  });

  it('quotes strings containing colons', () => {
    const p = { name: 'a: b' };
    const yaml = presetToYaml(p);
    const back = yamlToPreset(yaml);
    expect(back.name).toBe('a: b');
  });

  it('quotes strings that look like keywords', () => {
    const p = { mode: 'yes' };
    const yaml = presetToYaml(p);
    expect(yamlToPreset(yaml)).toEqual(p);
  });

  it('rejects partial-numeric strings as numbers (treats as string)', () => {
    // raw YAML: name: 3D Print  → should remain a string
    const yaml = 'name: "3D Print"';
    expect(yamlToPreset(yaml).name).toBe('3D Print');
  });

  it('strips comments', () => {
    const yaml = `
# top comment
name: Test  # inline comment
profile: oki_microline
`;
    const back = yamlToPreset(yaml);
    expect(back.name).toBe('Test');
    expect(back.profile).toBe('oki_microline');
  });

  it('handles empty array notation', () => {
    expect(yamlToPreset('wearLayers: []').wearLayers).toEqual([]);
  });

  it('handles inline numeric arrays', () => {
    expect(yamlToPreset('ink: [25, 25, 30]').ink).toEqual([25, 25, 30]);
  });
});

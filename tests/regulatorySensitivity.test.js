import { describe, it, expect } from 'vitest';
import { computeRegulatorySensitivity } from '../src/scoring.js';

describe('computeRegulatorySensitivity — buffer thresholds', () => {
  it('flags parcel acreage in 1.5–2.0 ac buffer band', () => {
    const r = { site: { parcel: { acreage_estimate: 1.7 } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Parcel acreage')).toBeTruthy();
  });

  it('does not flag parcel acreage at or above 2.0 ac', () => {
    const r = { site: { parcel: { acreage_estimate: 2.5 } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Parcel acreage')).toBeFalsy();
  });

  it('does not flag parcel acreage already failing (<1.5)', () => {
    const r = { site: { parcel: { acreage_estimate: 1.0 } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Parcel acreage')).toBeFalsy();
  });

  it('flags Zone X 500-year flood as sensitive', () => {
    const r = { site: { soil: { flood_zone: 'Zone X (500-year)' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Flood zone')).toBeTruthy();
  });

  it('does not flag Zone X minimal flood', () => {
    const r = { site: { soil: { flood_zone: 'Zone X (minimal)' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Flood zone')).toBeFalsy();
  });

  it('does not flag Zone AE (already failing)', () => {
    const r = { site: { soil: { flood_zone: 'Zone AE' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Flood zone')).toBeFalsy();
  });

  it('flags Class C airspace as sensitive', () => {
    const r = { site: { airspace: { status: 'Class C (outer ring)' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Airspace')).toBeTruthy();
  });

  it('flags Class B outer floor as sensitive', () => {
    const r = { site: { airspace: { status: 'Class B (floor 5,000ft MSL)' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Airspace')).toBeTruthy();
  });

  it('does not flag Class G airspace', () => {
    const r = { site: { airspace: { status: 'Class G (uncontrolled)' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Airspace')).toBeFalsy();
  });

  it('flags marginal zoning compliance', () => {
    const r = { site: { zoning: { compliance: 'Marginal' } } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Zoning')).toBeTruthy();
  });

  it('flags borderline EIA power score 40–50', () => {
    const r = { eia: { score: 45 } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Power grid')).toBeTruthy();
  });

  it('does not flag healthy power score >=50', () => {
    const r = { eia: { score: 70 } };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.find(f => f.check === 'Power grid')).toBeFalsy();
  });

  it('returns empty array for clean site', () => {
    const r = {
      site: {
        parcel: { acreage_estimate: 5.0 },
        airspace: { status: 'Class G (uncontrolled)' },
        zoning: { compliance: 'Good' },
        soil: { flood_zone: 'Zone X (minimal)' },
      },
      eia: { score: 80 },
    };
    expect(computeRegulatorySensitivity(r)).toEqual([]);
  });

  it('stacks multiple flags for a borderline site', () => {
    const r = {
      site: {
        parcel: { acreage_estimate: 1.7 },
        airspace: { status: 'Class C (outer ring)' },
        zoning: { compliance: 'Marginal' },
      },
      fema: { flood_zone: 'Zone X (0.2% annual chance)' },
      eia: { score: 45 },
    };
    const flags = computeRegulatorySensitivity(r);
    expect(flags.length).toBe(5);
  });
});

import React from 'react';
import {
  Document, Page, View, Text, Image, Svg, Path, pdf
} from '@react-pdf/renderer';
import { buildInvestmentSummary } from './investmentViability.js';
import { buildRegulatoryChecklist, CATEGORIES } from './regulatoryChecklist.js';
import {
  DEMAND_CRITERIA, priorityIndex, getQuadrant, getSiteDesc, getDemandDesc
} from './scoring.js';

// ── Design tokens ────────────────────────────────────────────────────────────
const P = {
  bg:        '#F9F9F9',
  card:      '#EAF4FC',
  surface:   '#FFFFFF',
  coverDark: '#0a1628',
  teal:      '#a3d1c6',
  teal2:     '#7db0b5',
  blue:      '#5B9BD5',
  text:      '#222222',
  dim:       '#5a6a7a',
  faint:     '#aab4be',
  border:    '#d4dfe8',
  green:     '#1a8a58',
  amber:     '#c87a10',
  red:       '#C0392B',
  white:     '#FFFFFF',
};

const scoreCol = s =>
  (!s && s !== 0) ? P.faint : s >= 75 ? P.green : s >= 45 ? P.amber : P.red;

const fmtM = v => {
  if (!v && v !== 0) return 'N/A';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

// ── Gauge SVG arc helpers ─────────────────────────────────────────────────────
function arcD(cx, cy, r, startDeg, sweepDeg) {
  if (sweepDeg < 0.5) return `M ${cx} ${cy}`;
  const rad = d => (d * Math.PI) / 180;
  const endDeg = startDeg + sweepDeg;
  const x1 = +(cx + r * Math.cos(rad(startDeg))).toFixed(2);
  const y1 = +(cy + r * Math.sin(rad(startDeg))).toFixed(2);
  const x2 = +(cx + r * Math.cos(rad(endDeg))).toFixed(2);
  const y2 = +(cy + r * Math.sin(rad(endDeg))).toFixed(2);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// ── Gauge dial ───────────────────────────────────────────────────────────────
function Gauge({ score, w = 82, dark = false }) {
  const cx = 50, cy = 46, r = 32, sw = 8;
  const col = scoreCol(score);
  const track = dark ? '#1a2d44' : '#dce8f0';
  const sweep = 270 * Math.max(0, Math.min(100, score || 0)) / 100;
  return (
    <Svg width={w} height={Math.round(w * 0.70)} viewBox="0 0 100 76">
      <Path d={arcD(cx, cy, r, 135, 270)} stroke={track} strokeWidth={sw} fill="none" strokeLinecap="round" />
      {sweep > 0.5 && (
        <Path d={arcD(cx, cy, r, 135, sweep)} stroke={col} strokeWidth={sw} fill="none" strokeLinecap="round" />
      )}
      <Text x="50" y="50" textAnchor="middle" fontSize={22} fontWeight="bold" fill={dark ? P.white : col}>
        {score ?? '—'}
      </Text>
      <Text x="50" y="62" textAnchor="middle" fontSize={8} fill={dark ? '#4a6a8a' : P.faint}>
        /100
      </Text>
    </Svg>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────
function Bar({ score, w = 88, h = 5 }) {
  const col = scoreCol(score);
  const fill = Math.round(w * Math.max(0, Math.min(100, score || 0)) / 100);
  return (
    <View style={{ width: w, height: h, backgroundColor: '#dce8f2', borderRadius: 3 }}>
      {fill > 0 && <View style={{ width: fill, height: h, backgroundColor: col, borderRadius: 3 }} />}
    </View>
  );
}

// ── Interior page header (repeats on overflow pages) ─────────────────────────
function PageHeader({ address, logoDataUrl }) {
  return (
    <View fixed style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 36, paddingTop: 16, paddingBottom: 10,
      borderBottomWidth: 1.5, borderBottomColor: P.teal, marginBottom: 4,
    }}>
      {logoDataUrl && <Image src={logoDataUrl} style={{ width: 18, height: 18, marginRight: 8 }} />}
      <Text style={{ flex: 1, fontSize: 7, color: P.teal2, letterSpacing: 0.8, fontWeight: 'bold' }}>
        VERTIPORT EVALUATION SYSTEM
      </Text>
      <Text style={{ fontSize: 6.5, color: P.faint }}>
        {(address || 'Site Analysis').slice(0, 55)}
      </Text>
    </View>
  );
}

// ── Page footer ──────────────────────────────────────────────────────────────
function PageFooter() {
  return (
    <View fixed style={{
      position: 'absolute', bottom: 16, left: 36, right: 36,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <Text style={{ fontSize: 6.5, color: P.faint, letterSpacing: 0.5 }}>LOWALTITUDEECONOMY.AERO</Text>
      <Text
        style={{ fontSize: 6.5, color: P.faint }}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// ── Section heading with teal left rule ──────────────────────────────────────
function SectionHead({ title, mt = 14 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: mt, marginBottom: 8 }}>
      <View style={{ width: 3, height: 13, backgroundColor: P.teal, marginRight: 8, borderRadius: 1.5 }} />
      <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: P.text, letterSpacing: 1.2 }}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Criteria row ─────────────────────────────────────────────────────────────
function CriteriaRow({ label, score, detail, notes, last }) {
  const col = scoreCol(score);
  return (
    <View style={{
      paddingVertical: 8,
      borderBottomWidth: last ? 0 : 0.5,
      borderBottomColor: P.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
        <Text style={{ flex: 1, fontSize: 8.5, color: P.text, fontWeight: 'bold' }}>{label}</Text>
        <Bar score={score} w={88} />
        <Text style={{ width: 30, textAlign: 'right', fontSize: 9.5, fontWeight: 'bold', color: col, marginLeft: 8 }}>
          {score ?? '—'}
        </Text>
      </View>
      {detail ? (
        <Text style={{ fontSize: 7, color: P.dim, marginBottom: notes ? 2 : 0 }}>{detail}</Text>
      ) : null}
      {notes ? (
        <Text style={{ fontSize: 7, color: P.dim, lineHeight: 1.45 }}>{notes}</Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1: COVER
// ─────────────────────────────────────────────────────────────────────────────
function CoverPage({ results, mapDataUrl, logoDataUrl }) {
  const site   = results.site?.composite   || 0;
  const demand = results.demand?.composite || 0;
  const pi     = priorityIndex(site, demand);
  const q      = getQuadrant(site, demand);
  const em     = results.evalMode || 'passenger';
  const modeLabel = { passenger: 'PASSENGER', cargo: 'CARGO', combo: 'CARGO + PAX' }[em] || em.toUpperCase();
  const modeCol   = { passenger: P.blue, cargo: '#4a9a8e', combo: '#7b7bd5' }[em] || P.blue;
  const addr  = results.geocode?.matched || 'Site Analysis';
  const lat   = results.geocode?.lat;
  const lon   = results.geocode?.lon;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Page size="A4" style={{ backgroundColor: P.coverDark, position: 'relative' }}>

      {/* Satellite background at low opacity */}
      {mapDataUrl && (
        <Image
          src={mapDataUrl}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: 595, height: 842,
            objectFit: 'cover',
            opacity: 0.38,
          }}
        />
      )}

      {/* Dark top gradient band */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, backgroundColor: '#050c18', opacity: 0.88 }} />
      {/* Dark bottom gradient band */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, backgroundColor: '#050c18', opacity: 0.92 }} />

      {/* Main content */}
      <View style={{ flex: 1, paddingHorizontal: 44, paddingTop: 36, paddingBottom: 32 }}>

        {/* Top branding row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
          {logoDataUrl && (
            <Image src={logoDataUrl} style={{ width: 28, height: 28, marginRight: 12 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, color: P.teal, letterSpacing: 2.5, fontWeight: 'bold' }}>
              LOWALTITUDEECONOMY.AERO
            </Text>
            <Text style={{ fontSize: 6, color: '#3a5a7a', letterSpacing: 1.5, marginTop: 3 }}>
              VERTIPORT SITE EVALUATION SYSTEM
            </Text>
          </View>
          <View style={{
            backgroundColor: modeCol, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 3,
          }}>
            <Text style={{ fontSize: 6.5, color: P.white, fontWeight: 'bold', letterSpacing: 1 }}>
              {modeLabel}
            </Text>
          </View>
        </View>

        {/* Teal hairline */}
        <View style={{ height: 1.5, backgroundColor: P.teal, opacity: 0.55, marginBottom: 26 }} />

        {/* Site name */}
        <Text style={{ fontSize: 22, color: P.white, fontWeight: 'bold', lineHeight: 1.3, marginBottom: 8 }}>
          {addr}
        </Text>
        {lat != null && lon != null && (
          <Text style={{ fontSize: 9.5, color: P.teal, letterSpacing: 0.8, marginBottom: 4 }}>
            {lat.toFixed(5)}°N  ·  {Math.abs(lon).toFixed(5)}°W
          </Text>
        )}

        {/* Score panels row */}
        <View style={{ flexDirection: 'row', marginTop: 36, marginBottom: 36 }}>

          {/* Site Score */}
          <View style={{
            flex: 1, alignItems: 'center',
            borderTopWidth: 2.5, borderTopColor: scoreCol(site),
            paddingTop: 14, paddingBottom: 16, marginRight: 12,
            backgroundColor: '#0d1e33',
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 6, color: P.teal, letterSpacing: 2, fontWeight: 'bold', marginBottom: 10 }}>
              SITE SCORE
            </Text>
            <Gauge score={site} w={86} dark />
            <Text style={{ fontSize: 6.5, color: P.faint, marginTop: 8, letterSpacing: 0.5 }}>
              Infrastructure
            </Text>
          </View>

          {/* Priority Index */}
          <View style={{
            flex: 1, alignItems: 'center',
            borderTopWidth: 2.5, borderTopColor: scoreCol(pi),
            paddingTop: 14, paddingBottom: 16, marginRight: 12,
            backgroundColor: '#0d1e33',
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 6, color: P.teal, letterSpacing: 2, fontWeight: 'bold', marginBottom: 10 }}>
              PRIORITY INDEX
            </Text>
            <Gauge score={pi} w={86} dark />
            <Text style={{ fontSize: 6.5, color: P.faint, marginTop: 8, letterSpacing: 0.5 }}>
              Site × 0.60 + Demand × 0.40
            </Text>
          </View>

          {/* Demand Score */}
          <View style={{
            flex: 1, alignItems: 'center',
            borderTopWidth: 2.5, borderTopColor: scoreCol(demand),
            paddingTop: 14, paddingBottom: 16,
            backgroundColor: '#0d1e33',
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 6, color: P.teal, letterSpacing: 2, fontWeight: 'bold', marginBottom: 10 }}>
              DEMAND SCORE
            </Text>
            <Gauge score={demand} w={86} dark />
            <Text style={{ fontSize: 6.5, color: P.faint, marginTop: 8, letterSpacing: 0.5 }}>
              Market Demand
            </Text>
          </View>
        </View>

        {/* Quadrant + bottom strip */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ height: 1.5, backgroundColor: P.teal, opacity: 0.35, marginBottom: 18 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>

            <View>
              <Text style={{ fontSize: 6.5, color: '#3a5a7a', letterSpacing: 1.5, marginBottom: 6 }}>
                SITE CLASSIFICATION
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 9, height: 9, borderRadius: 4.5,
                  backgroundColor: q.color, marginRight: 10,
                }} />
                <Text style={{ fontSize: 20, color: P.white, fontWeight: 'bold', letterSpacing: 1.5 }}>
                  {q.label}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7, color: '#3a5a7a', marginBottom: 3 }}>{dateStr}</Text>
              <Text style={{ fontSize: 6.5, color: '#2a4060', letterSpacing: 0.5 }}>
                FAA/NREL CALIBRATED  ·  VES
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2: SITE SCORE
// ─────────────────────────────────────────────────────────────────────────────
function SiteScorePage({ results, logoDataUrl }) {
  const site  = results.site  || {};
  const score = site.composite || 0;
  const addr  = results.geocode?.matched || 'Site';
  const heli  = results.heliport;
  const flags = results.flags || [];

  const criteria = [
    {
      label: 'Parcel Size & Contours',
      score: site.parcel?.score,
      detail: [site.parcel?.acreage_estimate ? `~${site.parcel.acreage_estimate} ac` : '', site.parcel?.land_type].filter(Boolean).join('  ·  '),
      notes: site.parcel?.notes,
    },
    {
      label: 'FAA Airspace Classification',
      score: site.airspace?.score,
      detail: [site.airspace?.status, site.airspace?.nearest_airport].filter(Boolean).join('  ·  '),
      notes: site.airspace?.notes,
    },
    {
      label: 'Power Grid & DER',
      score: site.power?.score,
      detail: '',
      notes: site.power?.notes,
    },
    {
      label: 'Zoning Compliance',
      score: site.zoning?.score,
      detail: [site.zoning?.compliance, site.zoning?.land_use].filter(Boolean).join('  ·  '),
      notes: site.zoning?.notes,
    },
    {
      label: 'Soil Stability & Flood',
      score: site.soil?.score,
      detail: [site.soil?.flood_zone, site.soil?.slope_estimate].filter(Boolean).join('  ·  '),
      notes: site.soil?.notes,
    },
    {
      label: 'Community DER Support',
      score: site.der?.score,
      detail: '',
      notes: site.der?.notes,
    },
  ];

  const strengths = results.top_strengths || [];
  const concerns  = (results.top_concerns || []).filter(Boolean);

  return (
    <Page size="A4" style={{ backgroundColor: P.bg, paddingBottom: 44 }}>
      <PageHeader address={addr} logoDataUrl={logoDataUrl} />

      <View style={{ paddingHorizontal: 36 }}>

        {/* Score hero card */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: P.card, borderRadius: 6,
          padding: 18, marginBottom: 16, marginTop: 8,
        }}>
          <View style={{ alignItems: 'center', marginRight: 22 }}>
            <Gauge score={score} w={100} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6.5, color: P.teal2, letterSpacing: 2, fontWeight: 'bold', marginBottom: 5 }}>
              SITE INFRASTRUCTURE SCORE
            </Text>
            <Text style={{ fontSize: 11.5, color: P.text, fontWeight: 'bold', marginBottom: 7 }}>
              Infrastructure Viability
            </Text>
            <Text style={{ fontSize: 8, color: P.dim, lineHeight: 1.55 }}>
              {getSiteDesc(score)}
            </Text>
            {heli?.status && heli.status !== 'none' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.teal2, marginRight: 7 }} />
                <Text style={{ fontSize: 7.5, color: P.teal2 }}>
                  {heli.status.toUpperCase()} HELIPORT  ·  {Math.round(heli.distance_m)}m  ·  {heli.name || 'Nearby'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <SectionHead title="Site Criteria Breakdown" mt={4} />

        {criteria.map((cr, i) => (
          <CriteriaRow
            key={cr.label}
            label={cr.label}
            score={cr.score}
            detail={cr.detail}
            notes={cr.notes}
            last={i === criteria.length - 1}
          />
        ))}

        {/* Flags */}
        {flags.length > 0 && (
          <>
            <SectionHead title="Site Flags" />
            {flags.map((flag, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
                <Text style={{ fontSize: 7, color: P.amber, marginRight: 6, marginTop: 1 }}>▲</Text>
                <Text style={{ flex: 1, fontSize: 7.5, color: P.dim, lineHeight: 1.4 }}>{flag}</Text>
              </View>
            ))}
          </>
        )}

        {/* Strengths & Concerns */}
        {(strengths.length > 0 || concerns.length > 0) && (
          <>
            <SectionHead title="Key Findings" />
            <View style={{ flexDirection: 'row' }}>
              {strengths.length > 0 && (
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 6.5, color: P.green, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 }}>
                    STRENGTHS
                  </Text>
                  {strengths.slice(0, 5).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
                      <Text style={{ fontSize: 7.5, color: P.green, marginRight: 5 }}>+</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: P.dim, lineHeight: 1.4 }}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
              {concerns.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 6.5, color: P.amber, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 }}>
                    CONCERNS
                  </Text>
                  {concerns.slice(0, 5).map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
                      <Text style={{ fontSize: 7.5, color: P.amber, marginRight: 5 }}>▲</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: P.dim, lineHeight: 1.4 }}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>

      <PageFooter />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3: DEMAND SCORE
// ─────────────────────────────────────────────────────────────────────────────
function DemandScorePage({ results, logoDataUrl }) {
  const demand   = results.demand || {};
  const score    = demand.composite || 0;
  const em       = results.evalMode || 'passenger';
  const addr     = results.geocode?.matched || 'Site';
  const criteria = DEMAND_CRITERIA[em] || DEMAND_CRITERIA.passenger;
  const fly      = results.flyingDays;

  const demandHeader = {
    passenger: 'PASSENGER DEMAND SCORE',
    cargo:     'CARGO DEMAND SCORE',
    combo:     'COMBO DEMAND SCORE',
  }[em] || 'DEMAND SCORE';

  return (
    <Page size="A4" style={{ backgroundColor: P.bg, paddingBottom: 44 }}>
      <PageHeader address={addr} logoDataUrl={logoDataUrl} />

      <View style={{ paddingHorizontal: 36 }}>

        {/* Score hero card */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: P.card, borderRadius: 6,
          padding: 18, marginBottom: 16, marginTop: 8,
        }}>
          <View style={{ alignItems: 'center', marginRight: 22 }}>
            <Gauge score={score} w={100} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6.5, color: P.teal2, letterSpacing: 2, fontWeight: 'bold', marginBottom: 5 }}>
              {demandHeader}
            </Text>
            <Text style={{ fontSize: 11.5, color: P.text, fontWeight: 'bold', marginBottom: 7 }}>
              Market Demand Assessment
            </Text>
            <Text style={{ fontSize: 8, color: P.dim, lineHeight: 1.55 }}>
              {getDemandDesc(score, em)}
            </Text>
          </View>
        </View>

        <SectionHead title="Demand Criteria Breakdown" mt={4} />

        {criteria.map((cr, i) => (
          <CriteriaRow
            key={cr.key}
            label={cr.label}
            score={demand[cr.key]?.score}
            detail={null}
            notes={demand[cr.key]?.notes}
            last={i === criteria.length - 1}
          />
        ))}

        {/* Flying days */}
        {fly && (
          <>
            <SectionHead title="Estimated Annual Flying Days" />
            <View style={{ backgroundColor: P.card, borderRadius: 6, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: P.blue, marginRight: 18 }}>
                  {fly.flyingDays}
                </Text>
                <View>
                  <Text style={{ fontSize: 9, color: P.text, fontWeight: 'bold', marginBottom: 3 }}>
                    flying days / year
                  </Text>
                  <Text style={{ fontSize: 7.5, color: P.dim }}>
                    {fly.rating}  ·  {Math.round((fly.flyingDays / 365) * 100)}% availability
                  </Text>
                  {fly.noFlyDays && (
                    <Text style={{ fontSize: 7, color: P.faint, marginTop: 2 }}>
                      {fly.noFlyDays} estimated grounded days
                    </Text>
                  )}
                </View>
              </View>

              {/* Monthly bar chart */}
              {fly.monthly && fly.monthly.length === 12 && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, marginBottom: 4 }}>
                  {fly.monthly.map((m, i) => {
                    const barH = Math.max(2, Math.round(44 * (m.flyDays || 0) / 31));
                    const MON = ['J','F','M','A','M','J','J','A','S','O','N','D'];
                    const isWinter = i === 0 || i === 1 || i === 11;
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <View style={{
                          width: '80%', height: barH,
                          backgroundColor: isWinter ? P.teal : P.teal2,
                          borderRadius: 1.5,
                        }} />
                        <Text style={{ fontSize: 5.5, color: P.faint, marginTop: 3 }}>{MON[i]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {fly.notes && (
                <Text style={{ fontSize: 7, color: P.dim, marginTop: 6, lineHeight: 1.45 }}>
                  {fly.notes}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      <PageFooter />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 4: INVESTMENT & VIABILITY
// ─────────────────────────────────────────────────────────────────────────────
function InvestmentPage({ results, logoDataUrl }) {
  const em   = results.evalMode || 'passenger';
  const inv  = buildInvestmentSummary(results, em);
  const addr = results.geocode?.matched || 'Site';

  const gradeCol = { A: P.green, B: P.teal2, C: P.amber, D: P.red }[inv.grade?.grade] || P.amber;

  return (
    <Page size="A4" style={{ backgroundColor: P.bg, paddingBottom: 44 }}>
      <PageHeader address={addr} logoDataUrl={logoDataUrl} />

      <View style={{ paddingHorizontal: 36 }}>

        {/* Grade hero */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: P.card, borderRadius: 6,
          padding: 16, marginBottom: 16, marginTop: 8,
        }}>
          <View style={{
            width: 62, height: 62, borderRadius: 31,
            backgroundColor: gradeCol,
            alignItems: 'center', justifyContent: 'center', marginRight: 18,
          }}>
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: P.white }}>
              {inv.grade?.grade}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6.5, color: P.teal2, letterSpacing: 2, fontWeight: 'bold', marginBottom: 4 }}>
              INVESTMENT VIABILITY
            </Text>
            <Text style={{ fontSize: 11, color: P.text, fontWeight: 'bold', marginBottom: 4 }}>
              {inv.scenarioLabel}
            </Text>
            <Text style={{ fontSize: 8, color: P.dim }}>{inv.grade?.gradeLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 6.5, color: P.faint, marginBottom: 5, letterSpacing: 0.5 }}>10-YEAR NPV</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: inv.npv >= 0 ? P.green : P.red }}>
              {fmtM(inv.npv)}
            </Text>
            <Text style={{ fontSize: 7, color: P.faint, marginTop: 5 }}>
              Payback: {inv.paybackYears ? `${inv.paybackYears} yr` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Two-column: CAPEX + Revenue */}
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>

          {/* CAPEX */}
          <View style={{ flex: 1, marginRight: 14 }}>
            <SectionHead title="CAPEX Estimate" mt={4} />
            {[
              { l: 'Low Estimate',  v: fmtM(inv.capex?.low),  bold: false },
              { l: 'Mid Estimate',  v: fmtM(inv.capex?.mid),  bold: true  },
              { l: 'High Estimate', v: fmtM(inv.capex?.high), bold: false },
            ].map((row, i) => (
              <View key={i} style={{
                flexDirection: 'row', paddingVertical: 5,
                borderBottomWidth: 0.5, borderBottomColor: P.border,
              }}>
                <Text style={{ flex: 1, fontSize: 8, color: row.bold ? P.text : P.dim, fontWeight: row.bold ? 'bold' : 'normal' }}>
                  {row.l}
                </Text>
                <Text style={{ fontSize: 8, color: row.bold ? P.blue : P.dim, fontWeight: row.bold ? 'bold' : 'normal' }}>
                  {row.v}
                </Text>
              </View>
            ))}
            {inv.capex?.breakdown?.length > 0 && (
              <>
                <Text style={{ fontSize: 6.5, color: P.faint, marginTop: 10, marginBottom: 5, letterSpacing: 0.8 }}>
                  COMPONENTS (MID)
                </Text>
                {inv.capex.breakdown.slice(0, 6).map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 3.5 }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: P.teal2, marginTop: 2, marginRight: 6 }} />
                    <Text style={{ flex: 1, fontSize: 7, color: P.dim }}>{item.label}</Text>
                    <Text style={{ fontSize: 7, color: P.text }}>{fmtM(item.mid)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {/* Revenue */}
          <View style={{ flex: 1 }}>
            <SectionHead title="Revenue Projections" mt={4} />
            {[
              { l: 'Year 1',  v: fmtM(inv.revenue?.yr1),  m: `${inv.movements?.yr1 || 0} mov/yr` },
              { l: 'Year 3',  v: fmtM(inv.revenue?.yr3),  m: `${inv.movements?.yr3 || 0} mov/yr` },
              { l: 'Year 5',  v: fmtM(inv.revenue?.yr5),  m: `${inv.movements?.yr5 || 0} mov/yr` },
            ].map((row, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
                borderBottomWidth: 0.5, borderBottomColor: P.border,
              }}>
                <Text style={{ width: 50, fontSize: 8, color: P.text }}>{row.l}</Text>
                <Text style={{ flex: 1, fontSize: 8.5, color: P.blue, fontWeight: 'bold' }}>{row.v}</Text>
                <Text style={{ fontSize: 7, color: P.faint }}>{row.m}</Text>
              </View>
            ))}
            <View style={{ marginTop: 10, backgroundColor: '#eef3f8', borderRadius: 4, padding: 9 }}>
              <Text style={{ fontSize: 6.5, color: P.faint, letterSpacing: 0.8, marginBottom: 4 }}>ANNUAL OPEX</Text>
              <Text style={{ fontSize: 10, color: P.text, fontWeight: 'bold', marginBottom: 3 }}>
                {fmtM(inv.opex?.mid)}
              </Text>
              <Text style={{ fontSize: 7, color: P.faint }}>
                Range: {fmtM(inv.opex?.low)} – {fmtM(inv.opex?.high)}
              </Text>
            </View>
            <View style={{ marginTop: 8, backgroundColor: '#eef3f8', borderRadius: 4, padding: 9 }}>
              <Text style={{ fontSize: 6.5, color: P.faint, letterSpacing: 0.8, marginBottom: 4 }}>MOVEMENT RATE</Text>
              <Text style={{ fontSize: 10, color: P.text, fontWeight: 'bold', marginBottom: 3 }}>
                {inv.movements?.perDay || 0} / day
              </Text>
              <Text style={{ fontSize: 7, color: P.faint }}>
                {((inv.movements?.steadyState || 0) / 1000).toFixed(1)}K/yr at steady state
              </Text>
            </View>
          </View>
        </View>

        {/* Risk matrix */}
        {inv.risks?.length > 0 && (
          <>
            <SectionHead title="Risk Assessment" />
            {inv.risks.map((r, i) => {
              const rCol = r.score >= 65 ? P.red : r.score >= 40 ? P.amber : P.green;
              return (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  paddingVertical: 6,
                  borderBottomWidth: i < inv.risks.length - 1 ? 0.5 : 0,
                  borderBottomColor: P.border,
                }}>
                  <View style={{
                    width: 7, height: 7, borderRadius: 3.5,
                    backgroundColor: rCol, marginTop: 2, marginRight: 9,
                  }} />
                  <Text style={{ width: 110, fontSize: 8, color: P.text, fontWeight: 'bold' }}>
                    {r.category}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 7, color: P.dim, lineHeight: 1.45 }}>{r.notes}</Text>
                  <Text style={{ width: 44, textAlign: 'right', fontSize: 7.5, color: rCol, fontWeight: 'bold' }}>
                    {r.label}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Development timeline */}
        {inv.timeline?.phases?.length > 0 && (
          <>
            <SectionHead title={`Development Timeline — ${inv.timeline.totalMonths} Months`} />
            <View style={{ backgroundColor: P.card, borderRadius: 6, padding: 14 }}>
              {inv.timeline.phases.map((phase, i) => {
                const pct = Math.round((phase.months / inv.timeline.totalMonths) * 100);
                const phaseCol =
                  (phase.name || '').toLowerCase().includes('pre')       ? P.faint :
                  (phase.name || '').toLowerCase().includes('permit')    ? P.amber :
                  (phase.name || '').toLowerCase().includes('construct') ? P.blue  : P.green;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                    <Text style={{ width: 100, fontSize: 7.5, color: P.text }}>{phase.name}</Text>
                    <View style={{
                      flex: 1, height: 13, backgroundColor: '#dce8f2',
                      borderRadius: 3, marginHorizontal: 8,
                    }}>
                      <View style={{
                        width: `${pct}%`, height: 13,
                        backgroundColor: phaseCol, borderRadius: 3,
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        {pct > 14 && (
                          <Text style={{ fontSize: 6, color: P.white }}>{phase.months}mo</Text>
                        )}
                      </View>
                    </View>
                    <Text style={{ width: 34, textAlign: 'right', fontSize: 7, color: P.dim }}>
                      {phase.months}mo
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      <PageFooter />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5: REGULATORY CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────
function RegulatoryPage({ results, logoDataUrl }) {
  const em    = results.evalMode || 'passenger';
  const items = buildRegulatoryChecklist(results, em);
  const addr  = results.geocode?.matched || 'Site';

  const statusCol = s =>
    s === 'required'    ? P.red :
    s === 'recommended' ? P.amber : P.green;

  const urgencyBg = u =>
    u === 'critical' ? '#fde8e8' :
    u === 'high'     ? '#fef3e2' : '#e8f5ee';

  const urgencyTxt = u =>
    u === 'critical' ? P.red :
    u === 'high'     ? P.amber : P.green;

  const req      = items.filter(r => r.status === 'required').length;
  const critical = items.filter(r => r.urgency === 'critical').length;

  return (
    <Page size="A4" style={{ backgroundColor: P.bg, paddingBottom: 44 }}>
      <PageHeader address={addr} logoDataUrl={logoDataUrl} />

      <View style={{ paddingHorizontal: 36 }}>

        {/* Summary stats */}
        <View style={{ flexDirection: 'row', marginBottom: 16, marginTop: 8 }}>
          {[
            { label: 'Total Items', value: items.length, color: P.blue   },
            { label: 'Required',    value: req,          color: P.red    },
            { label: 'Critical',    value: critical,     color: P.amber  },
          ].map((stat, i) => (
            <View key={i} style={{
              flex: 1, backgroundColor: P.card, borderRadius: 6, padding: 14,
              alignItems: 'center', marginRight: i < 2 ? 12 : 0,
            }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: stat.color }}>
                {stat.value}
              </Text>
              <Text style={{ fontSize: 7, color: P.dim, marginTop: 3 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Items grouped by category */}
        {CATEGORIES.map(cat => {
          const catItems = items.filter(r => r.category === cat);
          if (!catItems.length) return null;
          return (
            <View key={cat}>
              <SectionHead title={cat} />
              {catItems.map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  paddingVertical: 6, paddingHorizontal: 10,
                  marginBottom: 3,
                  backgroundColor: P.surface,
                  borderRadius: 4,
                  borderLeftWidth: 3, borderLeftColor: statusCol(item.status),
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, color: P.text, fontWeight: 'bold', marginBottom: 2 }}>
                      {item.label}
                    </Text>
                    {item.detail && (
                      <Text style={{ fontSize: 7, color: P.dim, lineHeight: 1.4 }}>{item.detail}</Text>
                    )}
                  </View>
                  {item.urgency && (
                    <View style={{
                      paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 3,
                      backgroundColor: urgencyBg(item.urgency), marginLeft: 10,
                    }}>
                      <Text style={{ fontSize: 6, color: urgencyTxt(item.urgency), fontWeight: 'bold' }}>
                        {(item.urgency || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}

        {/* Disclaimer */}
        <View style={{
          marginTop: 14, padding: 11,
          backgroundColor: '#f6f1e8',
          borderRadius: 4,
          borderLeftWidth: 3, borderLeftColor: P.amber,
        }}>
          <Text style={{ fontSize: 7, color: P.dim, lineHeight: 1.55 }}>
            This checklist is generated from automated scoring and is not legal or engineering advice.
            Consult FAA representatives, local zoning authorities, and licensed engineers before
            proceeding with site development.
          </Text>
        </View>
      </View>

      <PageFooter />
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
function ReportDocument({ results, mapDataUrl, logoDataUrl }) {
  return (
    <Document
      title={`Vertiport Evaluation — ${results.geocode?.matched || 'Site'}`}
      author="VES / LOWALTITUDEECONOMY.AERO"
      creator="Vertiport Evaluation System"
    >
      <CoverPage    results={results} mapDataUrl={mapDataUrl} logoDataUrl={logoDataUrl} />
      <SiteScorePage   results={results} logoDataUrl={logoDataUrl} />
      <DemandScorePage results={results} logoDataUrl={logoDataUrl} />
      <InvestmentPage  results={results} logoDataUrl={logoDataUrl} />
      <RegulatoryPage  results={results} logoDataUrl={logoDataUrl} />
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadPDF(results, mapDataUrl = null, logoDataUrl = null) {
  const doc = (
    <ReportDocument
      results={results}
      mapDataUrl={mapDataUrl}
      logoDataUrl={logoDataUrl}
    />
  );
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const siteName = (results.geocode?.matched || 'site')
    .split(',')[0].replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  a.download = `vertiport-report-${siteName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

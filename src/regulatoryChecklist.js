// Regulatory checklist generator for vertiport site development.
// Returns a contextualized list of regulatory steps based on site evaluation data.
// Each item: { id, category, title, authority, citation, status, urgency, notes }
//
// status:  "required" | "likely_required" | "conditional" | "recommended"
// urgency: "critical" | "high" | "medium" | "low"

const CATEGORIES = {
  FAA: "FAA / Federal Aviation",
  ENV: "Environmental",
  STATE: "State of Texas",
  LOCAL: "Local / Municipal",
  UTIL: "Utility & Infrastructure",
  OPS: "Operational Readiness",
};

export function buildRegulatoryChecklist(results) {
  const airspace = results.site?.airspace || {};
  const zoning = results.site?.zoning || {};
  const soil = results.site?.soil || {};
  const parcel = results.site?.parcel || {};
  const heli = results.heliport || {};
  const eia = results.eia || null;
  const geocode = results.geocode || {};

  const airspaceClass = (airspace.status || "").toUpperCase();
  const isClassB = airspaceClass.includes("B");
  const isClassC = airspaceClass.includes("C");
  const isClassD = airspaceClass.includes("D");
  const isControlled = isClassB || isClassC || isClassD;
  const laancRequired = airspace.laanc_required === true;
  const floodZone = (soil.flood_zone || "").toUpperCase();
  const inFloodplain = floodZone.includes("AE") || floodZone.includes("VE") || floodZone.includes("A ");
  const zoningCompliance = (zoning.compliance || "").toLowerCase();
  const needsRezoning = zoningCompliance.includes("poor") || zoningCompliance.includes("non") || zoningCompliance.includes("limited");
  const isResidential = (zoning.land_use || "").toLowerCase().includes("residen");
  const nearHeliport = heli.status && heli.status !== "none";
  const smallParcel = (parcel.acreage_estimate || 0) < 2;
  const nearAirport = (airspace.nearest_airport || "").length > 0;

  const items = [];
  let id = 1;

  const add = (category, title, authority, citation, status, urgency, notes) => {
    items.push({ id: id++, category, title, authority, citation, status, urgency, notes });
  };

  // ═══════════════════════════════════════════════════
  // FAA / FEDERAL AVIATION
  // ═══════════════════════════════════════════════════

  add("FAA", "FAA Form 7460-1: Notice of Proposed Construction",
    "FAA Obstruction Evaluation Group",
    "14 CFR Part 77; 49 USC §44718",
    "required", "critical",
    "Must be filed at least 45 days before construction begins. Required for any structure that may affect navigable airspace. Triggers aeronautical study."
  );

  add("FAA", "Airspace Authorization & LAANC Coordination",
    "FAA Air Traffic Organization",
    "14 CFR Part 91; FAA Order 7400.2",
    isControlled ? "required" : laancRequired ? "likely_required" : "recommended",
    isClassB ? "critical" : isControlled ? "high" : "medium",
    isClassB ? `Site is in Class B airspace. Full FAA ATC coordination required. Expect extended review timeline (6-12 months). ${nearAirport ? `Nearest airport: ${airspace.nearest_airport}.` : ""}`
      : isControlled ? `${airspaceClass} airspace requires ATC letter of agreement. ${nearAirport ? `Coordinate with ${airspace.nearest_airport} tower.` : ""}`
      : `Class G airspace. LAANC ${laancRequired ? "required" : "not currently required"} but recommended for operational integration.`
  );

  add("FAA", "Part 77 Obstruction Evaluation / Aeronautical Study",
    "FAA Obstruction Evaluation Group",
    "14 CFR §77.9; FAA Order 7400.2M",
    "required", "critical",
    "Triggered by 7460-1 filing. FAA evaluates impact on existing flight paths, instrument procedures, and adjacent airport operations. May result in marking/lighting requirements."
  );

  add("FAA", "Engineering Brief 105: Vertiport Design",
    "FAA Office of Airports",
    "FAA EB 105 (2024 draft); AC 150/5390-2C",
    "required", "high",
    `Defines TLOF/FATO dimensions, approach/departure surfaces, safety areas, and marking standards. ${smallParcel ? "Small parcel may constrain FATO layout — verify minimum clearances." : "Verify parcel geometry supports required approach surfaces."}`
  );

  add("FAA", "Part 139 or Part 157 Airport Registration",
    "FAA Office of Airports",
    "14 CFR Part 157; AC 150/5300-13B",
    "likely_required", "high",
    "Vertiport construction requires notice under Part 157. Full Part 139 certification may apply if scheduled commercial operations are planned. File concurrently with 7460-1."
  );

  if (nearHeliport) {
    add("FAA", "Existing Heliport Operator Coordination",
      "FAA / Existing Operator",
      "AC 150/5390-2C §4.3",
      "required", "high",
      `Active heliport within ${heli.distance_m}m: ${heli.name}. Must coordinate operations, shared approach/departure paths, and frequency assignments. May simplify airspace approvals if co-located.`
    );
  }

  add("FAA", "Noise Compatibility Assessment",
    "FAA Office of Environment and Energy",
    "14 CFR Part 150; FAA Order 1050.1F",
    isResidential ? "required" : "recommended",
    isResidential ? "high" : "medium",
    isResidential ? "Residential proximity requires formal noise compatibility study. eVTOL noise profiles differ from conventional rotorcraft — use manufacturer-specific data."
      : "Noise study recommended for community acceptance. eVTOL operations typically 15-25 dB quieter than equivalent helicopter operations."
  );

  // ═══════════════════════════════════════════════════
  // ENVIRONMENTAL
  // ═══════════════════════════════════════════════════

  add("ENV", "NEPA Environmental Review",
    "FAA Office of Environment and Energy",
    "42 USC §4321; FAA Order 1050.1F; 40 CFR §1501",
    "required", "critical",
    "Federal action (airspace change, AIP funding) triggers NEPA. Categorical Exclusion (CATEX) possible for small vertiports on previously developed land. Environmental Assessment (EA) likely for greenfield sites."
  );

  if (inFloodplain) {
    add("ENV", "FEMA Floodplain Development Permit",
      "Local Floodplain Administrator / FEMA",
      "44 CFR §60.3; Executive Order 11988",
      "required", "critical",
      `Site in ${floodZone} flood zone. Floodplain development permit required. Structure must be elevated above BFE. May require CLOMR/LOMR if altering drainage. Significant cost and timeline impact.`
    );
  }

  add("ENV", "Stormwater Management / NPDES Permit",
    "EPA Region 6 / TCEQ",
    "40 CFR §122; TX Water Code §26",
    parcel.acreage_estimate >= 1 ? "required" : "likely_required",
    "medium",
    `Construction disturbing ≥1 acre requires TCEQ SWPPP and EPA NPDES CGP. ${parcel.acreage_estimate ? `Estimated parcel: ~${parcel.acreage_estimate} ac.` : ""} File Notice of Intent (NOI) before grading.`
  );

  add("ENV", "Section 106 Historic Preservation Review",
    "State Historic Preservation Office (THC)",
    "54 USC §306108; 36 CFR Part 800",
    "likely_required", "medium",
    "Required for federal undertakings. Texas Historical Commission reviews for impact on historic properties and archaeological sites. Typically 30-90 day review."
  );

  add("ENV", "Endangered Species Consultation (Section 7)",
    "US Fish & Wildlife Service",
    "16 USC §1536; 50 CFR Part 402",
    "likely_required", "medium",
    "Federal nexus triggers Section 7 consultation. TX coastal and riparian sites may have species concerns. IPaC screening is the first step — can often be cleared quickly."
  );

  add("ENV", "Phase I Environmental Site Assessment",
    "Environmental Consultant (ASTM E1527)",
    "ASTM E1527-21; 40 CFR Part 312",
    "required", "high",
    "Standard due diligence for any real estate transaction. Identifies recognized environmental conditions (RECs). Required by most lenders and essential before property transfer."
  );

  // ═══════════════════════════════════════════════════
  // STATE OF TEXAS
  // ═══════════════════════════════════════════════════

  add("STATE", "TxDOT Aviation Division Notification",
    "Texas Department of Transportation — Aviation",
    "TX Transportation Code §21.003; 43 TAC §30",
    "required", "high",
    "Texas requires notification of new landing facility construction. TxDOT Aviation maintains the state airport system plan. File concurrently with FAA 7460-1."
  );

  add("STATE", "TCEQ Air Quality Permit Review",
    "Texas Commission on Environmental Quality",
    "TX Health & Safety Code Ch. 382; 30 TAC Ch. 116",
    "conditional", "low",
    "eVTOL operations produce zero direct emissions. Permit review may apply to backup generators, charging infrastructure, or construction equipment. Standard exemptions likely available."
  );

  add("STATE", "Texas Accessibility Standards (TAS)",
    "Texas Department of Licensing and Regulation",
    "TX Gov't Code Ch. 469; TAS §4.1",
    "required", "medium",
    "All public-facing facilities must comply with TAS (which incorporates ADA). Passenger loading areas, terminals, and pathways must be accessible. Review during design phase."
  );

  // ═══════════════════════════════════════════════════
  // LOCAL / MUNICIPAL
  // ═══════════════════════════════════════════════════

  if (needsRezoning || isResidential) {
    add("LOCAL", "Zoning Variance or Rezoning Application",
      "Municipal Planning & Zoning Commission",
      "TX Local Gov't Code Ch. 211",
      "required", "critical",
      `Current zoning (${zoning.land_use || "unknown"}) ${zoningCompliance ? `rated "${zoning.compliance}"` : "may not permit"} vertiport use. Rezoning or special-use permit required. Expect public hearing process (2-6 months). Community opposition is the primary risk.`
    );
  }

  add("LOCAL", "Building Permit & Plan Review",
    "Municipal Building Department",
    "IBC 2021; local amendments",
    "required", "high",
    "Full architectural and structural plan review. Vertiport-specific items: TLOF load rating (MTOW + safety factor), fire suppression, electrical capacity for charging, passenger shelter design."
  );

  add("LOCAL", "Fire Code Compliance & Fire Marshal Review",
    "Local Fire Marshal / Fire Department",
    "IFC 2021 Ch. 11 (Aviation Facilities); NFPA 418",
    "required", "high",
    "Fire suppression for battery charging areas, ARFF capability assessment, emergency vehicle access. eVTOL battery fire protocols differ from conventional aviation fueling — coordinate early with fire marshal."
  );

  add("LOCAL", "Site Plan / Plat Approval",
    "Municipal Planning Department",
    "TX Local Gov't Code Ch. 212",
    "required", "medium",
    "Site plan must show TLOF/FATO layout, safety areas, vehicle access, utility connections, stormwater management, landscaping buffers. Verify setback requirements accommodate approach surfaces."
  );

  add("LOCAL", "Traffic Impact Analysis",
    "Municipal Transportation / Public Works",
    "Local ordinance; ITE Trip Generation Manual",
    "likely_required", "medium",
    "Ground-side traffic study for passenger drop-off, rideshare staging, and service vehicle access. Vertiport-specific trip generation data still limited — reference existing heliport and transit terminal data."
  );

  // ═══════════════════════════════════════════════════
  // UTILITY & INFRASTRUCTURE
  // ═══════════════════════════════════════════════════

  add("UTIL", "ERCOT Interconnection & Utility Coordination",
    "ERCOT / Local Utility (CenterPoint, Oncor, etc.)",
    "PUCT Subst. R. §25.211; ERCOT Protocols §5",
    "required", "high",
    `eVTOL charging demands 500 kW–2 MW peak. ${eia ? `Grid: ${eia.details?.["Grid"] || "ERCOT"}.` : "ERCOT grid."} File interconnection application early — transformer upgrades may have 6-12 month lead time. Consider on-site battery storage to manage peak demand charges.`
  );

  add("UTIL", "Telecommunications & Navigation Aid Coordination",
    "FCC / FAA Technical Operations",
    "47 CFR Part 17; FAA Order 6050.32B",
    "recommended", "medium",
    "Verify no interference with existing NAVAIDs, ILS, or radar systems. File FCC Form 854 if installing communications tower. Coordinate with FAA Tech Ops for any RF-emitting equipment."
  );

  // ═══════════════════════════════════════════════════
  // OPERATIONAL READINESS
  // ═══════════════════════════════════════════════════

  add("OPS", "Operations Manual & Standard Operating Procedures",
    "Internal / FAA Flight Standards",
    "AC 150/5390-2C; FAA EB 105",
    "required", "medium",
    "Develop SOPs covering normal and emergency operations, passenger handling, ground operations, maintenance, weather minimums, and noise abatement procedures. Required before first flight."
  );

  add("OPS", "Emergency Response Plan",
    "Local Emergency Management / Fire Marshal",
    "14 CFR §139.325; IFC Ch. 11",
    "required", "high",
    "Coordinate with local fire department and EMS. Define response protocols for aircraft incident, battery thermal event, medical emergency, and security threat. Conduct tabletop exercise before operations begin."
  );

  add("OPS", "Security Plan",
    "TSA / Local Law Enforcement",
    "49 CFR Part 1542 (if applicable); TSA guidance",
    "likely_required", "medium",
    "Passenger screening requirements TBD by TSA for eVTOL operations. Develop perimeter security, access control, and surveillance plan. Coordinate with local law enforcement for response protocols."
  );

  add("OPS", "Insurance & Liability Coverage",
    "Aviation Insurance Underwriter",
    "State insurance requirements; lender requirements",
    "required", "high",
    "Secure aviation general liability, hangarkeeper's liability, premises liability, and workers' compensation. eVTOL operations are a novel risk class — engage specialist aviation brokers early. Coverage requirements may affect financing terms."
  );

  return items;
}

export { CATEGORIES };

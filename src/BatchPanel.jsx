import { useState } from "react";

const C = {
  surface:"#FFFFFF", bg:"#F9F9F9", card:"#EAF4FC", border:"#d0dce8",
  amber:"#5B9BD5", amberDim:"#7db0b5", amberGlow:"rgba(91,155,213,0.15)",
  green:"#1a8a58", yellow:"#c87a10", red:"#C0392B",
  text:"#444444", textBright:"#222222", textDim:"#999999", textLabel:"#5B9BD5",
};

function scoreColor(s) {
  if (s == null) return "#9ab8d0";
  if (s >= 75) return C.green;
  if (s >= 45) return C.yellow;
  return C.red;
}

function ScoreBadge({ value }) {
  return (
    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, color:scoreColor(value) }}>
      {value ?? "—"}
    </span>
  );
}

function exportCsv(results) {
  const header = "Rank,Address,Acreage (ac),Use Description,Parcel Score,Air Score,Site Estimate,Airspace,Parcel ID";
  const rows = results.map((r, i) =>
    [i+1, `"${r.address}"`, r.acreage.toFixed(2), `"${r.usedesc}"`, r.parcelScore, r.airScore, r.siteEst, `"${r.airStatus}"`, r.parcelnumb].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type:"text/csv" });
  const a = Object.assign(document.createElement("a"), { href:URL.createObjectURL(blob), download:"vertiport-batch-results.csv" });
  a.click(); URL.revokeObjectURL(a.href);
}

const COLS = [
  { key:"siteEst",     label:"EST",  title:"Estimated site score" },
  { key:"parcelScore", label:"PCSL", title:"Parcel score" },
  { key:"airScore",    label:"AIR",  title:"Airspace score" },
  { key:"acreage",     label:"AC",   title:"Acreage" },
];

export default function BatchPanel({ results, loading, error, totalFound, screened, onEvaluate, onClear }) {
  const [sortKey, setSortKey] = useState("siteEst");

  const sorted = results ? [...results].sort((a, b) => b[sortKey] - a[sortKey]) : [];

  return (
    <div style={{ marginBottom:20, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"10px 16px", background:C.amberGlow, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:"0.2em", color:C.amber }}>
          BATCH AREA SCORING
          {results && ` — ${results.length} PARCELS`}
        </span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {results?.length > 0 && (
            <button onClick={()=>exportCsv(results)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:"0.1em", padding:"4px 10px", borderRadius:4, cursor:"pointer", background:"none", border:`1px solid ${C.border}`, color:C.textDim }}>
              CSV ↓
            </button>
          )}
          <button onClick={onClear} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:"0.1em", padding:"4px 10px", borderRadius:4, cursor:"pointer", background:"none", border:`1px solid ${C.border}`, color:C.textDim }}>
            CLEAR
          </button>
        </div>
      </div>

      <div style={{ padding:"16px 20px", background:C.surface }}>
        {/* Loading */}
        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:10, color:C.amberDim, fontFamily:"'IBM Plex Mono',monospace", fontSize:10 }}>
            <div style={{ width:12, height:12, borderRadius:"50%", border:`2px solid ${C.amber}`, borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }} />
            Querying Regrid and scoring parcels…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:C.red, padding:"10px 14px", background:"rgba(192,57,43,0.07)", borderRadius:6, border:`1px solid rgba(192,57,43,0.2)` }}>
            {error}
          </div>
        )}

        {/* Stats row */}
        {results && !error && (
          <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap" }}>
            {[
              { label:"FOUND",   value:totalFound },
              { label:"SCREENED IN", value:screened },
              { label:"RANKED",  value:results.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
                <div style={{ fontSize:8, color:C.amberDim, letterSpacing:"0.15em", marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:16, fontWeight:600, color:C.textBright }}>{value}</div>
              </div>
            ))}
            <div style={{ marginLeft:"auto", fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:C.textDim, alignSelf:"flex-end" }}>
              Sort by:
              {COLS.map(col => (
                <button key={col.key} onClick={()=>setSortKey(col.key)} title={col.title} style={{ marginLeft:6, fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:"0.1em", padding:"3px 7px", borderRadius:3, cursor:"pointer", background:sortKey===col.key?C.amberGlow:"none", border:`1px solid ${sortKey===col.key?C.amber:C.border}`, color:sortKey===col.key?C.amber:C.textDim }}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {results && results.length === 0 && !error && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:C.textDim, padding:"10px 0" }}>
            No parcels passed pre-screening in this area (min 0.3 ac, non-residential).{!totalFound && " Add a Regrid key in Settings for nationwide coverage."}
          </div>
        )}

        {/* Table */}
        {sorted.length > 0 && (
          <div style={{ border:`1px solid ${C.border}`, borderRadius:6, overflow:"hidden" }}>
            {/* Table header */}
            <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 52px 52px 52px 90px 90px", background:C.card, padding:"7px 12px", borderBottom:`1px solid ${C.border}` }}>
              {["#","ADDRESS","EST","PCSL","AIR","AIRSPACE",""].map((h,i) => (
                <span key={i} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:"0.12em", color:C.textLabel }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {sorted.map((r, i) => (
              <div key={r.parcelnumb || i} style={{ display:"grid", gridTemplateColumns:"28px 1fr 52px 52px 52px 90px 90px", padding:"9px 12px", alignItems:"center", borderBottom:i < sorted.length-1?`1px solid ${C.border}`:"none", background:i===0?`${C.amberGlow}`:"#fff" }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.textDim }}>{i+1}</span>
                <div style={{ paddingRight:8, minWidth:0 }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:C.textBright, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.address}>
                    {r.address || r.parcelnumb || "—"}
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:C.textDim, marginTop:1 }}>
                    {r.acreage.toFixed(2)} ac · {r.usedesc}
                  </div>
                </div>
                <ScoreBadge value={r.siteEst} />
                <ScoreBadge value={r.parcelScore} />
                <ScoreBadge value={r.airScore} />
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:C.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.airStatus}>
                  {r.airStatus?.split("(")[0].trim() || "—"}
                </span>
                <button
                  onClick={() => onEvaluate({ lat:r.lat, lon:r.lon, address:r.address || `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}` })}
                  style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:"0.08em", padding:"4px 8px", borderRadius:4, cursor:"pointer", background:"none", border:`1px solid ${C.amber}`, color:C.amber }}
                >
                  EVALUATE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

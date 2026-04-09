import { useState } from "react";
import aamLogo from "./assets/aam_logo.png";

const C = {
  bg: "#F9F9F9", surface: "#FFFFFF", card: "#EAF4FC", border: "#d0dce8",
  amber: "#5B9BD5", amberDim: "#7db0b5", amberGlow: "rgba(91,155,213,0.15)",
  green: "#1a8a58", yellow: "#c87a10", red: "#C0392B",
  text: "#444444", textBright: "#222222", textDim: "#999999", textLabel: "#5B9BD5",
};

const PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic",
    model: "Claude",
    hint: "Recommended. Get your key at console.anthropic.com",
    placeholder: "sk-ant-api03-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    validate: async (key) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API ${r.status}: ${t.slice(0, 100)}`);
      }
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    model: "GPT-4o",
    hint: "Get your key at platform.openai.com",
    placeholder: "sk-proj-…",
    docsUrl: "https://platform.openai.com/api-keys",
    validate: async (key) => {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API ${r.status}: ${t.slice(0, 100)}`);
      }
    },
  },
  {
    id: "gemini",
    label: "Google Gemini",
    model: "Gemini 2.0 Flash",
    hint: "Get your key at aistudio.google.com",
    placeholder: "AIza…",
    docsUrl: "https://aistudio.google.com/app/apikey",
    validate: async (key) => {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API ${r.status}: ${t.slice(0, 100)}`);
      }
    },
  },
];

export default function SetupScreen({ onComplete, currentConfig = null }) {
  const [selectedProvider, setSelectedProvider] = useState(
    currentConfig?.provider || "anthropic"
  );
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | validating | ok | error
  const [errMsg, setErrMsg] = useState("");

  const provider = PROVIDERS.find((p) => p.id === selectedProvider);

  async function handleSave() {
    if (!apiKey.trim()) { setErrMsg("Enter your API key."); setStatus("error"); return; }
    setStatus("validating");
    setErrMsg("");
    try {
      await provider.validate(apiKey.trim());
      const cfg = { provider: selectedProvider, apiKey: apiKey.trim() };
      if (window.electronAPI) await window.electronAPI.setConfig(cfg);
      setStatus("ok");
      setTimeout(() => onComplete(cfg), 600);
    } catch (e) {
      setStatus("error");
      setErrMsg(e.message || "Validation failed. Check your key and try again.");
    }
  }

  function openDocs() {
    if (window.electronAPI) window.electronAPI.openExternal(provider.docsUrl);
    else window.open(provider.docsUrl, "_blank", "noopener");
  }

  const btnDisabled = status === "validating" || status === "ok";

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'IBM Plex Sans',sans-serif", color: C.text, padding: "40px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .prov-tab { cursor:pointer; transition: all 0.15s; }
        .prov-tab:hover { border-color: ${C.amber} !important; }
        .setup-save:hover:not(:disabled) { background: ${C.textBright} !important; }
        .setup-save:disabled { opacity: 0.5; cursor: default; }
        .key-toggle:hover { color: ${C.amber} !important; }
        .docs-link:hover { color: ${C.amber} !important; }
      `}</style>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
        <img src={aamLogo} alt="LAE" style={{ width: 40, height: 40, objectFit: "contain" }} />
        <div>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 900, color: C.textBright, letterSpacing: "0.2em" }}>VERTIPORT EVAL</div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: C.amberDim, letterSpacing: "0.25em", marginTop: 2 }}>SITE EVALUATION SYSTEM</div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "40px 48px", width: "100%", maxWidth: 520,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>

        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.amberDim, letterSpacing: "0.2em", marginBottom: 10 }}>
          {currentConfig ? "CHANGE AI PROVIDER" : "FIRST LAUNCH · AI SETUP"}
        </div>
        <h2 style={{ fontFamily: "'Orbitron',monospace", fontSize: 18, fontWeight: 900, color: C.textBright, marginBottom: 8, letterSpacing: "0.05em" }}>
          Connect your AI key
        </h2>
        <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 32 }}>
          Vertiport Eval uses a large language model to evaluate demand factors. Bring
          your own key — it stays on your machine and is never sent to any server.
        </p>

        {/* Provider tabs */}
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: C.amberDim, letterSpacing: "0.2em", marginBottom: 10 }}>
          AI PROVIDER
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className="prov-tab"
              onClick={() => { setSelectedProvider(p.id); setApiKey(""); setStatus("idle"); setErrMsg(""); }}
              style={{
                flex: 1, padding: "10px 6px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${selectedProvider === p.id ? C.amber : C.border}`,
                background: selectedProvider === p.id ? C.card : C.surface,
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 600, color: selectedProvider === p.id ? C.textBright : C.textDim, letterSpacing: "0.05em" }}>
                {p.label}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 10, color: C.textDim, marginTop: 3 }}>
                {p.model}
              </div>
            </button>
          ))}
        </div>

        {/* Key input */}
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: C.amberDim, letterSpacing: "0.2em", marginBottom: 8 }}>
          API KEY
        </div>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setStatus("idle"); setErrMsg(""); }}
            onKeyDown={(e) => e.key === "Enter" && !btnDisabled && handleSave()}
            placeholder={provider.placeholder}
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%", padding: "11px 48px 11px 14px",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 12,
              background: C.bg, border: `1px solid ${status === "error" ? C.red : status === "ok" ? C.green : C.border}`,
              borderRadius: 6, color: C.textBright, outline: "none",
            }}
          />
          <button
            className="key-toggle"
            onClick={() => setShowKey((v) => !v)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
              color: C.textDim, letterSpacing: "0.1em",
            }}
          >
            {showKey ? "HIDE" : "SHOW"}
          </button>
        </div>

        {/* Hint + docs link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 11, color: C.textDim }}>{provider.hint}</span>
          <button className="docs-link" onClick={openDocs} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: C.textDim, letterSpacing: "0.1em", textDecoration: "underline" }}>
            GET KEY
          </button>
        </div>

        {/* Error message */}
        {status === "error" && errMsg && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.red, marginBottom: 16, padding: "10px 14px", background: "rgba(192,57,43,0.07)", borderRadius: 6, border: `1px solid rgba(192,57,43,0.2)` }}>
            {errMsg}
          </div>
        )}

        {/* Save button */}
        <button
          className="setup-save"
          onClick={handleSave}
          disabled={btnDisabled}
          style={{
            width: "100%", padding: "14px", background: C.textBright, color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
            letterSpacing: "0.15em", transition: "all 0.15s",
          }}
        >
          {status === "validating" ? "VALIDATING…" : status === "ok" ? "KEY VERIFIED ✓" : "VALIDATE & SAVE"}
        </button>

        {/* Skip / cancel for returning users */}
        {currentConfig && (
          <button onClick={() => onComplete(currentConfig)} style={{ width: "100%", marginTop: 12, padding: "10px", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.textDim, letterSpacing: "0.1em" }}>
            CANCEL
          </button>
        )}
      </div>

      <div style={{ marginTop: 24, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: C.textDim, letterSpacing: "0.15em" }}>
        KEY STORED LOCALLY · NEVER TRANSMITTED · MIT LICENSE
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react'

const BASE_URL = 'http://localhost:8000/api'

export default function ModelSelector({ selectedModel, onModelChange }) {
  const [models, setModels] = useState([])
  const [open, setOpen] = useState(false)
  const [routing, setRouting] = useState(null)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const res = await fetch(`${BASE_URL}/llm/models/`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.models.filter(m => m.installed))
      }
    } catch (e) {}
  }

  const currentModel = models.find(m => m.model_id === selectedModel) || models[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(14,25,45,0.8)',
          border: '1px solid rgba(99,179,237,0.2)',
          borderRadius: 8,
          padding: '6px 12px',
          color: '#94a3b8',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'Sora, sans-serif',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
      >
        <span>{currentModel?.icon || '🤖'}</span>
        <span>{selectedModel ? currentModel?.display_name || selectedModel : 'Auto'}</span>
        <span style={{ fontSize: 10, color: '#334155' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 6,
          background: 'rgba(9,18,34,0.98)',
          border: '1px solid rgba(99,179,237,0.15)',
          borderRadius: 12,
          padding: 8,
          zIndex: 200,
          minWidth: 240,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Auto option */}
          <div
            onClick={() => { onModelChange(null); setOpen(false) }}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: !selectedModel ? 'rgba(14,165,233,0.1)' : 'transparent',
              marginBottom: 4,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,179,237,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = !selectedModel ? 'rgba(14,165,233,0.1)' : 'transparent'}
          >
            <span style={{ fontSize: 18 }}>🧠</span>
            <div>
              <div style={{ fontSize: 13, color: !selectedModel ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>Auto Router</div>
              <div style={{ fontSize: 11, color: '#334155' }}>Best model selected automatically</div>
            </div>
            {!selectedModel && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#38bdf8' }}>✓</span>}
          </div>

          <div style={{ borderTop: '1px solid rgba(99,179,237,0.08)', margin: '6px 0' }} />

          {models.map(model => (
            <div
              key={model.model_id}
              onClick={() => { onModelChange(model.model_id); setOpen(false) }}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: selectedModel === model.model_id ? 'rgba(14,165,233,0.1)' : 'transparent',
                marginBottom: 2,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,179,237,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = selectedModel === model.model_id ? 'rgba(14,165,233,0.1)' : 'transparent'}
            >
              <span style={{ fontSize: 18 }}>{model.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: selectedModel === model.model_id ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>{model.display_name}</div>
                <div style={{ fontSize: 11, color: '#334155' }}>{model.description}</div>
              </div>
              {selectedModel === model.model_id && <span style={{ fontSize: 11, color: '#38bdf8' }}>✓</span>}
            </div>
          ))}

          <div style={{ borderTop: '1px solid rgba(99,179,237,0.08)', marginTop: 6, paddingTop: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.5 }}>
              🔒 All models run locally via Ollama · No cloud · No cost
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

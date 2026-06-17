import { useState } from 'react';

// Renders `value` as plain text when `canEdit` is false.
// When `canEdit` is true, clicking the text opens an inline input.
// `onSave(newName)` should return { error } on failure or falsy/null on success.
export default function InlineEdit({ value, onSave, canEdit, style, inputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [err,     setErr]     = useState(null);
  const [saving,  setSaving]  = useState(false);

  if (!canEdit) return <span style={style}>{value}</span>;

  function open()  { setDraft(value); setEditing(true); setErr(null); }
  function cancel(){ setDraft(value); setEditing(false); setErr(null); }

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { cancel(); return; }
    setSaving(true);
    setErr(null);
    const result = await onSave(trimmed);
    setSaving(false);
    if (result?.error) {
      setErr(result.error);
    } else {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, verticalAlign: 'middle' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { cancel(); }
          }}
          disabled={saving}
          autoFocus
          style={{
            background: '#0f172a', color: '#e2e8f0',
            border: '1px solid #3b82f6', borderRadius: 4,
            padding: '2px 6px', fontSize: 'inherit', fontWeight: 'inherit',
            fontFamily: 'inherit', minWidth: 80,
            ...inputStyle,
          }}
        />
        {err && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{err}</span>}
      </span>
    );
  }

  return (
    <span
      onClick={open}
      style={{ ...style, cursor: 'pointer', borderBottom: '1px dashed #475569' }}
      title="Click to rename"
    >
      {value}
    </span>
  );
}

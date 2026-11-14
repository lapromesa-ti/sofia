"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboOption = { id: number; name: string };

/** Valor seleccionado: un registro existente o un nombre nuevo pendiente de crear. */
export type ComboValue =
  | { kind: "existing"; id: number; name: string }
  | { kind: "new"; name: string }
  | null;

/** Recorta y colapsa espacios internos. */
export function normalizeName(s: string) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

/** Clave de comparación: sin mayúsculas, sin tildes y sin espacios sobrantes. */
export function nameKey(s: string) {
  return normalizeName(s)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Props = {
  value: ComboValue;
  options: ComboOption[];
  onChange: (v: ComboValue) => void;
  /** "módulo" | "grupo" — se usa en el texto "+ Crear {entity}: …" */
  entity: string;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
};

type Item =
  | { type: "option"; option: ComboOption }
  | { type: "create"; name: string };

export default function CreatableCombo({
  value,
  options,
  onChange,
  entity,
  placeholder,
  disabled,
  allowCreate = true,
}: Props) {
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // Sincroniza el texto cuando el valor cambia desde fuera (cargar edición, limpiar).
  // Mientras el usuario escribe (lista abierta) no se pisa su texto.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (value || !openRef.current) setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const items = useMemo<Item[]>(() => {
    const q = nameKey(text);
    // Si el texto es exactamente el valor seleccionado, mostrar toda la lista.
    const showAll = !q || (value && nameKey(value.name) === q);
    const filtered = showAll ? options : options.filter((o) => nameKey(o.name).includes(q));
    const out: Item[] = filtered.map((o) => ({ type: "option", option: o }));
    const clean = normalizeName(text);
    const exact = options.some((o) => nameKey(o.name) === q);
    if (allowCreate && clean && !exact) out.push({ type: "create", name: clean });
    return out;
  }, [text, options, value, allowCreate]);

  function close() {
    setOpen(false);
    // Si el texto no corresponde a una selección, restaurar el valor actual.
    setText(value?.name ?? "");
  }

  function pick(item: Item) {
    if (item.type === "option") {
      onChange({ kind: "existing", id: item.option.id, name: item.option.name });
      setText(item.option.name);
    } else {
      onChange({ kind: "new", name: item.name });
      setText(item.name);
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Tab") {
      if (open) close();
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={(e) => { setOpen(true); setActive(0); e.currentTarget.select(); }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          // Mientras se escribe se anula la selección previa para no guardar un valor inconsistente.
          if (value) onChange(null);
        }}
        onKeyDown={onKeyDown}
        style={value?.kind === "new" ? { fontStyle: "italic" } : undefined}
      />
      {value?.kind === "new" && !open && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          Nuevo {entity}: se creará al guardar
        </div>
      )}
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--bg0)",
            border: "1px solid var(--stroke2)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            fontSize: 14,
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "var(--muted)" }}>Sin coincidencias</div>
          ) : (
            items.map((it, i) => {
              const isActive = i === active;
              const isSelected = it.type === "option" && value?.kind === "existing" && value.id === it.option.id;
              return (
                <div
                  key={it.type === "option" ? `o${it.option.id}` : "create"}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    background: isActive ? "rgba(14,165,233,.12)" : "transparent",
                    fontWeight: isSelected || it.type === "create" ? 600 : 400,
                    color: it.type === "create" ? "var(--sky2)" : "var(--text)",
                    borderTop: it.type === "create" && i > 0 ? "1px solid var(--stroke)" : undefined,
                  }}
                >
                  {it.type === "option" ? it.option.name : `+ Crear ${entity}: ${it.name}`}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

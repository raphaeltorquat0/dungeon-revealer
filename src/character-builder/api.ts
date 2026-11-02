import * as React from "react";
import { io } from "socket.io-client";
import { buildApiUrl, getPublicHost } from "../public-url";
import type { Character } from "./rules";

const PASSWORD_KEY = "fichas.password";

// o Dungeon Revealer guarda as senhas como JSON ("\"senha\"")
const stored = (key: string) => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value === "string" && value ? value : null;
  } catch {
    return raw;
  }
};

export const getPassword = () =>
  new URLSearchParams(window.location.search).get("password") ??
  stored(PASSWORD_KEY) ??
  // o mestre abre pela barra do Dungeon Revealer, onde a senha dele já está salva
  stored("dmPassword") ??
  stored("pcPassword") ??
  "";

export const setPassword = (password: string) =>
  window.localStorage.setItem(PASSWORD_KEY, JSON.stringify(password));

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${getPassword()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  }).catch(() => {
    throw new Error(
      "Sem conexão com o computador do mestre. Confira se o celular está no mesmo Wi-Fi e se a mesa está aberta."
    );
  });
  if (res.status === 401) throw new Error("SENHA");
  if (!res.ok)
    throw new Error(
      `O servidor da mesa respondeu com erro ${res.status}. Tente recarregar.`
    );
  return (await res.json()).data as T;
};

/** Papel da senha atual: "DM", "PC" ou null. */
export const fetchRole = () =>
  request<{ role: "DM" | "PC" | null }>("/auth").then((d) => d.role);

export const saveCharacter = (c: Character) =>
  request<Character>(`/characters/${c.id}`, {
    method: "PUT",
    body: JSON.stringify(c),
  });

export const deleteCharacter = (id: string) =>
  request(`/characters/${id}`, { method: "DELETE" });

/** Todas as fichas, atualizadas ao vivo quando alguém salva em outro aparelho. */
export const useCharacters = () => {
  const [characters, setCharacters] = React.useState<Character[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    request<Character[]>("/characters")
      .then((list) =>
        setCharacters(
          list.sort((a, b) =>
            (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
          )
        )
      )
      .catch((e) => setError(e.message));
  }, []);

  React.useEffect(() => {
    reload();
    const socket = io(getPublicHost(), { path: buildApiUrl("/socket.io") });
    socket.on("characters:changed", reload);
    return () => {
      socket.close();
    };
  }, [reload]);

  const upsertLocal = React.useCallback((c: Character) => {
    setCharacters((list) =>
      list ? [c, ...list.filter((x) => x.id !== c.id)] : [c]
    );
  }, []);

  return { characters, error, reload, upsertLocal };
};

/** Salva com atraso curto, para não mandar uma requisição por toque. */
export const useAutosave = (
  character: Character | null,
  onSaved?: (c: Character) => void
) => {
  const [status, setStatus] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const first = React.useRef(true);
  React.useEffect(() => {
    if (!character) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const t = window.setTimeout(() => {
      saveCharacter(character)
        .then((saved) => {
          setStatus("saved");
          onSaved?.(saved);
        })
        .catch(() => setStatus("error"));
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);
  return status;
};

export const newId = () =>
  (window.crypto as any).randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

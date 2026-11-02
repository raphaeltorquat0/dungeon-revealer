import * as React from "react";
import { loadSrd, Srd } from "./srd";
import {
  Character,
  decisions,
  emptyCharacter,
  isDecisionDone,
  totalLevel,
} from "./rules";
import {
  deleteCharacter,
  fetchRole,
  getPassword,
  newId,
  setPassword,
  useAutosave,
  useCharacters,
} from "./api";
import { Wizard } from "./wizard";
import { CharacterSheet, classLine } from "./sheet";
import {
  Button,
  color,
  GlobalStyle,
  H1,
  IlluminatedName,
  Input,
  Label,
  Lead,
  Muted,
  Page,
} from "./theme";

type View =
  | { kind: "list" }
  | { kind: "create"; id: string }
  | { kind: "sheet"; id: string };

const viewFromHash = (): View => {
  const [kind, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  if ((kind === "criar" || kind === "ficha") && id)
    return { kind: kind === "criar" ? "create" : "sheet", id };
  return { kind: "list" };
};

export const CharacterBuilderApp = () => {
  const [role, setRole] = React.useState<"DM" | "PC" | null | undefined>(
    undefined
  );
  React.useEffect(() => {
    fetchRole()
      .then(setRole)
      .catch(() => setRole(null));
  }, []);
  return (
    <>
      <GlobalStyle />
      {role === undefined ? (
        <Page>
          <Lead>Abrindo o grimório…</Lead>
        </Page>
      ) : role === null ? (
        <Login onLogin={(r) => setRole(r)} />
      ) : (
        <Builder />
      )}
    </>
  );
};

const Login = ({ onLogin }: { onLogin: (role: "DM" | "PC") => void }) => {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  return (
    <Page style={{ paddingTop: "18vh" }}>
      <H1>Fichas da mesa</H1>
      <Lead>
        Digite a senha dos jogadores que o mestre passou. Ela fica salva neste
        aparelho.
      </Lead>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPassword(value);
          const role = await fetchRole().catch(() => null);
          if (role) onLogin(role);
          else
            setError("Senha incorreta. Confira com o mestre e tente de novo.");
        }}
      >
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error ? <p style={{ color: "#E7A0A9" }}>{error}</p> : null}
        <Button
          tone="primary"
          type="submit"
          style={{ marginTop: 16, width: "100%" }}
          disabled={!value}
        >
          Entrar
        </Button>
      </form>
    </Page>
  );
};

const Builder = () => {
  const [srd, setSrd] = React.useState<Srd | null>(null);
  const [srdError, setSrdError] = React.useState<string | null>(null);
  const { characters, error, upsertLocal, reload } = useCharacters();
  const [view, setView] = React.useState<View>(viewFromHash);
  // rascunho local da ficha aberta: a fonte da verdade enquanto a pessoa edita
  const [draft, setDraft] = React.useState<Character | null>(null);

  React.useEffect(() => {
    loadSrd()
      .then(setSrd)
      .catch((e) => setSrdError(e.message));
  }, []);
  React.useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openId = view.kind === "list" ? null : view.id;
  React.useEffect(() => {
    if (!openId) return setDraft(null);
    if (draft?.id === openId) return;
    const found = characters?.find((c) => c.id === openId);
    if (found) setDraft(found);
    else if (view.kind === "create") setDraft(emptyCharacter(openId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, characters]);

  // outra pessoa salvou esta ficha (ex.: o mestre aplicou dano): atualiza se não houver edição local pendente
  const status = useAutosave(draft, upsertLocal);
  React.useEffect(() => {
    if (!openId || !draft || status === "saving") return;
    const remote = characters?.find((c) => c.id === openId);
    if (
      remote &&
      remote.updatedAt &&
      draft.updatedAt &&
      remote.updatedAt > draft.updatedAt
    )
      setDraft(remote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters]);

  const go = (hash: string) => {
    window.location.hash = hash;
  };

  if (srdError || error)
    return (
      <Page>
        <H1>Não deu para abrir as fichas</H1>
        <Lead>
          {error === "SENHA"
            ? "A senha salva não vale mais. Recarregue a página e digite a senha nova."
            : srdError ?? error}
        </Lead>
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </Page>
    );
  if (!srd || !characters)
    return (
      <Page>
        <Lead>Abrindo o grimório…</Lead>
      </Page>
    );

  if (view.kind !== "list" && draft) {
    if (view.kind === "create")
      return (
        <Wizard
          srd={srd}
          character={draft}
          onChange={setDraft}
          onFinish={() => go(`/ficha/${draft.id}`)}
          onExit={() => go("/")}
        />
      );
    return (
      <>
        <CharacterSheet
          srd={srd}
          character={draft}
          onChange={setDraft}
          onExit={() => go("/")}
          onEditCreation={() => go(`/criar/${draft.id}`)}
          onDelete={async () => {
            await deleteCharacter(draft.id);
            reload();
            go("/");
          }}
        />
        {status === "error" ? (
          <div
            role="alert"
            style={{
              position: "fixed",
              top: 10,
              left: 10,
              right: 10,
              padding: 12,
              borderRadius: 10,
              background: color.seal,
              color: "#fff",
              zIndex: 20,
            }}
          >
            Não consegui salvar. Confira a conexão com o computador do mestre; a
            ficha tenta de novo na próxima mudança.
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Page>
      <H1>Fichas da mesa</H1>
      <Lead>
        Toque numa ficha para abrir. As mudanças aparecem para o mestre na hora.
      </Lead>
      {characters.length === 0 ? (
        <Lead>Nenhuma ficha ainda. Crie a primeira.</Lead>
      ) : null}
      {characters.map((c) => {
        const incomplete =
          decisions(srd, c).some((d) => !isDecisionDone(d)) || !c.name.trim();
        return (
          <button
            key={c.id}
            onClick={() =>
              go(
                incomplete && !totalLevel(c)
                  ? `/criar/${c.id}`
                  : `/ficha/${c.id}`
              )
            }
            style={{
              font: "inherit",
              display: "block",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              padding: "16px 14px",
              marginBottom: 10,
              borderRadius: 14,
              border: `1px solid ${color.rule}`,
              background: color.vellum,
              color: color.ink,
            }}
          >
            <IlluminatedName name={c.name} size={48}>
              <Muted style={{ fontSize: 15 }}>
                {classLine(srd, c) || "Em criação"}
                {c.player ? `. ${c.player}` : ""}
              </Muted>
              {c.state.hp !== null && totalLevel(c) ? (
                <div style={{ fontSize: 15, marginTop: 2 }}>
                  PV {c.state.hp}
                  {incomplete ? (
                    <span style={{ color: color.gold }}>
                      . Tem escolhas pendentes
                    </span>
                  ) : null}
                </div>
              ) : null}
            </IlluminatedName>
          </button>
        );
      })}
      <Button
        tone="primary"
        style={{ width: "100%", marginTop: 10 }}
        onClick={() => go(`/criar/${newId()}`)}
      >
        Criar personagem
      </Button>
      <p
        style={{
          color: color.inkSoft,
          fontSize: 13,
          marginTop: 40,
          maxWidth: "60ch",
        }}
      >
        {srd.meta.attribution}
      </p>
    </Page>
  );
};

export { getPassword };

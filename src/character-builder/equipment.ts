// Equipamento inicial (classe e antecedente): árvore de grupos E/OU, itens, moedas e itens por categoria.
import type { Srd, SrdDoc, StartingEquipment } from "./srd";
import type { Character, InventoryItem } from "./rules";

export type EquipmentNode = StartingEquipment & { children: EquipmentNode[] };

/** Árvore do equipamento inicial com a alternativa em ouro: (A) os itens ou (B) o valor em PO. */
export const equipmentTree = (doc?: SrdDoc): EquipmentNode[] => {
  const list = doc?.startingEquipment ?? [];
  const build = (group?: string): EquipmentNode[] =>
    list
      .filter((e) => (e.group ?? undefined) === group)
      .map((e) => ({ ...e, children: build(e.id) }));
  const roots = build(undefined);
  if (!doc || !roots.length) return roots;
  // classes trazem o valor em "wealth"; antecedentes de 2024 oferecem 50 PO
  const gold = Number(doc.wealth ?? (doc.type === "background" ? 50 : 0));
  if (!gold) return roots;
  return [
    {
      id: `${doc.id}-ab`,
      type: "OR",
      children: [
        { id: `${doc.id}-a`, type: "AND", children: roots },
        {
          id: `${doc.id}-b`,
          type: "currency",
          key: "gp",
          count: gold,
          children: [],
        },
      ],
    },
  ];
};

/** Itens concretos de uma categoria ("music", "holy", "art", "game", "sim"...). */
export const categoryItems = (srd: Srd, node: StartingEquipment): SrdDoc[] =>
  Object.values(srd.docs).filter((d) => {
    if (d.rarity) return false;
    if (node.type === "tool")
      return d.type === "tool" && d.itemType?.value === node.key;
    if (node.type === "focus")
      return node.key === "holy"
        ? /holy symbol|amulet|emblem|reliquary|símbolo|amuleto|emblema|relicário/i.test(
            d.nameEn ?? d.name
          )
        : node.key === "druidic"
        ? /sprig|totem|staff|wand|yew|ramo|cajado|varinha/i.test(
            d.nameEn ?? d.name
          ) && !d.armor
        : /orb|crystal|rod|staff|wand|orbe|cristal|bastão|cajado|varinha/i.test(
            d.nameEn ?? d.name
          );
    if (node.type === "weapon")
      return (
        d.type === "weapon" &&
        (d.itemType?.value ?? "").startsWith(
          node.key === "mar" ? "martial" : "simple"
        )
      );
    if (node.type === "armor")
      return Boolean(d.armor) && d.itemType?.value === node.key;
    return false;
  });

const COIN: Record<string, keyof Character["currency"]> = {
  cp: "cp",
  sp: "sp",
  ep: "ep",
  gp: "gp",
  pp: "pp",
};

/** Escolhas pendentes: cada OU precisa de uma alternativa e cada categoria de um item. */
export const pendingEquipment = (
  srd: Srd,
  roots: EquipmentNode[],
  choice: Record<string, string>
): string[] => {
  const out: string[] = [];
  const walk = (n: EquipmentNode) => {
    if (n.type === "OR") {
      const picked = n.children.find((c) => c.id === choice[n.id]);
      if (!picked) out.push(n.id);
      else walk(picked);
    } else if (n.type === "AND") n.children.forEach(walk);
    else if (
      ["tool", "focus", "weapon", "armor"].includes(n.type) &&
      !choice[n.id]
    )
      out.push(n.id);
  };
  roots.forEach(walk);
  return out;
};

/** Inventário e moedas resultantes das escolhas. */
export const resolveEquipment = (
  srd: Srd,
  roots: EquipmentNode[],
  choice: Record<string, string>
) => {
  const items: InventoryItem[] = [];
  const currency: Partial<Character["currency"]> = {};
  const add = (itemId: string, quantity: number) => {
    const doc = srd.docs[itemId];
    if (!doc) return;
    const equipable = doc.type === "weapon" || Boolean(doc.armor);
    items.push({
      uid: `${itemId}-${items.length}`,
      itemId,
      quantity,
      equipped: equipable,
    });
    // pacotes (Pacote de Explorador etc.) entram aberto, item por item
    for (const content of doc.contents ?? []) {
      if (content.id && srd.docs[content.id])
        items.push({
          uid: `${content.id}-${items.length}`,
          itemId: content.id,
          quantity: content.quantity || 1,
        });
      else
        items.push({
          uid: `x-${items.length}`,
          name: content.name,
          quantity: content.quantity || 1,
        });
    }
  };
  const walk = (n: EquipmentNode) => {
    if (n.type === "OR") {
      const picked = n.children.find((c) => c.id === choice[n.id]);
      if (picked) walk(picked);
    } else if (n.type === "AND") n.children.forEach(walk);
    else if (n.type === "linked" && n.key) add(n.key, n.count ?? 1);
    else if (n.type === "currency" && n.key && COIN[n.key])
      currency[COIN[n.key]] = (currency[COIN[n.key]] ?? 0) + (n.count ?? 0);
    else if (choice[n.id]) add(choice[n.id], n.count ?? 1);
  };
  roots.forEach(walk);
  return { items, currency };
};

/** Rótulo curto de um nó (para as opções A/B). */
export const describeNode = (srd: Srd, n: EquipmentNode): string => {
  if (n.type === "AND" || n.type === "OR")
    return n.children
      .map((c) => describeNode(srd, c))
      .filter(Boolean)
      .join(n.type === "AND" ? ", " : " ou ");
  if (n.type === "linked")
    // referência fora do SRD: some da descrição em vez de aparecer como "item"
    return srd.docs[n.key ?? ""]
      ? `${n.count && n.count > 1 ? `${n.count} × ` : ""}${
          srd.docs[n.key ?? ""].name
        }`
      : "";
  if (n.type === "currency")
    return `${n.count} ${String(n.key)
      .toUpperCase()
      .replace("GP", "PO")
      .replace("SP", "PP")
      .replace("CP", "PC")}`;
  if (n.type === "focus")
    return n.key === "holy" ? "um símbolo sagrado" : "um foco de conjuração";
  if (n.type === "tool")
    return n.key === "music"
      ? "um instrumento musical"
      : n.key === "game"
      ? "um jogo"
      : "uma ferramenta de artesão";
  if (n.type === "weapon")
    return n.key === "mar" ? "uma arma marcial" : "uma arma simples";
  return n.type;
};

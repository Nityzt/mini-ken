export type MenuItemId = "resume" | "progress" | "inventory" | "challenges" | "controls" | "name" | "insignia" | "multiplayer" | "sign-in" | "forfeit" | "restart";
export type MenuItem = { id: MenuItemId; label: string };
export type MenuAction = "name" | "resume" | "insignia" | "multiplayer" | "sign-in" | "forfeit" | "restart" | "use-ticket" | null;
/** On the progress page `choice` is the row picked on the map, and `tab` is which of the three pages is showing. */
export type PauseMenu = { page: "main" | "progress" | "inventory" | "challenges" | "controls" | "confirm"; choice: number; tab?: number };
export type MenuKeys = { up: boolean; down: boolean; confirm: boolean; cancel: boolean; left?: boolean; right?: boolean };

export const PROGRESS_TABS = ["Rank", "Techniques", "Map"] as const;
const PROGRESS_MAP = PROGRESS_TABS.length - 1;
/** Where the progress page opens, and how many rows its map has. The map opens on what's next. */
export type ProgressMap = { goal: number; rows: number };

export const createPauseMenu = (): PauseMenu => ({ page: "main", choice: 0 });

export function menuItems(state: { forfeit: string | null; inGame: boolean; hasTare: boolean; multiplayer?: boolean; signIn?: boolean; nameLabel?: string }): MenuItem[] {
  const items: MenuItem[] = [{ id: "resume", label: "Resume" }];
  if (!state.inGame) return [...items, { id: "controls", label: "Controls" }, ...(state.forfeit ? [{ id: "forfeit" as const, label: state.forfeit }] : [])];
  items.push({ id: "progress", label: "Progress" }, { id: "inventory", label: "Inventory" }, { id: "challenges", label: "Challenges" }, { id: "controls", label: "Controls" });
  if (state.nameLabel) items.push({ id: "name", label: state.nameLabel });
  if (state.hasTare) items.push({ id: "insignia", label: "Tare insignia" });
  if (state.multiplayer) items.push({ id: "multiplayer", label: "Multiplayer" });
  if (state.signIn) items.push({ id: "sign-in", label: "Sign in to save progress" });
  if (state.forfeit) items.push({ id: "forfeit", label: state.forfeit });
  items.push({ id: "restart", label: "Restart game" });
  return items;
}

const CONFIRM_CHOICES = 2;
const CONFIRM_YES = 1;

/** The inventory screen's own step: where the cursor goes, and anything that has to happen outside the menu. */
export type InventoryStep = (choice: number, keys: Required<MenuKeys>) => { choice: number; action: MenuAction };

export function stepPauseMenu(
  menu: PauseMenu,
  items: MenuItem[],
  keys: MenuKeys,
  inventory: InventoryStep = (choice) => ({ choice, action: null }),
  progress: ProgressMap = { goal: 0, rows: 0 },
): { menu: PauseMenu; action: MenuAction } {
  if (menu.page === "inventory") {
    if (keys.cancel) return { menu: { page: "main", choice: items.findIndex((i) => i.id === "inventory") }, action: null };
    const step = inventory(menu.choice, { left: false, right: false, ...keys });
    return { menu: { ...menu, choice: step.choice }, action: step.action };
  }
  if (menu.page === "progress") {
    if (keys.confirm || keys.cancel) return { menu: { page: "main", choice: items.findIndex((i) => i.id === "progress") }, action: null };
    const tab = (((menu.tab ?? PROGRESS_MAP) + (keys.right ? 1 : 0) - (keys.left ? 1 : 0)) % PROGRESS_TABS.length + PROGRESS_TABS.length) % PROGRESS_TABS.length;
    const row = Math.min(Math.max(menu.choice + (keys.down ? 1 : 0) - (keys.up ? 1 : 0), 0), Math.max(0, progress.rows - 1));
    return { menu: { ...menu, tab, choice: tab === PROGRESS_MAP ? row : menu.choice }, action: null };
  }
  if (menu.page === "controls" || menu.page === "challenges") {
    const back: PauseMenu = { page: "main", choice: items.findIndex((i) => i.id === menu.page) };
    return { menu: keys.confirm || keys.cancel ? back : menu, action: null };
  }
  const size = menu.page === "confirm" ? CONFIRM_CHOICES : items.length;
  let choice = Math.min(menu.choice, size - 1);
  if (keys.up) choice = (choice + size - 1) % size;
  if (keys.down) choice = (choice + 1) % size;
  const next: PauseMenu = { ...menu, choice };

  if (menu.page === "confirm") {
    const backToMain: PauseMenu = { page: "main", choice: items.findIndex((i) => i.id === "restart") };
    if (keys.cancel) return { menu: backToMain, action: null };
    if (!keys.confirm) return { menu: next, action: null };
    return choice === CONFIRM_YES ? { menu: next, action: "restart" } : { menu: backToMain, action: null };
  }

  if (keys.cancel) return { menu: next, action: "resume" };
  if (!keys.confirm) return { menu: next, action: null };
  const picked = items[choice].id;
  if (picked === "progress") return { menu: { page: picked, choice: progress.goal, tab: PROGRESS_MAP }, action: null };
  if (picked === "inventory" || picked === "challenges" || picked === "controls") return { menu: { page: picked, choice: 0 }, action: null };
  if (picked === "restart") return { menu: { page: "confirm", choice: 0 }, action: null };
  return { menu: next, action: picked };
}

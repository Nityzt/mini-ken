export type MenuItemId = "resume" | "progress" | "inventory" | "challenges" | "controls" | "insignia" | "multiplayer" | "forfeit" | "restart";
export type MenuItem = { id: MenuItemId; label: string };
export type MenuAction = "resume" | "insignia" | "multiplayer" | "forfeit" | "restart" | "use-ticket" | "wear" | null;
export type PauseMenu = { page: "main" | "progress" | "inventory" | "challenges" | "controls" | "confirm"; choice: number };
export type MenuKeys = { up: boolean; down: boolean; confirm: boolean; cancel: boolean };

export const createPauseMenu = (): PauseMenu => ({ page: "main", choice: 0 });

export function menuItems(state: { forfeit: string | null; inGame: boolean; hasTare: boolean; multiplayer?: boolean }): MenuItem[] {
  const items: MenuItem[] = [{ id: "resume", label: "Resume" }];
  if (!state.inGame) return [...items, { id: "controls", label: "Controls" }, ...(state.forfeit ? [{ id: "forfeit" as const, label: state.forfeit }] : [])];
  items.push({ id: "progress", label: "Progress" }, { id: "inventory", label: "Inventory" }, { id: "challenges", label: "Challenges" }, { id: "controls", label: "Controls" });
  if (state.hasTare) items.push({ id: "insignia", label: "Tare insignia" });
  if (state.multiplayer) items.push({ id: "multiplayer", label: "Multiplayer" });
  if (state.forfeit) items.push({ id: "forfeit", label: state.forfeit });
  items.push({ id: "restart", label: "Restart game" });
  return items;
}

const CONFIRM_CHOICES = 2;
const CONFIRM_YES = 1;

export function stepPauseMenu(menu: PauseMenu, items: MenuItem[], keys: MenuKeys, inventory: readonly string[] = [], actionFor: (item: string) => MenuAction = (item) => (item === "ticket" ? "use-ticket" : null)): { menu: PauseMenu; action: MenuAction } {
  if (menu.page === "inventory") {
    if (keys.cancel) return { menu: { page: "main", choice: items.findIndex((i) => i.id === "inventory") }, action: null };
    const size = Math.max(1, inventory.length);
    const choice = (Math.min(menu.choice, size - 1) + (keys.down ? 1 : 0) + (keys.up ? size - 1 : 0)) % size;
    return { menu: { ...menu, choice }, action: keys.confirm && inventory[choice] ? actionFor(inventory[choice]) : null };
  }
  if (menu.page === "progress" || menu.page === "controls" || menu.page === "challenges") {
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
  if (picked === "progress" || picked === "inventory" || picked === "challenges" || picked === "controls") return { menu: { page: picked, choice: 0 }, action: null };
  if (picked === "restart") return { menu: { page: "confirm", choice: 0 }, action: null };
  return { menu: next, action: picked };
}

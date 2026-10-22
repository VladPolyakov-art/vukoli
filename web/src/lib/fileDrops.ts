/* D89: a file dropped where nothing takes it must not open in the tab: the browser's default replaces the app with the
 * file, and the chat, the plan and anything typed are gone. Drop zones (Composer, FileDrop) call preventDefault
 * themselves; anywhere else the drop is refused, with the no-drop cursor. */
export function guardFileDrops(target: Window = window): () => void {
  const refuse = (e: DragEvent) => {
    if (e.defaultPrevented || !e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "none";
  };
  target.addEventListener("dragover", refuse);
  target.addEventListener("drop", refuse);
  return () => {
    target.removeEventListener("dragover", refuse);
    target.removeEventListener("drop", refuse);
  };
}

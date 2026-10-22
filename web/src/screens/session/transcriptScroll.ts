/* Transcript follow logic (session.md V2.1, D49): the running transcript keeps the newest line in view unless the
 * user scrolled up to read; then a "Jump to latest" button appears and new lines do not move the view.
 * Pure (no DOM), so the rules are unit-tested; SessionView wires it to the scroller. */

export interface FollowState {
  /** The view follows new content (the user is at the bottom). */
  stuck: boolean;
  /** New content arrived while the user was reading above. */
  unread: boolean;
}

export type FollowEvent =
  /** A scroll event. `programmatic` = caused by our own scrollTo (ignored: a smooth scroll passes "not at bottom"). */
  | { type: "scroll"; atBottom: boolean; programmatic?: boolean }
  /** New or longer turns. */
  | { type: "content" }
  /** The user pressed "Jump to latest". */
  | { type: "jump" };

export const FOLLOW_START: FollowState = { stuck: true, unread: false };

/** Distance from the bottom (CSS px) that still counts as "at the bottom" (a line of slack). */
export const BOTTOM_SLACK = 48;

export function isAtBottom(scrollTop: number, scrollHeight: number, clientHeight: number, slack = BOTTOM_SLACK): boolean {
  return scrollHeight - clientHeight - scrollTop <= slack;
}

/** Next state, and whether the view should scroll to the bottom now. */
export function follow(state: FollowState, event: FollowEvent): { state: FollowState; scroll: boolean } {
  switch (event.type) {
    case "scroll":
      if (event.programmatic) return { state, scroll: false };
      return { state: event.atBottom ? { stuck: true, unread: false } : { stuck: false, unread: state.unread }, scroll: false };
    case "content":
      return state.stuck ? { state, scroll: true } : { state: { stuck: false, unread: true }, scroll: false };
    case "jump":
      return { state: { stuck: true, unread: false }, scroll: true };
  }
}

/** Show the "Jump to latest" button. */
export function showJump(state: FollowState): boolean {
  return !state.stuck;
}

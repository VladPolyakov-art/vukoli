/* Real app marks for the engines (D56): Ollama, OpenAI (the OpenAI-compatible option and Codex, D86), Claude, Antigravity
 * (D87), Gemini.
 * SVGs from @lobehub/icons-static-svg 1.90.0 (MIT) in ./logos. Colour marks (Claude, Antigravity, Gemini) render as they are;
 * mono marks (Ollama, OpenAI) are a CSS mask filled with the current text colour, so they follow the theme.
 * Decorative: the engine name is always next to the mark. */
import type { EngineId } from "../../lib/types";
import antigravity from "./logos/antigravity.svg";
import claude from "./logos/claude.svg";
import gemini from "./logos/gemini.svg";
import ollama from "./logos/ollama.svg";
import openai from "./logos/openai.svg";
import s from "./engine.module.css";

const LOGOS: Record<EngineId, { src: string; mono: boolean }> = {
  ollama: { src: ollama, mono: true },
  openai_compatible: { src: openai, mono: true },
  claude_cli: { src: claude, mono: false },
  codex_cli: { src: openai, mono: true },
  antigravity_cli: { src: antigravity, mono: false },
  gemini_live: { src: gemini, mono: false },
};

export function EngineLogo({ id }: { id: EngineId }) {
  const logo = LOGOS[id];
  if (!logo.mono) return <img className={s.logo} src={logo.src} alt="" aria-hidden="true" />;
  const mask = `url("${logo.src}") center / contain no-repeat`;
  return <span className={`${s.logo} ${s.logoMono}`} style={{ mask, WebkitMask: mask }} aria-hidden="true" />;
}

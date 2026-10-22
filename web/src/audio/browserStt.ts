/* Opt-in browser speech recognition (Web Speech API, decision D12): an alternative to the server's local STT.
 * Ported from studio.js: continuous + interim results, en-US, restarted when Chrome stops it, unsent text carried over.
 * Audio never leaves the browser through our server in this mode; Chrome may send it to its own service. */

interface RecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEventLike { resultIndex: number; results: ArrayLike<RecognitionResultLike> }
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const browserSttSupported = () => typeof window !== "undefined" && getCtor() !== null;

export class BrowserStt {
  private rec: RecognitionLike | null = null;
  private results: { text: string; final: boolean }[] = [];
  private from = 0;
  private carried: string[] = [];
  private wanted = false;
  lastResultAt = 0;
  onText?: (text: string) => void;
  onDenied?: () => void;
  /** Return true while Mike is audible and nobody interrupted: finished phrases then are echo, not an answer. */
  isEcho: () => boolean = () => false;

  start(): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;
    this.wanted = true;
    this.results = [];
    this.from = 0;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      if (this.rec !== rec) return;
      this.lastResultAt = performance.now();
      const echo = this.isEcho();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r) continue;
        this.results[i] = { text: r[0].transcript, final: r.isFinal };
        if (echo && r.isFinal && i >= this.from) {
          this.from = i + 1;
          this.carried = [];
        }
      }
      this.onText?.(this.text());
    };
    rec.onend = () => {
      if (this.rec === rec) this.carry();
      if (this.wanted && this.rec === rec) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.wanted = false;
        this.onDenied?.();
      }
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
    return true;
  }

  /** Text heard since the last consume(). */
  text(): string {
    return [...this.carried, ...this.results.slice(this.from).filter(Boolean).map((r) => r.text)]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** The text was sent or dropped: the next answer starts after it. */
  consume() {
    this.carried = [];
    this.from = this.results.length;
  }

  private carry() {
    this.carried.push(...this.results.slice(this.from).filter(Boolean).map((r) => r.text));
    this.results = [];
    this.from = 0;
  }

  stop() {
    this.wanted = false;
    const rec = this.rec;
    this.rec = null;
    try {
      rec?.abort();
    } catch {
      /* ignore */
    }
  }
}

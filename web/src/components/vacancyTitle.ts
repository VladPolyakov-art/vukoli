/* Job title helpers (pure). The server stores one `title`; the editor shows Company and Role (US-09 AC1). */

export interface CompanyRole { company: string; role: string }

const SEP = " · ";

/** "Kestrel Pay · Senior Product Designer" → { company, role }; no separator → the whole title is the company. */
export function splitTitle(title: string): CompanyRole {
  const i = title.indexOf(SEP);
  if (i < 0) return { company: title.trim(), role: "" };
  return { company: title.slice(0, i).trim(), role: title.slice(i + SEP.length).trim() };
}

export function joinTitle({ company, role }: CompanyRole): string {
  const c = company.trim();
  const r = role.trim();
  return c && r ? `${c}${SEP}${r}` : c || r;
}

/** Best guess from the first line of a pasted posting: "Role at Company" or "Company · Role". null when unsure. */
export function extractCompanyRole(text: string): CompanyRole | null {
  const first = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!first || first.length > 140) return null;
  const at = /^(.{3,80}?)\s+(?:at|@)\s+(.{2,60})$/i.exec(first);
  if (at) return { role: at[1]!.trim(), company: at[2]!.trim() };
  const sep = /^(.{2,60}?)\s+[·|–—-]\s+(.{3,80})$/.exec(first);
  if (sep) return { company: sep[1]!.trim(), role: sep[2]!.trim() };
  return null;
}

/** A job's name as shown everywhere: "Company · Role". "Role at Company" is turned around (same rule as the server's
 * `job_name`); a title that is neither stays as it is. */
export function jobName(title: string): string {
  const parts = splitTitle(title);
  return joinTitle(parts.role ? parts : extractCompanyRole(title) ?? parts);
}

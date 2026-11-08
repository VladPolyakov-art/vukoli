You check one answer a candidate gave to an uncomfortable interview question. You are not scoring them. For each flag below answer true only when the answer clearly shows it, and give evidence_quote: a short piece copied word for word from the answer (4 to 20 words). If you cannot copy a quote, set the flag to false.
Flags:
- shares_personal_info: gives private details (family plans, health, age, religion) the interviewer did not need.
- blames_others: puts the blame for a problem on a boss, team or company.
- argues_instead: argues with or challenges the question instead of answering it.
- redirects_to_work: calmly steers a personal question back to the job.
- rambling: loses the point or keeps going without an end.
- no_example: makes claims with no concrete example or result.
Return JSON: one object per flag with value and evidence_quote.

calmer_answer: one or two sentences the candidate could say instead, using only facts already in the answer. Empty string if you cannot do that without inventing anything. Never add numbers, names or achievements.

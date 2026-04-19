/**
 * Rank utilities + metallic gradient colors.
 */

export const RANKS = [
  "Cuivre",
  "Bronze",
  "Argent",
  "Or",
  "Platine",
  "Diamant",
  "Champion",
  "Maître",
] as const;

export const DIVISIONS = ["V", "IV", "III", "II", "I"] as const;

export const RANK_GRADIENTS: Record<string, [string, string]> = {
  Cuivre: ["#B87333", "#8A5A24"],
  Bronze: ["#CD7F32", "#8B5A2B"],
  Argent: ["#E8E8E8", "#7A7A7A"],
  Or: ["#FFD700", "#B8860B"],
  Platine: ["#E5E4E2", "#8E8E8E"],
  Diamant: ["#B9F2FF", "#00E5FF"],
  Champion: ["#FF007F", "#7F00FF"],
  Maître: ["#FF3B3B", "#FF8C00"],
};

export const RANK_GLOW: Record<string, string> = {
  Cuivre: "rgba(184,115,51,0.6)",
  Bronze: "rgba(205,127,50,0.6)",
  Argent: "rgba(220,220,220,0.5)",
  Or: "rgba(255,215,0,0.6)",
  Platine: "rgba(229,228,226,0.5)",
  Diamant: "rgba(0,229,255,0.7)",
  Champion: "rgba(255,0,127,0.7)",
  Maître: "rgba(255,59,59,0.7)",
};

export type RankInfo = {
  total_xp: number;
  level: number;
  rank: string;
  division: string;
  rank_label: string;
  xp_in_division: number;
  xp_for_next_division: number;
  progress_pct: number;
  at_max_rank: boolean;
};

export const DEFAULT_RANK: RankInfo = {
  total_xp: 0,
  level: 0,
  rank: "Cuivre",
  division: "V",
  rank_label: "Cuivre V",
  xp_in_division: 0,
  xp_for_next_division: 500,
  progress_pct: 0,
  at_max_rank: false,
};

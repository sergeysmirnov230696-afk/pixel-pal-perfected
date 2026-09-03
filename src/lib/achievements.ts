export type AchievementSpec = {
  key: string;
  /** metric used to measure the progress */
  metric: "dragons" | "deposited" | "referrals" | "streak" | "collected";
  goal: number;
  reward: number;
};

export const ACHIEVEMENTS: AchievementSpec[] = [
  { key: "first_dragon", metric: "dragons", goal: 1, reward: 0.05 },
  { key: "small_lair", metric: "dragons", goal: 5, reward: 0.25 },
  { key: "big_lair", metric: "dragons", goal: 15, reward: 1 },
  { key: "first_deposit", metric: "deposited", goal: 5, reward: 0.1 },
  { key: "whale", metric: "deposited", goal: 100, reward: 2 },
  { key: "friend", metric: "referrals", goal: 1, reward: 0.1 },
  { key: "clan", metric: "referrals", goal: 5, reward: 0.75 },
  { key: "week_streak", metric: "streak", goal: 7, reward: 0.5 },
  { key: "collector", metric: "collected", goal: 10, reward: 0.3 },
  { key: "hoarder", metric: "collected", goal: 100, reward: 1.5 },
];

export type BoostSpec = { id: string; hours: number; multiplier: number; price: number };

export const BOOSTS: BoostSpec[] = [
  { id: "x2_12h", hours: 12, multiplier: 2, price: 1 },
  { id: "x2_24h", hours: 24, multiplier: 2, price: 1.8 },
  { id: "x3_12h", hours: 12, multiplier: 3, price: 3 },
];

export const DAILY_BASE_REWARD = 0.01;
export const DAILY_MAX_STREAK = 10;

export function dailyReward(streak: number) {
  return +(DAILY_BASE_REWARD * Math.min(Math.max(streak, 1), DAILY_MAX_STREAK)).toFixed(6);
}

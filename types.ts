
export interface NoteArticle {
  id: string;
  title: string;
  url?: string;
  publishDate: string;
  pv: number;
  like: number;
  comment: number;
  likeRate: number; // Calculated: (Like / PV) * 100
}

export interface GrowthRecord {
  date: string;
  totalPv: number;
  totalLike: number;
  totalComment: number;
  articleCount?: number;
  dailyPv?: number;
  dailyLike?: number;
  ma14_pv?: number;
}

export interface DashboardData {
  articles: NoteArticle[];
  growthLog: GrowthRecord[];
  lastUpdated: string;
  isMock: boolean;
  connectionError?: string;
  debugRows?: string[][]; // New: Raw CSV rows for debugging
}

export enum TimeRange {
  WEEK = '7d',
  MONTH = '30d',
  ALL = 'all'
}

export interface AppSettings {
  sheetId: string;
  articleGid: string;
  growthLogGid: string;
}
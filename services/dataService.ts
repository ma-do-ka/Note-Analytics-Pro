
import { NoteArticle, GrowthRecord, DashboardData, AppSettings } from '../types';
import Papa from 'papaparse';

// Proxies
const PROXY_ALLORIGINS = 'https://api.allorigins.win/raw?url=';
const PROXY_CORSPROXY = 'https://corsproxy.io/?';

// --- MOCK DATA (Fallback) ---
const MOCK_ARTICLES: NoteArticle[] = [
  { id: '1', title: '応援したいひとの...', publishDate: '2024-02-14', pv: 12040, like: 450, comment: 12, likeRate: 3.7 },
  { id: '2', title: '実験住宅 MEMU EARTH HOTEL', publishDate: '2024-02-15', pv: 8500, like: 320, comment: 8, likeRate: 3.76 },
];

const generateGrowthLog = (): GrowthRecord[] => {
  const data: GrowthRecord[] = [];
  let currentPv = 500;
  let currentLike = 20;
  const startDate = new Date('2024-01-29');

  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dailyPv = Math.floor(Math.random() * 150) + 50;
    const dailyLike = Math.floor(Math.random() * 15);
    
    currentPv += dailyPv;
    currentLike += dailyLike;
    
    // Use manual formatting to match the new parseDate behavior
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    data.push({
      date: `${year}-${month}-${day}`,
      totalPv: currentPv,
      totalLike: currentLike,
      totalComment: Math.floor(currentLike * 0.05),
      articleCount: 10 + i,
      dailyPv: dailyPv,
      dailyLike: dailyLike
    });
  }
  return data;
};

const MOCK_GROWTH = generateGrowthLog();

// --- PARSING HELPERS ---

const cleanStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

// Convert Full-width to Half-width (Zenku-to-Hanku)
const toHalfWidth = (str: string): string => {
  return str.replace(/[！-～]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  }).replace(/　/g, ' ');
};

const normalize = (str: string): string => {
  if (!str) return '';
  const half = toHalfWidth(str);
  return half.replace(/[\s\r\n]+/g, '').toLowerCase();
};

const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const norm = toHalfWidth(String(val));
  const cleanVal = norm.replace(/[^\d.-]/g, '');
  return parseFloat(cleanVal) || 0;
};

const parseDate = (val: any): string | null => {
  if (!val) return null;
  let s = toHalfWidth(String(val)).trim();
  if (!s) return null;
  
  // Handle 2025/11/22 21:22:00 -> 2025-11-22 21:22:00
  // Also handle Japanese date format 2024年1月1日
  s = s.replace(/\//g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
  
  // Remove time part if exists to focus on date
  // (Note: simple split is safer than regex for various formats)
  if (s.includes(' ')) {
    s = s.split(' ')[0];
  } else if (s.includes('T')) {
    s = s.split('T')[0];
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;

  // IMPORTANT: Use local time methods (getFullYear, etc.) to construct the string.
  // toISOString() uses UTC, which shifts dates back by 1 day for JST (GMT+9).
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// --- HEADER DEFINITIONS ---

interface ColumnMapping {
  [key: string]: number;
}

const ARTICLE_HEADERS = {
  title: ['記事タイトル', 'タイトル', 'title'],
  publishDate: ['公開日', '日', 'date', 'published'], 
  pv: ['pv数', 'pv', 'view', 'ビュー'],
  like: ['スキ数', 'スキ', 'like'],
  comment: ['コメント数', 'コメント', 'comment'],
  url: ['記事url', 'url', 'link']
};

const GROWTH_HEADERS = {
  date: ['記録日時', '記録日', '日時', 'date'],
  totalPv: ['総pv数', '総pv', 'totalpv', '全体ビュー'],
  totalLike: ['総スキ数', '総スキ', 'totallike', '全体スキ'],
  totalComment: ['総コメント数', 'totalcomment', '全体コメント'],
  articleCount: ['記事数', 'articlecount']
};

// Fuzzy finder for headers
const findHeaderRow = (rows: string[][], headerDefs: Record<string, string[]>): { rowIndex: number, map: ColumnMapping } | null => {
  // Scan first 50 rows
  for (let r = 0; r < Math.min(rows.length, 50); r++) {
    const row = rows[r];
    const map: ColumnMapping = {};
    let matchCount = 0;

    for (const [field, candidates] of Object.entries(headerDefs)) {
      for (let c = 0; c < row.length; c++) {
        const cellText = normalize(String(row[c] || ''));
        // Partial match: "総pv数" contains "pv"
        if (candidates.some(cand => cellText.includes(normalize(cand)))) {
          map[field] = c;
          matchCount++;
          break; // Found column for this field
        }
      }
    }

    // We need at least the Primary Key (Title or Date) and one metric to consider it a valid table
    const hasPrimary = (map['title'] !== undefined) || (map['date'] !== undefined);
    
    if (hasPrimary && matchCount >= 2) {
      return { rowIndex: r, map };
    }
  }
  return null;
};

export const fetchData = async (settings: AppSettings): Promise<DashboardData> => {
  let allDebugRows: string[][] = [];
  let finalArticles: NoteArticle[] = [];
  let finalGrowthLog: GrowthRecord[] = [];
  
  interface FetchTask {
    name: string;
    url: string;
  }

  const tasks: FetchTask[] = [];

  // 1. Latest Articles Tasks
  if (settings.articleGid) {
    tasks.push({
      name: `Articles (GID:${settings.articleGid}) Export`,
      url: `https://docs.google.com/spreadsheets/d/${settings.sheetId}/export?format=csv&gid=${settings.articleGid}`
    });
    tasks.push({
      name: `Articles (GID:${settings.articleGid}) Gviz`,
      url: `https://docs.google.com/spreadsheets/d/${settings.sheetId}/gviz/tq?tqx=out:csv&gid=${settings.articleGid}`
    });
  }

  // 2. Growth Log Tasks
  if (settings.growthLogGid) {
    tasks.push({
      name: `Growth (GID:${settings.growthLogGid}) Export`,
      url: `https://docs.google.com/spreadsheets/d/${settings.sheetId}/export?format=csv&gid=${settings.growthLogGid}`
    });
    tasks.push({
      name: `Growth (GID:${settings.growthLogGid}) Gviz`,
      url: `https://docs.google.com/spreadsheets/d/${settings.sheetId}/gviz/tq?tqx=out:csv&gid=${settings.growthLogGid}`
    });
  }
  
  console.log(`Starting fetch of ${tasks.length} endpoints for Sheet ${settings.sheetId}...`);

  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      // Random buster to bypass cache
      const cb = `&cb=${Date.now()}`;
      
      // Try 1: Direct Fetch (Google's gviz endpoint sometimes allows CORS)
      if (task.url.includes('gviz')) {
        try {
          const res = await fetch(task.url + cb);
          if (res.ok) {
            const text = await res.text();
            if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
              return { taskName: task.name, text, proxy: 'Direct' };
            }
          }
        } catch (e) {
          console.warn('Direct fetch failed for', task.name);
        }
      }

      // Try 2: AllOrigins JSON API (More reliable than raw)
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(task.url + cb)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.contents && !data.contents.includes('<!DOCTYPE html') && !data.contents.includes('<html')) {
            return { taskName: task.name, text: data.contents, proxy: 'AllOriginsJSON' };
          }
        }
      } catch (e) {
        console.warn('AllOrigins JSON failed for', task.name);
      }

      // Try 3: CodeTabs Proxy
      try {
        const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(task.url + cb)}`);
        if (res.ok) {
          const text = await res.text();
          if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
            return { taskName: task.name, text, proxy: 'CodeTabs' };
          }
        }
      } catch (e) {
        console.warn('CodeTabs failed for', task.name);
      }

      // Try 4: CorsProxy.io
      try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(task.url + cb)}`);
        if (res.ok) {
          const text = await res.text();
           if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
            return { taskName: task.name, text, proxy: 'CorsProxy' };
          }
        }
      } catch (e) {
        console.warn('CorsProxy failed for', task.name);
      }

      throw new Error('All fetch methods failed for ' + task.name);
    })
  );

  // Process Results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const taskName = tasks[i].name;

    if (result.status === 'rejected') {
      continue;
    }

    const { text } = result.value;
    
    try {
      const parsed = Papa.parse(text, { header: false, skipEmptyLines: false });
      const rows = parsed.data as string[][];

      if (!rows || rows.length === 0) continue;

      // Log success for debugging
      allDebugRows.push([`--- SUCCESS: ${taskName} ---`]);
      allDebugRows = allDebugRows.concat(rows.slice(0, 3)); // Show first 3 rows

      // --- Try to find Articles Table ---
      const artHeader = findHeaderRow(rows, ARTICLE_HEADERS);
      if (artHeader) {
        const { rowIndex, map } = artHeader;
        for (let r = rowIndex + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          
          const titleIdx = map['title'];
          if (titleIdx === undefined || !row[titleIdx]) continue;
          
          const title = cleanStr(row[titleIdx]);
          if (!title || normalize(title).includes('タイトル')) continue;

          // Parse Publish Date
          let pubDate = 'delete';
          if (map['publishDate'] !== undefined) {
             const p = parseDate(row[map['publishDate']]);
             if (p) pubDate = p;
          }

          finalArticles.push({
            id: `art-${i}-${r}`,
            title,
            url: map['url'] !== undefined ? cleanStr(row[map['url']]) : undefined,
            publishDate: pubDate,
            pv: map['pv'] !== undefined ? parseNumber(row[map['pv']]) : 0,
            like: map['like'] !== undefined ? parseNumber(row[map['like']]) : 0,
            comment: map['comment'] !== undefined ? parseNumber(row[map['comment']]) : 0,
            likeRate: 0
          });
        }
      }

      // --- Try to find Growth Log Table ---
      const growHeader = findHeaderRow(rows, GROWTH_HEADERS);
      if (growHeader) {
        const { rowIndex, map } = growHeader;
        for (let r = rowIndex + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          
          const dateIdx = map['date'];
          if (dateIdx === undefined || !row[dateIdx]) continue;

          const dateStr = cleanStr(row[dateIdx]);
          if (!dateStr || normalize(dateStr).includes('記録')) continue;
          
          const dateIso = parseDate(dateStr);
          if (!dateIso) continue;

          finalGrowthLog.push({
            date: dateIso,
            totalPv: map['totalPv'] !== undefined ? parseNumber(row[map['totalPv']]) : 0,
            totalLike: map['totalLike'] !== undefined ? parseNumber(row[map['totalLike']]) : 0,
            totalComment: map['totalComment'] !== undefined ? parseNumber(row[map['totalComment']]) : 0,
            articleCount: map['articleCount'] !== undefined ? parseNumber(row[map['articleCount']]) : 0,
          });
        }
      }

    } catch (e: any) {
      allDebugRows.push([`[ERROR] Parsing ${taskName}: ${e.message}`]);
    }
  }

  // Deduplicate and Sort
  
  // Unique Articles by Title
  const uniqueArticles = new Map<string, NoteArticle>();
  finalArticles.forEach(a => {
    if (!uniqueArticles.has(a.title)) {
      a.likeRate = a.pv > 0 ? (a.like / a.pv) * 100 : 0;
      uniqueArticles.set(a.title, a);
    }
  });
  finalArticles = Array.from(uniqueArticles.values());

  // Unique Growth Log by Date
  const uniqueGrowth = new Map<string, GrowthRecord>();
  finalGrowthLog.forEach(g => {
    // With new parseDate, g.date is already 'YYYY-MM-DD'
    const dateKey = g.date;
    
    const existing = uniqueGrowth.get(dateKey);
    if (!existing || (g.totalPv > existing.totalPv)) {
      uniqueGrowth.set(dateKey, g);
    }
  });
  
  // Sort by date ascending (String comparison works for YYYY-MM-DD)
  finalGrowthLog = Array.from(uniqueGrowth.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate Daily Diffs
  for (let i = 0; i < finalGrowthLog.length; i++) {
    const current = finalGrowthLog[i];
    if (i === 0) {
      current.dailyPv = 0;
      current.dailyLike = 0;
    } else {
      const prev = finalGrowthLog[i - 1];
      current.dailyPv = Math.max(0, current.totalPv - prev.totalPv);
      current.dailyLike = Math.max(0, current.totalLike - prev.totalLike);
    }
  }

  // FEATURE: Hide the very first data point after calculation.
  // This allows the user to include a "base day" (e.g. Nov 22) to calculate the daily growth for the next day (Nov 23),
  // but only show the graph starting from Nov 23.
  if (finalGrowthLog.length >= 2) {
    finalGrowthLog.shift();
  }

  const hasData = finalArticles.length > 0 || finalGrowthLog.length > 0;

  if (!hasData) {
    return {
      articles: MOCK_ARTICLES,
      growthLog: MOCK_GROWTH,
      lastUpdated: new Date().toLocaleString(),
      isMock: true,
      connectionError: `Data could not be found in Sheet ${settings.sheetId}. Checked GIDs ${settings.articleGid} & ${settings.growthLogGid}.`,
      debugRows: allDebugRows
    };
  }

  return {
    articles: finalArticles,
    growthLog: finalGrowthLog,
    lastUpdated: new Date().toLocaleString(),
    isMock: false,
    debugRows: allDebugRows
  };
};

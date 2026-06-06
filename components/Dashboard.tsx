
import React, { useEffect, useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Activity, Heart, MessageCircle, TrendingUp, Wand2, RefreshCw, Database, AlertTriangle, HelpCircle, X, ExternalLink, FileText, AlertCircle, ArrowUpDown, CheckSquare, Square, Trash2, AlertOctagon, Calendar, Filter, BarChart3 } from 'lucide-react';
import { fetchData } from '../services/dataService';
import { generateInsights } from '../services/geminiService';
import { DashboardData, NoteArticle, AppSettings } from '../types';
import { StatCard } from './StatCard';

const COLORS = {
  primary: '#3b82f6', // Blue
  secondary: '#ec4899', // Pink
  tertiary: '#f97316', // Orange
  accent: '#10b981', // Emerald
  grid: '#334155',
  text: '#94a3b8'
};

type SortKey = keyof NoteArticle;
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface DashboardProps {
  settings: AppSettings;
  onReset: () => void;
}

type RankTimeFilter = 'all' | '3m' | '1m' | '2w' | '1w';
type RankLimit = 10 | 20 | 30;

const GrowthTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-xs z-50">
        <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
          {label}
        </p>
        <div className="grid grid-cols-1 gap-y-1">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
             <span className="text-slate-300">Total PV: <span className="font-mono font-bold">{payload.find((p: any) => p.dataKey === 'totalPv')?.value?.toLocaleString() ?? 0}</span></span>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-pink-500"></div>
             <span className="text-slate-300">Total Likes: <span className="font-mono font-bold">{payload.find((p: any) => p.dataKey === 'totalLike')?.value?.toLocaleString() ?? 0}</span></span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DailyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-xs z-50">
        <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
          {label}
        </p>
         <div className="grid grid-cols-1 gap-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-blue-500"></div>
            <span className="text-slate-300">Daily PV: <span className="font-mono">{payload.find((p: any) => p.dataKey === 'dailyPv')?.value?.toLocaleString() ?? 0}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-blue-500 border border-slate-400 border-dashed" style={{ backgroundColor: 'transparent' }}></div>
            <span className="text-slate-300">PV (14-day MA): <span className="font-mono">{payload.find((p: any) => p.dataKey === 'ma14_pv')?.value?.toLocaleString() ?? 0}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-pink-500"></div>
            <span className="text-slate-300">Daily Likes: <span className="font-mono">{payload.find((p: any) => p.dataKey === 'dailyLike')?.value?.toLocaleString() ?? 0}</span></span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Helper for date formatting
const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '';
  // Expecting YYYY-MM-DD string directly now
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  return dateStr;
};

export const Dashboard: React.FC<DashboardProps> = ({ settings, onReset }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // New States for Filter and Sort
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'publishDate', direction: 'desc' });

  // States for Top Articles Chart
  const [rankTimeFilter, setRankTimeFilter] = useState<RankTimeFilter>('all');
  const [rankLimit, setRankLimit] = useState<RankLimit>(10);

  // Reset Button State
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // Growth Date Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    // Pass user settings to fetchData
    const result = await fetchData(settings);
    setData(result);
    // Initialize date filters based on min/max of growthLog
    if (result.growthLog && result.growthLog.length > 0) {
      setStartDate(result.growthLog[0].date);
      setEndDate(result.growthLog[result.growthLog.length - 1].date);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [settings]);

  // --- Filter and Sort Logic ---

  const filteredArticles = useMemo(() => {
    if (!data) return [];
    return data.articles.filter(article => {
      if (showDeleted) return true;
      return article.publishDate !== 'delete';
    });
  }, [data, showDeleted]);

  const handleAnalyze = async () => {
    if (!data) return;
    setAnalyzing(true);
    const result = await generateInsights(filteredArticles, data.growthLog, showDeleted);
    setInsight(result);
    setAnalyzing(false);
  };

  const enhancedGrowthLog = useMemo(() => {
    if (!data?.growthLog) return [];
    
    return data.growthLog.map((record, index, array) => {
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, index - 13); i <= index; i++) {
        sum += array[i].dailyPv || 0;
        count++;
      }
      return {
        ...record,
        ma14_pv: count > 0 ? Math.round(sum / count) : 0
      };
    });
  }, [data?.growthLog]);

  const filteredGrowthLog = useMemo(() => {
    if (!enhancedGrowthLog) return [];
    return enhancedGrowthLog.filter(record => {
      if (startDate && record.date < startDate) return false;
      if (endDate && record.date > endDate) return false;
      return true;
    });
  }, [enhancedGrowthLog, startDate, endDate]);

  const sortedArticles = useMemo(() => {
    const sorted = [...filteredArticles];
    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === 'publishDate') {
        if (aValue === 'delete') return 1; 
        if (bValue === 'delete') return -1;
      }

      if (aValue === undefined || bValue === undefined) return 0;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredArticles, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };
  
  const latestGrowth = data?.growthLog.length && data.growthLog.length > 0 ? data.growthLog[data.growthLog.length - 1] : null;
  
  const totalPv = latestGrowth ? latestGrowth.totalPv : (data?.articles.reduce((sum, a) => sum + a.pv, 0) || 0);
  const totalLikes = latestGrowth ? latestGrowth.totalLike : (data?.articles.reduce((sum, a) => sum + a.like, 0) || 0);
  const totalComments = latestGrowth ? latestGrowth.totalComment : (data?.articles.reduce((sum, a) => sum + a.comment, 0) || 0);
  const totalArticles = latestGrowth && latestGrowth.articleCount ? latestGrowth.articleCount : (data?.articles.length || 0);

  // Ranked Articles Logic with Date Filter and Limit
  const rankedArticles = useMemo(() => {
    let source = [...filteredArticles];

    if (rankTimeFilter !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();

      switch (rankTimeFilter) {
        case '3m':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case '1m':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case '2w':
          cutoffDate.setDate(now.getDate() - 14);
          break;
        case '1w':
          cutoffDate.setDate(now.getDate() - 7);
          break;
      }

      source = source.filter(article => {
        if (article.publishDate === 'delete' || !article.publishDate) return false;
        const pubDate = new Date(article.publishDate);
        return !isNaN(pubDate.getTime()) && pubDate >= cutoffDate;
      });
    }

    return source.sort((a, b) => b.pv - a.pv).slice(0, rankLimit);
  }, [filteredArticles, rankTimeFilter, rankLimit]);

  const maxPv = useMemo(() => Math.max(...filteredArticles.map(a => a.pv), 100), [filteredArticles]);
  const maxLike = useMemo(() => Math.max(...filteredArticles.map(a => a.like), 10), [filteredArticles]);

  const isPartial = data && !data.isMock && (data.articles.length === 0 || data.growthLog.length === 0);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mr-2" />
        Loading Analytics...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative flex flex-col">
      
      <div className="p-4 md:p-6 lg:p-8 pb-32"> {/* Added bottom padding for fixed footer */}
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 w-2 h-8 rounded-full display-block"></span>
                Note Analytics
              </h1>
              
              <button 
                onClick={() => setShowHelp(true)}
                className={`px-3 py-1 text-xs font-bold rounded border flex items-center gap-1 transition-all cursor-pointer hover:scale-105
                  ${data.isMock 
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' 
                    : isPartial 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
              >
                {data.isMock ? (
                  <><AlertTriangle className="w-3 h-3" /> Connection Failed</>
                ) : isPartial ? (
                  <><AlertCircle className="w-3 h-3" /> Partial Data</>
                ) : (
                  <><Database className="w-3 h-3" /> Live Data</>
                )}
              </button>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Sheet ID: {settings.sheetId.substring(0, 8)}... | Last updated: {data.lastUpdated} 
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showDeleted} 
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="hidden"
              />
              {showDeleted ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-slate-500" />}
              削除済みデータも反映する
            </label>

             <button 
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-lg transition-all text-sm font-medium disabled:opacity-50"
            >
              {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : 'AI Consultant Insight'}
            </button>
          </div>
        </div>

        {/* AI Insight Panel */}
        {insight && (
          <div className="mb-8 bg-slate-900/50 border border-indigo-500/30 rounded-xl p-6 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-indigo-500/20 rounded-lg">
                 <Wand2 className="w-5 h-5 text-indigo-400" />
               </div>
               <h3 className="text-lg font-semibold text-indigo-100">Consultant Recommendations</h3>
            </div>
            <div 
              className="prose prose-invert prose-sm max-w-none text-slate-300"
              dangerouslySetInnerHTML={{ __html: insight }} 
            />
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Total Page Views" 
            value={totalPv.toLocaleString()} 
            subValue="Cumulative Growth" 
            icon={Activity} 
            color="text-blue-500" 
          />
          <StatCard 
            title="Total Likes" 
            value={totalLikes.toLocaleString()} 
            subValue="Community Engagement" 
            icon={Heart} 
            color="text-pink-500" 
          />
          <StatCard 
            title="Total Comments" 
            value={totalComments.toLocaleString()} 
            subValue="User Interactions" 
            icon={MessageCircle} 
            color="text-emerald-500" 
          />
          <StatCard 
            title="Total Articles" 
            value={totalArticles} 
            subValue="Content Library" 
            icon={TrendingUp} 
            color="text-orange-500" 
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Growth Date Filter Controls */}
          {data.growthLog.length > 0 && (
            <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-4">
              <span className="text-slate-300 font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                期間指定:
              </span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 text-sm"
                />
                <span className="text-slate-500">〜</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* 1. Growth Trajectory (Line Chart) - Full Width */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Growth Trajectory (Cumulative)
            </h3>
            {filteredGrowthLog.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredGrowthLog} margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      padding={{ left: 0, right: 0 }}
                      tickFormatter={formatDateLabel}
                      stroke={COLORS.text} 
                      tick={{fontSize: 12}}
                    />
                    
                    {/* Left Axis: Total PV */}
                    <YAxis 
                      yAxisId="left" 
                      stroke={COLORS.primary} 
                      tick={{fontSize: 12}} 
                      tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                    />
                    
                    {/* Right Axis: Total Likes */}
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke={COLORS.secondary} 
                      tick={{fontSize: 12}} 
                    />

                    <Tooltip content={<GrowthTooltip />} />
                    <Legend iconType="circle" />
                    
                    {/* Total Stats Lines */}
                    <Line yAxisId="left" type="monotone" dataKey="totalPv" name="Total PV" stroke={COLORS.primary} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="totalLike" name="Total Likes" stroke={COLORS.secondary} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="h-[300px] w-full flex flex-col items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded bg-slate-800/50">
                 <AlertTriangle className="w-8 h-8 mb-2 opacity-50 text-amber-500" />
                 <p>No growth log data found.</p>
                 <p className="text-xs mt-1 text-slate-600">Checked GID {settings.growthLogGid}</p>
               </div>
            )}
          </div>

          {/* 2. Daily Growth (Line Chart) - Full Width */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm">
             <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Daily Growth
            </h3>
            {filteredGrowthLog.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredGrowthLog} margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDateLabel}
                      stroke={COLORS.text} 
                      tick={{fontSize: 12}}
                      tickLine={false}
                    />
                    <YAxis yAxisId="left" stroke={COLORS.primary} tick={{fontSize: 12}} />
                    <YAxis yAxisId="right" orientation="right" stroke={COLORS.secondary} tick={{fontSize: 12}} />
                    <Tooltip content={<DailyTooltip />} />
                    <Legend iconType="circle" />
                    
                    <Line yAxisId="left" type="monotone" dataKey="dailyPv" name="Daily PV" stroke={COLORS.primary} strokeWidth={1} strokeOpacity={0.6} dot={false} activeDot={{ r: 6 }} />
                    <Line yAxisId="left" type="monotone" dataKey="ma14_pv" name="PV (14-day MA)" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="dailyLike" name="Daily Likes" stroke={COLORS.secondary} strokeWidth={1} strokeOpacity={0.6} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex flex-col items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded bg-slate-800/50">
                 <AlertTriangle className="w-8 h-8 mb-2 opacity-50 text-amber-500" />
                 <p>No growth log data found.</p>
              </div>
            )}
          </div>

          {/* 3. Top Articles (Moved) */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm flex flex-col">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
               <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Top {rankLimit} Articles
                {!showDeleted && <span className="text-xs text-slate-500 font-normal hidden xl:inline">(Active Only)</span>}
              </h3>
              
              <div className="flex items-center gap-2 text-xs">
                <div className="relative">
                  <select 
                    value={rankTimeFilter}
                    onChange={(e) => setRankTimeFilter(e.target.value as RankTimeFilter)}
                    className="appearance-none bg-slate-900 border border-slate-600 text-slate-300 rounded px-3 py-1 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="all">記事すべて</option>
                    <option value="3m">3ヶ月以内</option>
                    <option value="1m">1ヶ月以内</option>
                    <option value="2w">2週間以内</option>
                    <option value="1w">1週間以内</option>
                  </select>
                  <Calendar className="w-3 h-3 absolute right-2 top-1.5 text-slate-500 pointer-events-none" />
                </div>
                
                <div className="relative">
                  <select 
                    value={rankLimit}
                    onChange={(e) => setRankLimit(Number(e.target.value) as RankLimit)}
                    className="appearance-none bg-slate-900 border border-slate-600 text-slate-300 rounded px-3 py-1 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="10">Top 10</option>
                    <option value="20">Top 20</option>
                    <option value="30">Top 30</option>
                  </select>
                  <Filter className="w-3 h-3 absolute right-2 top-1.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {rankedArticles.length > 0 ? (
              <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankedArticles} margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                    <XAxis 
                      dataKey="title" 
                      stroke={COLORS.text} 
                      tick={false} 
                      label={{ value: 'Articles', position: 'insideBottom', offset: -5, fill: COLORS.text }}
                    />
                    <YAxis yAxisId="left" stroke={COLORS.primary} tick={{fontSize: 12}} />
                    <YAxis yAxisId="right" orientation="right" stroke={COLORS.accent} tick={{fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="pv" name="PV" fill={COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="right" dataKey="likeRate" name="L/P Rate %" fill={COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex flex-col items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded bg-slate-800/50">
                 <AlertTriangle className="w-8 h-8 mb-2 opacity-50 text-amber-500" />
                 <p>No article data matches filter.</p>
              </div>
            )}
          </div>

          {/* 4. Correlation (Scatter Chart) */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm">
             <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Correlation: Views vs Likes
              </div>
              {!showDeleted && <span className="text-xs text-slate-500 font-normal">(Active Only)</span>}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis 
                    type="number" 
                    dataKey="pv" 
                    name="PV" 
                    stroke={COLORS.text} 
                    label={{ value: 'PV', position: 'insideBottomRight', offset: -10, fill: COLORS.text }} 
                  />
                  <YAxis 
                    type="number" 
                    dataKey="like" 
                    name="Likes" 
                    stroke={COLORS.text} 
                    label={{ value: 'Like', angle: -90, position: 'insideLeft', fill: COLORS.text }} 
                  />
                  <ZAxis type="number" dataKey="likeRate" range={[50, 400]} name="Rate" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-lg">
                            <p className="text-slate-200 text-sm font-bold mb-1">{data.title}</p>
                            <p className="text-blue-400 text-xs">PV: {data.pv}</p>
                            <p className="text-pink-400 text-xs">Likes: {data.like}</p>
                            <p className="text-emerald-400 text-xs">Rate: {data.likeRate.toFixed(2)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter name="Articles" data={filteredArticles} fill={COLORS.secondary}>
                    {filteredArticles.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? COLORS.secondary : COLORS.primary} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Latest Article Details (Table) - Full Width */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-orange-400" />
              Latest Article Details
              {!showDeleted && <span className="text-xs text-slate-500 font-normal ml-auto">(Active Only)</span>}
            </h3>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              {sortedArticles.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 sticky top-0">
                    <tr>
                      <th 
                        className="px-4 py-3 rounded-l-lg cursor-pointer hover:bg-slate-700 transition-colors group select-none"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center gap-1">
                          Title 
                          <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'title' ? 'text-blue-400 opacity-100' : 'opacity-30'}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 w-24 cursor-pointer hover:bg-slate-700 transition-colors group select-none"
                        onClick={() => handleSort('pv')}
                      >
                        <div className="flex items-center gap-1">
                          PV
                           <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'pv' ? 'text-blue-400 opacity-100' : 'opacity-30'}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 w-24 cursor-pointer hover:bg-slate-700 transition-colors group select-none"
                        onClick={() => handleSort('like')}
                      >
                        <div className="flex items-center gap-1">
                          Like
                           <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'like' ? 'text-blue-400 opacity-100' : 'opacity-30'}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 w-32 rounded-r-lg cursor-pointer hover:bg-slate-700 transition-colors group select-none"
                        onClick={() => handleSort('publishDate')}
                      >
                        <div className="flex items-center gap-1">
                          Date
                           <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'publishDate' ? 'text-blue-400 opacity-100' : 'opacity-30'}`} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {sortedArticles.map((article) => (
                      <tr key={article.id} className={`hover:bg-slate-700/30 transition-colors ${article.publishDate === 'delete' ? 'bg-red-900/10' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-300 max-w-[200px]">
                           <div className="truncate" title={article.title}>
                              {article.url ? (
                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 flex items-center gap-1">
                                  {article.title} <ExternalLink className="w-3 h-3 inline opacity-50" />
                                </a>
                              ) : article.title}
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 bg-blue-500/30 rounded-full flex-1 min-w-[40px] max-w-[60px] overflow-hidden">
                               <div className="h-full bg-blue-500" style={{ width: `${Math.min((article.pv / maxPv) * 100, 100)}%` }}></div>
                            </div>
                             <span className="text-xs text-slate-400">{article.pv}</span>
                          </div>
                        </td>
                         <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 bg-pink-500/30 rounded-full flex-1 min-w-[40px] max-w-[60px] overflow-hidden">
                               <div className="h-full bg-pink-500" style={{ width: `${Math.min((article.like / maxLike) * 100, 100)}%` }}></div>
                            </div>
                             <span className="text-xs text-slate-400">{article.like}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {article.publishDate === 'delete' ? (
                            <span className="px-2 py-1 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-1 w-fit">
                               delete
                            </span>
                          ) : (
                            new Date(article.publishDate).toLocaleDateString('ja-JP')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-slate-500">No article data matches criteria.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Fixed Footer with Reset - High Z-Index */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur border-t border-slate-800 py-4 flex justify-center z-50 shadow-2xl">
        <button 
          onClick={() => {
            if (isResetConfirming) {
              onReset();
            } else {
              setIsResetConfirming(true);
              // Auto-cancel confirmation after 5 seconds if not clicked
              setTimeout(() => setIsResetConfirming(false), 5000);
            }
          }}
          className={`flex items-center gap-2 text-sm transition-all py-3 px-8 rounded-lg font-bold shadow-lg transform duration-200
            ${isResetConfirming 
              ? 'bg-red-600 text-white scale-105 animate-pulse shadow-red-500/50 ring-2 ring-red-400' 
              : 'bg-slate-900 text-red-400 border border-red-500/30 hover:bg-red-500/10'
            }`}
        >
          {isResetConfirming ? (
            <>
              <AlertOctagon className="w-5 h-5" />
              本当に初期化しますか？ (クリックで実行)
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              初期化する
            </>
          )}
        </button>
      </div>

      {/* Connection Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-5xl w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-400" />
                Troubleshooting & Debugger
              </h2>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left: Instructions */}
              <div className="space-y-4 text-slate-300 text-sm">
                {data.connectionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="font-semibold text-red-400">Error Message:</p>
                    <p className="font-mono text-xs mt-1">{data.connectionError}</p>
                  </div>
                )}

                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                   <h3 className="font-semibold text-white mb-2">Connection Targets</h3>
                   <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-blue-400 block mb-1">Growth Log</span>
                         <p>GID: {settings.growthLogGid}</p>
                      </div>
                      <div>
                        <span className="text-orange-400 block mb-1">Article List</span>
                         <p>GID: {settings.articleGid}</p>
                      </div>
                   </div>
                </div>

                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400">
                  <p><strong>Note on Google Sheets:</strong></p>
                  <p>We are using a "Shotgun" approach, trying multiple API endpoints and proxies. If you see "ERROR" in the log on the right, it means that specific method failed, but others might have succeeded.</p>
                </div>
              </div>

              {/* Right: Raw Data Preview */}
              <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col h-[500px]">
                 <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Fetch Logs & Raw Data
                 </h3>
                 <div className="flex-1 overflow-auto bg-black rounded border border-slate-800 p-2 font-mono text-xs whitespace-pre">
                    {data.debugRows && data.debugRows.length > 0 ? (
                      data.debugRows.map((row, i) => (
                        <div key={i} className="border-b border-slate-900 pb-1 mb-1">
                           {row.length === 1 && row[0].startsWith('--- SUCCESS') ? (
                             <span className="text-emerald-400 font-bold block pt-2">{row[0]}</span>
                           ) : row.length === 1 && row[0].startsWith('[ERROR]') ? (
                             <span className="text-red-400 block">{row[0]}</span>
                           ) : row.length === 1 && row[0].startsWith('[WARN]') ? (
                             <span className="text-amber-400 block">{row[0]}</span>
                           ) : (
                             <>
                                <span className="text-slate-600 select-none mr-2">{i}:</span>
                                {row.map((cell, j) => (
                                  <span key={j} className="mr-3 inline-block text-slate-300 border-r border-slate-800 pr-2 min-w-[20px]">
                                    {cell === "" ? <span className="text-slate-700 italic">empty</span> : cell}
                                  </span>
                                ))}
                             </>
                           )}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 italic p-4">No logs available.</div>
                    )}
                 </div>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${settings.sheetId}/edit`, '_blank')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors text-sm"
              >
                Open Google Sheet
              </button>
              <button 
                onClick={() => { setShowHelp(false); loadData(); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

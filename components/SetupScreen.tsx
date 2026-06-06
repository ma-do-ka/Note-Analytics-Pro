
import React, { useState } from 'react';
import { Settings, Save, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';
import { fetchData } from '../services/dataService';

interface SetupScreenProps {
  onSave: (settings: AppSettings) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onSave }) => {
  const [sheetId, setSheetId] = useState('');
  const [articleGid, setArticleGid] = useState('');
  const [growthLogGid, setGrowthLogGid] = useState('');
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to extract ID from URL if user pastes full URL
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Check if it looks like a URL
    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      setSheetId(match[1]);
    } else {
      setSheetId(val);
    }
  };

  // Helper to extract GID from URL if user pastes full URL
  const handleGidChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Check for gid parameter in URL (e.g. #gid=12345 or ?gid=12345)
    const match = val.match(/[#&?]gid=(\d+)/);
    if (match && match[1]) {
      setter(match[1]);
    } else {
      setter(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSheetId = sheetId.trim();
    const cleanArticleGid = articleGid.trim();
    const cleanGrowthLogGid = growthLogGid.trim();

    // 1. Basic Input Validation
    if (!cleanSheetId) {
      setError('スプレッドシートIDは必須です。');
      return;
    }
    if (!cleanArticleGid && !cleanGrowthLogGid) {
      setError('少なくとも1つのGID（記事リストまたは成長記録）が必要です。');
      return;
    }

    // 2. Connection & Data Validation
    setIsVerifying(true);
    
    const tempSettings: AppSettings = {
      sheetId: cleanSheetId,
      articleGid: cleanArticleGid,
      growthLogGid: cleanGrowthLogGid
    };

    try {
      // Attempt to fetch real data
      const result = await fetchData(tempSettings);

      // Check 1: General Connection
      if (result.isMock) {
        throw new Error(
          'スプレッドシートにアクセスできませんでした。\n共有設定が「リンクを知っている全員」になっているか確認してください。\nまた、IDが正しいかも確認してください。'
        );
      }

      // Check 2: Article Data Integrity (if GID provided)
      if (cleanArticleGid && result.articles.length === 0) {
        throw new Error(
          `記事リスト（GID: ${cleanArticleGid}）にアクセスできましたが、有効なデータが見つかりませんでした。\nヘッダー名（タイトル、PV数など）が正しいか、データが空でないか確認してください。`
        );
      }

      // Check 3: Growth Log Integrity (if GID provided)
      if (cleanGrowthLogGid && result.growthLog.length === 0) {
         throw new Error(
          `成長記録（GID: ${cleanGrowthLogGid}）にアクセスできましたが、有効なデータが見つかりませんでした。\nヘッダー名（記録日時、総PV数など）が正しいか確認してください。`
        );
      }

      // Validation Passed
      onSave(tempSettings);

    } catch (err: any) {
      console.error(err);
      setError(err.message || '接続確認中に予期せぬエラーが発生しました。');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Note Analytics 初期設定
          </h1>
          <p className="text-slate-400">
            Googleスプレッドシートを接続してデータの可視化を始めましょう。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Tips Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 space-y-2">
            <h3 className="font-semibold text-white flex flex-wrap items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>重要：シートの権限設定</span>
            </h3>
            <div className="space-y-1">
              <p>
                アプリがデータにアクセスするには、スプレッドシートの共有設定を<span className="text-white font-bold mx-1">「リンクを知っている全員（閲覧者）」</span>にする必要があります。
              </p>
            </div>
            <div className="pt-2 border-t border-slate-700/50 mt-2">
              <p className="text-xs text-slate-500">
                ※設定はブラウザに保存されます。サーバーにデータは保存されません。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                GoogleスプレッドシートID（またはURL）
              </label>
              <input
                type="text"
                value={sheetId}
                onChange={handleIdChange}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <p className="text-xs text-slate-500 mt-1">
                URLをそのまま貼り付けても、自動的にIDが抽出されます。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  最新記事リストシートのGID
                </label>
                <input
                  type="text"
                  value={articleGid}
                  onChange={handleGidChange(setArticleGid)}
                  placeholder="URLまたはGID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  成長記録ログシートのGID
                </label>
                <input
                  type="text"
                  value={growthLogGid}
                  onChange={handleGidChange(setGrowthLogGid)}
                  placeholder="URLまたはGID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

             <div className="bg-slate-800/30 p-3 rounded-lg flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-400">
                  <p className="font-medium text-slate-300 mb-1">
                    URL自動抽出に対応
                  </p>
                  <p className="text-slate-400">
                    すべての項目で、スプレッドシートのURLをそのまま貼り付け可能です。GIDもURL（#gid=...）から自動的に抽出されます。
                  </p>
                </div>
              </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-lg whitespace-pre-line">
              <p className="font-bold mb-1 flex items-center gap-1">
                 <AlertCircle className="w-4 h-4" /> 設定エラー
              </p>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2
              ${isVerifying 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 transform hover:scale-[1.01]'
              }`}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>接続確認中...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>保存して接続</span>
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};


import { GoogleGenAI } from "@google/genai";
import { NoteArticle, GrowthRecord } from "../types";

export const generateInsights = async (
  articles: NoteArticle[], 
  growthLog: GrowthRecord[], 
  includeDeleted: boolean
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "API Key is missing. Please ensure process.env.API_KEY is set.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prepare data summary based on the filtered articles passed in
  const totalPv = articles.reduce((sum, a) => sum + a.pv, 0);
  const totalLikes = articles.reduce((sum, a) => sum + a.like, 0);
  const avgLikeRate = totalPv > 0 ? ((totalLikes / totalPv) * 100).toFixed(2) : "0";

  // Sort by PV to identify top performers for the context
  const sortedArticles = [...articles].sort((a, b) => b.pv - a.pv);
  const topArticles = sortedArticles.slice(0, 10).map(a => 
    `- "${a.title}" (Date: ${a.publishDate}): ${a.pv} PV, ${a.like} Likes (${a.likeRate.toFixed(1)}% Rate)`
  ).join('\n');

  const recentGrowth = growthLog.slice(-7).map(g => 
    `${g.date.split('T')[0]}: ${g.totalPv} Total PV`
  ).join(', ');

  const prompt = `
    あなたは、高度な統計的洞察力を持つプロフェッショナルなデータアナリストです。
    Note（ブログプラットフォーム）のパフォーマンスデータを分析し、クライアントに戦略的な改善案を提示してください。

    **分析条件:**
    - 削除済みデータの分析: ${includeDeleted ? '含む (全てのデータを考慮)' : '含まない (アクティブな記事のみ分析)'}
    
    **データサマリー:**
    - 分析対象記事数: ${articles.length}
    - 合計PV: ${totalPv.toLocaleString()}
    - 合計スキ数: ${totalLikes.toLocaleString()}
    - 平均エンゲージメント率 (Like/PV): ${avgLikeRate}%

    **直近の成長トレンド (総PV推移):**
    ${recentGrowth}

    **トップパフォーマンス記事 (PV順):**
    ${topArticles}

    **依頼内容:**
    上記の定量的データに基づき、以下の3点について論理的かつ具体的な分析を行ってください。
    回答は必ずHTMLのリスト形式 (<ul><li>...</li></ul>) で出力し、余計な挨拶は省略してください。

    1. **要因分析 (Performance Drivers)**:
       数字が伸びている記事の共通点（タイトル構成、公開タイミング、トピックの傾向など）を特定し、なぜそれがユーザーに刺さったのかを分析してください。

    2. **改善施策 (Optimization Strategy)**:
       エンゲージメント率（スキ率）を向上させるための具体的な施策を提案してください。データに基づいた仮説を提示すること。

    3. **次回アクション (Strategic Recommendation)**:
       「次に書くべき記事」のテーマや方向性を、過去の成功データに基づいて具体的に提案してください。

    **トーン＆マナー:**
    冷静、客観的、プロフェッショナル。データに基づかない精神論は排除してください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "インサイトを生成できませんでした。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "インサイトの生成に失敗しました。後でもう一度お試しください。";
  }
};
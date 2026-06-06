import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon: Icon, color }) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-100 mt-1">{value}</h3>
          {subValue && <p className="text-slate-500 text-xs mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-opacity-20 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
};
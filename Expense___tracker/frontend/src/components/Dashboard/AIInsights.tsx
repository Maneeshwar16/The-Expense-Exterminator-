import React from 'react';
import { TrendingUp, AlertTriangle, Target, Lightbulb } from 'lucide-react';
import { AIInsight } from '../../types';

interface AIInsightsProps {
  insights: AIInsight[];
}

const AIInsights: React.FC<AIInsightsProps> = ({ insights }) => {
  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'overspending':
        return AlertTriangle;
      case 'trend':
        return TrendingUp;
      case 'prediction':
        return Target;
      case 'suggestion':
        return Lightbulb;
      default:
        return Lightbulb;
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'overspending':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      case 'trend':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400';
      case 'prediction':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400';
      case 'suggestion':
        return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-2 mb-6">
        <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Insights
        </h3>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => {
          const Icon = getInsightIcon(insight.type);
          const colorClasses = getInsightColor(insight.type);

          return (
            <div
              key={index}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${colorClasses}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {insight.description}
                  </p>
                  {insight.value && insight.previousValue && (
                    <div className="mt-2 flex items-center space-x-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        Previous: ₹{insight.previousValue.toLocaleString()}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">→</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Current: ₹{insight.value.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIInsights;
import React from "react";
import { Transaction } from "../../types";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";

interface Props {
  transactions: Transaction[];
}

const IncomeStatsCard: React.FC<Props> = ({ transactions }) => {
  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpend = Math.abs(
    transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
  );

  const netBalance = totalIncome - totalSpend;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total Income */}
      <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg shadow-md flex items-center">
        <ArrowUpCircle className="text-green-600 dark:text-green-300 mr-3" size={32} />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Income</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            ₹{totalIncome.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Total Spend */}
      <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg shadow-md flex items-center">
        <ArrowDownCircle className="text-red-600 dark:text-red-300 mr-3" size={32} />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Spend</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            ₹{totalSpend.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Net Balance */}
      <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg shadow-md flex items-center">
        <Wallet className="text-blue-600 dark:text-blue-300 mr-3" size={32} />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Net Balance</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            ₹{netBalance.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IncomeStatsCard;

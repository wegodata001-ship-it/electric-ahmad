"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { formatCurrency } from "@/utils/format";

type ChartRow = { name: string; completed: number; remaining: number };
type ProgressRow = { month: string; planned: number; actual: number };

/** Isolated so recharts can be route-split via next/dynamic. */
export function DashboardCharts({
  chartData,
  progressData,
}: {
  chartData: ChartRow[];
  progressData: ProgressRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card padding="md" className="sm:p-6">
        <CardHeader>
          <CardTitle>שווי ביצוע לפי פרויקט</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`}
                  fontSize={12}
                />
                <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar
                  dataKey="completed"
                  name="שבוצע"
                  fill="#2563eb"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="remaining"
                  name="נותר"
                  fill="#e2e8f0"
                  radius={[0, 4, 4, 0]}
                />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card padding="md" className="sm:p-6">
        <CardHeader>
          <CardTitle>התקדמות חודשית</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="planned"
                  name="מתוכנן"
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="בפועל"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

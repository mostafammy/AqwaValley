"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SoilMoistureChartProps {
  data: {
    name: string;
    wheat: number;
    beet: number;
    palms: number;
  }[];
}

export function SoilMoistureChart({ data }: SoilMoistureChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: -20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            stroke="#94a3b8" 
            fontSize={13} 
            tickLine={false} 
            axisLine={false} 
            dy={8}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={13} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              borderRadius: '16px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ paddingBottom: 20, fontSize: 13 }}
          />
          <Line 
            type="monotone" 
            dataKey="wheat" 
            name="قمح (منطقة أ)" 
            stroke="#D97706" 
            strokeWidth={3} 
            dot={{ r: 4 }} 
            animationDuration={1500}
            animationBegin={0}
          />
          <Line 
            type="monotone" 
            dataKey="beet" 
            name="بنجر (منطقة ب)" 
            stroke="#0D9E7E" 
            strokeWidth={3} 
            dot={{ r: 4 }} 
            animationDuration={1500}
            animationBegin={300}
          />
          <Line 
            type="monotone" 
            dataKey="palms" 
            name="نخيل (منطقة ج)" 
            stroke="#1D6FA8" 
            strokeWidth={3} 
            dot={{ r: 4 }} 
            animationDuration={1500}
            animationBegin={600}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
"use client";

import { useState } from "react";

interface TroopSliderProps {
  label: string;
  color: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export default function TroopSlider({
  label,
  color,
  value,
  onChange,
  max = 100,
}: TroopSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setLocalValue(v);
    onChange(v);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-sm font-medium" style={{ color }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={localValue}
        onChange={handleChange}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-wos-panel-light"
        style={{
          accentColor: color,
        }}
      />
      <span className="w-10 text-right text-sm text-gray-300">
        {localValue}%
      </span>
    </div>
  );
}

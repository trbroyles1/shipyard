"use client";

import { useState, useEffect } from "react";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const UPDATE_INTERVAL_MS = 60_000;

interface RelativeTimeProps {
  date: string;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const d = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(d / MS_PER_MINUTE);
  const hours = Math.floor(d / MS_PER_HOUR);
  const days = Math.floor(d / MS_PER_DAY);

  if (minutes < 1) return "just now";
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  return `${days}d ago`;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [text, setText] = useState(() => timeAgo(date));

  useEffect(() => {
    setText(timeAgo(date));
    const interval = setInterval(() => setText(timeAgo(date)), UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <time dateTime={date} className={className} title={new Date(date).toLocaleString()}>
      {text}
    </time>
  );
}

export function hoursOld(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / MS_PER_HOUR;
}

"use client";

import { useState, useEffect } from "react";

interface RelativeTimeProps {
  date: string;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const d = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(d / 60000);
  const hours = Math.floor(d / 3600000);
  const days = Math.floor(d / 86400000);

  if (minutes < 1) return "just now";
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  return `${days}d ago`;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [text, setText] = useState(() => timeAgo(date));

  useEffect(() => {
    setText(timeAgo(date));
    const interval = setInterval(() => setText(timeAgo(date)), 60000);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <time dateTime={date} className={className} title={new Date(date).toLocaleString()}>
      {text}
    </time>
  );
}

export function hoursOld(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000;
}

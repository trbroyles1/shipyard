"use client";

import { useEffect, useRef, useState, useId } from "react";
import styles from "./MermaidBlock.module.css";

interface Props {
  code: string;
}

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;
let mermaidCounter = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      mod.default.initialize({ startOnLoad: false, theme: "dark" });
      return mod;
    });
  }
  return mermaidPromise;
}

export function MermaidBlock({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idSuffix = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;

    loadMermaid()
      .then(async (mod) => {
        if (cancelled || !containerRef.current) return;
        const diagramId = `mermaid-${idSuffix}-${mermaidCounter++}`;
        try {
          const { svg } = await mod.default.render(diagramId, code);
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to render diagram");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load mermaid");
        }
      });

    return () => { cancelled = true; };
  }, [code, idSuffix]);

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorLabel}>Diagram render error</div>
        <pre className={styles.errorCode}>{code}</pre>
      </div>
    );
  }

  return <div ref={containerRef} className={styles.container} />;
}

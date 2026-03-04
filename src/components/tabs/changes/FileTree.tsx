"use client";

import { useMemo } from "react";
import type { EnrichedDiffFile } from "@/lib/types/gitlab";
import { XIcon, DocumentIcon, FolderIcon } from "@/components/shared/icons";
import styles from "./FileTree.module.css";

const FILE_PADDING_BASE = 12;
const DIR_PADDING_BASE = 8;
const DEPTH_INDENT = 14;

interface Props {
  files: EnrichedDiffFile[];
  selectedFile: string | null;
  onSelect: (path: string | null) => void;
  onClose: () => void;
}

// A tree node is either a directory (children map) or a file leaf
interface TreeDir {
  [key: string]: TreeDir | EnrichedDiffFile;
}

function isFile(node: TreeDir | EnrichedDiffFile): node is EnrichedDiffFile {
  return "new_path" in node || "old_path" in node;
}

function buildTree(files: EnrichedDiffFile[]): TreeDir {
  const root: TreeDir = {};
  for (const f of files) {
    const path = f.new_path || f.old_path;
    const parts = path.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (i === parts.length - 1) {
        cursor[seg] = f;
      } else {
        if (!cursor[seg] || isFile(cursor[seg])) {
          cursor[seg] = {};
        }
        cursor = cursor[seg] as TreeDir;
      }
    }
  }
  return root;
}

export function FileTree({ files, selectedFile, onSelect, onClose }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className={styles.tree}>
      <div className={styles.header}>
        <span>Files ({files.length})</span>
        <button className={styles.close} onClick={onClose} title="Hide file tree">
          <XIcon size={12} />
        </button>
      </div>
      <button
        className={`${styles.file} ${selectedFile === null ? styles.selected : ""}`}
        onClick={() => onSelect(null)}
      >
        <DocumentIcon size={12} />
        <span className={styles.fileName}>All files</span>
      </button>
      {renderNodes(tree, 0, selectedFile, onSelect)}
    </div>
  );
}

function renderNodes(
  node: TreeDir,
  depth: number,
  selectedFile: string | null,
  onSelect: (path: string | null) => void,
): React.ReactNode[] {
  const entries = Object.entries(node);
  // Sort: directories first, then files, alphabetical within each group
  entries.sort(([aKey, aVal], [bKey, bVal]) => {
    const aIsFile = isFile(aVal);
    const bIsFile = isFile(bVal);
    if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
    return aKey.localeCompare(bKey);
  });

  const result: React.ReactNode[] = [];
  for (const [name, value] of entries) {
    if (isFile(value)) {
      const path = value.new_path || value.old_path;
      result.push(
        <button
          key={path}
          className={`${styles.file} ${selectedFile === path ? styles.selected : ""}`}
          style={{ paddingLeft: FILE_PADDING_BASE + depth * DEPTH_INDENT }}
          onClick={() => onSelect(path)}
          title={path}
        >
          <DocumentIcon size={12} />
          <span className={styles.fileName}>{name}</span>
          <span className={styles.stats}>
            <span className={styles.additions}>+{value.additions}</span>
            <span className={styles.deletions}>-{value.deletions}</span>
          </span>
        </button>,
      );
    } else {
      result.push(
        <div key={`dir-${depth}-${name}`}>
          <div className={styles.folderLabel} style={{ paddingLeft: DIR_PADDING_BASE + depth * DEPTH_INDENT }}>
            <FolderIcon size={12} />
            <span>{name}</span>
          </div>
          {renderNodes(value as TreeDir, depth + 1, selectedFile, onSelect)}
        </div>,
      );
    }
  }
  return result;
}

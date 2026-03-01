"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import type { MRDetailData } from "@/hooks/use-mr-detail";
import { ChangesTab } from "./ChangesTab";
import { CommitsTab } from "./CommitsTab";
import { DiscussionsTab } from "./DiscussionsTab";
import { PipelineTab } from "./PipelineTab";
import { HistoryTab } from "./HistoryTab";
import styles from "./TabContent.module.css";

interface Props {
  data: MRDetailData;
  onRefetch: () => Promise<void>;
}

export function TabContent({ data, onRefetch }: Props) {
  const { activeTab } = useAppState();

  return (
    <div className={styles.tabContent}>
      {activeTab === "changes" && <ChangesTab diffs={data.diffs} discussions={data.discussions} projectId={data.mr.project_id} iid={data.mr.iid} onRefetch={onRefetch} />}
      {activeTab === "commits" && <CommitsTab commits={data.commits} />}
      {activeTab === "discussions" && <DiscussionsTab discussions={data.discussions} projectId={data.mr.project_id} iid={data.mr.iid} onRefetch={onRefetch} />}
      {activeTab === "pipeline" && <PipelineTab pipelines={data.pipelines} mr={data.mr} />}
      {activeTab === "history" && <HistoryTab notes={data.notes} />}
    </div>
  );
}

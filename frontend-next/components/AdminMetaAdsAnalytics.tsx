"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { MetaAdsCampaignSummary, MetaAdsSummary } from "../lib/meta";
import { useMetaTracking } from "./MetaTrackingProvider";

type Props = {
  all: MetaAdsSummary;
  campaigns: MetaAdsCampaignSummary[];
};

export default function AdminMetaAdsAnalytics({ all, campaigns }: Props) {
  const { merchTrackingEnabled } = useMetaTracking();
  const [selectedKey, setSelectedKey] = useState("all");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = [
    { key: "all", label: "All" },
    ...campaigns.map((campaign) => ({ key: campaign.campaignId, label: campaign.campaignName }))
  ];
  const selected = campaigns.find((campaign) => campaign.campaignId === selectedKey) || all;
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.key === selectedKey));

  function selectTab(index: number) {
    const nextIndex = (index + tabs.length) % tabs.length;
    setSelectedKey(tabs[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(selectedIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(selectedIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(tabs.length - 1);
    }
  }

  return (
    <>
      <div className="meta-ads-tabs" role="tablist" aria-label="Active advertising campaigns">
        {tabs.map((tab, index) => {
          const isSelected = tab.key === selectedKey;
          return (
            <button
              ref={(element) => { tabRefs.current[index] = element; }}
              key={tab.key}
              id={`meta-ads-tab-${tab.key}`}
              className={`meta-ads-tab${isSelected ? " is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="meta-ads-campaign-panel"
              tabIndex={isSelected ? 0 : -1}
              title={tab.label}
              onClick={() => setSelectedKey(tab.key)}
              onKeyDown={handleTabKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id="meta-ads-campaign-panel"
        role="tabpanel"
        aria-labelledby={`meta-ads-tab-${tabs[selectedIndex].key}`}
      >
        <div className="meta-ads-metrics" aria-label={`${tabs[selectedIndex].label} advertising metrics`}>
          <article><strong>£{selected.spend.toFixed(2)}</strong><span>Spend</span></article>
          <article><strong>{selected.reach.toLocaleString("en-GB")}</strong><span>Reach</span></article>
          <article><strong>{selected.impressions.toLocaleString("en-GB")}</strong><span>Impressions</span></article>
          <article><strong>{selected.linkClicks.toLocaleString("en-GB")}</strong><span>Link clicks</span></article>
          <article><strong>{selected.ctr.toFixed(2)}%</strong><span>CTR</span></article>
          <article><strong>£{selected.cpc.toFixed(2)}</strong><span>CPC</span></article>
          <article><strong>{selected.purchases.toLocaleString("en-GB")}</strong><span>{merchTrackingEnabled ? "Purchases" : "Ticket purchases"}</span></article>
          <article><strong>£{selected.purchaseValue.toFixed(2)}</strong><span>{merchTrackingEnabled ? "Purchase value" : "Ticket purchase value"}</span></article>
        </div>
      </div>
    </>
  );
}

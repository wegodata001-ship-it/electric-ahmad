"use client";

import { useMemo } from "react";
import { HubEntityCard } from "./hub-tree-cards";
import type {
  HubCompany,
  HubContractor,
  HubNodeKind,
  HubProject,
  HubRegion,
  HubSite,
  SelectedHubNode,
} from "./hub-tree-types";

const SIZE: Record<HubNodeKind, { w: number; h: number }> = {
  company: { w: 320, h: 148 },
  region: { w: 236, h: 132 },
  project: { w: 248, h: 154 },
  site: { w: 228, h: 136 },
  contractor: { w: 216, h: 124 },
};

const GAP_X = 20;
const GAP_Y = 36;
const PAD = 16;

type TreeItem = {
  id: string;
  kind: HubNodeKind;
  w: number;
  h: number;
  node: SelectedHubNode;
  title: string;
  lines: string[];
  status?: string;
  expanded: boolean;
  hasChildren: boolean;
  children: TreeItem[];
};

type LaidNode = Omit<TreeItem, "children"> & { x: number; y: number };
type LaidEdge = { id: string; x1: number; y1: number; x2: number; y2: number };

function extrasFor(project: HubProject) {
  const siteContractorIds = new Set(
    project.sites.flatMap((s) => s.contractors.map((c) => c.id))
  );
  return project.contractors.filter((c) => !c.workSiteId && !siteContractorIds.has(c.id));
}

export function collectExpandableKeys(regions: HubRegion[]) {
  const keys = ["company:root"];
  for (const region of regions) {
    keys.push(`region:${region.id}`);
    for (const project of region.projects) {
      keys.push(`project:${project.id}`);
      for (const site of project.sites) keys.push(`site:${site.id}`);
    }
  }
  return keys;
}

export function resolveHubNode(
  company: HubCompany,
  regions: HubRegion[],
  nodeId: string
): SelectedHubNode | null {
  if (nodeId === "company:root") return { kind: "company", company };
  const [kind, id] = nodeId.split(":") as [HubNodeKind, string];
  for (const region of regions) {
    if (kind === "region" && region.id === id) return { kind: "region", region };
    for (const project of region.projects) {
      if (kind === "project" && project.id === id) return { kind: "project", region, project };
      const site = project.sites.find((s) => s.id === id);
      if (kind === "site" && site) return { kind: "site", region, project, site };
      const fromProject = project.contractors.find((c) => c.id === id);
      const fromSite = project.sites
        .flatMap((s) => s.contractors.map((c) => ({ site: s, contractor: c })))
        .find((c) => c.contractor.id === id);
      if (kind === "contractor" && (fromProject || fromSite)) {
        return {
          kind: "contractor",
          region,
          project,
          site: fromSite?.site,
          contractor: fromProject ?? fromSite!.contractor,
        };
      }
    }
  }
  return null;
}

function subtreeWidth(item: TreeItem): number {
  if (!item.children.length) return item.w;
  const kids = item.children.reduce(
    (sum, child, i) => sum + subtreeWidth(child) + (i ? GAP_X : 0),
    0
  );
  return Math.max(item.w, kids);
}

function layoutTree(item: TreeItem, left: number, top: number, nodes: LaidNode[], edges: LaidEdge[]) {
  const sw = subtreeWidth(item);
  const x = left + (sw - item.w) / 2;
  nodes.push({
    id: item.id,
    kind: item.kind,
    w: item.w,
    h: item.h,
    node: item.node,
    title: item.title,
    lines: item.lines,
    status: item.status,
    expanded: item.expanded,
    hasChildren: item.hasChildren,
    x,
    y: top,
  });
  if (!item.children.length) return;
  const kidsW = item.children.reduce(
    (sum, child, i) => sum + subtreeWidth(child) + (i ? GAP_X : 0),
    0
  );
  let cx = left + (sw - kidsW) / 2;
  const childTop = top + item.h + GAP_Y;
  for (const child of item.children) {
    edges.push({
      id: `${item.id}->${child.id}`,
      x1: x + item.w / 2,
      y1: top + item.h,
      x2: cx + subtreeWidth(child) / 2,
      y2: childTop,
    });
    layoutTree(child, cx, childTop, nodes, edges);
    cx += subtreeWidth(child) + GAP_X;
  }
}

function elbow(e: LaidEdge) {
  const mid = e.y1 + (e.y2 - e.y1) / 2;
  return `M ${e.x1} ${e.y1} L ${e.x1} ${mid} L ${e.x2} ${mid} L ${e.x2} ${e.y2}`;
}

export function HubOrgTree({
  company,
  regions,
  expanded,
  selectedId,
  onToggle,
  onDetails,
  totals,
}: {
  company: HubCompany;
  regions: HubRegion[];
  expanded: Record<string, boolean>;
  selectedId: string | null;
  onToggle: (node: SelectedHubNode) => void;
  onDetails: (node: SelectedHubNode) => void;
  totals?: { regions: number; projects: number };
}) {
  const { nodes, edges, width, height } = useMemo(() => {
    const companyOpen = expanded["company:root"] !== false;
    const root: TreeItem = {
      id: "company:root",
      kind: "company",
      ...SIZE.company,
      node: { kind: "company", company },
      title: company.name,
      lines: [
        `${totals?.regions ?? regions.filter((r) => !r.unassigned).length} אזורי עבודה`,
        `${totals?.projects ?? regions.reduce((n, r) => n + r.projectCount, 0)} פרויקטים`,
      ],
      status: "פעיל",
      expanded: companyOpen,
      hasChildren: regions.length > 0,
      children: [],
    };

    if (companyOpen) {
      root.children = [...regions].reverse().map((region) => {
        const regionId = `region:${region.id}`;
        const regionOpen = Boolean(expanded[regionId]);
        const regionNode: TreeItem = {
          id: regionId,
          kind: "region",
          ...SIZE.region,
          node: { kind: "region", region },
          title: region.name,
          lines: [`${region.projectCount} פרויקטים`, `${region.siteCount} סניפים`],
          status: region.unassigned ? "ממתין לשיוך" : "פעיל",
          expanded: regionOpen,
          hasChildren: region.projects.length > 0,
          children: [],
        };
        if (!regionOpen) return regionNode;
        regionNode.children = region.projects.map((project) => {
          const projectId = `project:${project.id}`;
          const projectOpen = Boolean(expanded[projectId]);
          const extras = extrasFor(project);
          const projectNode: TreeItem = {
            id: projectId,
            kind: "project",
            ...SIZE.project,
            node: { kind: "project", region, project },
            title: project.name,
            lines: [
              project.contractNumber,
              project.contractor,
              project.ownerName ? `מנהל: ${project.ownerName}` : "ללא מנהל פרויקט",
            ],
            status: project.statusLabel,
            expanded: projectOpen,
            hasChildren: project.sites.length + extras.length > 0,
            children: [],
          };
          if (!projectOpen) return projectNode;
          projectNode.children = [
            ...project.sites.map((site) => {
              const siteId = `site:${site.id}`;
              const siteOpen = Boolean(expanded[siteId]);
              const siteNode: TreeItem = {
                id: siteId,
                kind: "site",
                ...SIZE.site,
                node: { kind: "site", region, project, site },
                title: site.name,
                lines: [
                  site.contactName ? `מנהל שטח: ${site.contactName}` : "ללא מנהל שטח",
                  `${site.contractorCount} קבלני משנה`,
                ],
                status: site.status === "active" ? "פעיל" : site.status,
                expanded: siteOpen,
                hasChildren: site.contractors.length > 0,
                children: [],
              };
              if (siteOpen) {
                siteNode.children = site.contractors.map((contractor) => ({
                  id: `contractor:${contractor.id}`,
                  kind: "contractor" as const,
                  ...SIZE.contractor,
                  node: { kind: "contractor" as const, region, project, site, contractor },
                  title: contractor.companyName,
                  lines: [contractor.specialty || "ללא התמחות", contractor.description],
                  status: contractor.workStatusLabel,
                  expanded: false,
                  hasChildren: false,
                  children: [],
                }));
              }
              return siteNode;
            }),
            ...extras.map((contractor) => ({
              id: `contractor:${contractor.id}`,
              kind: "contractor" as const,
              ...SIZE.contractor,
              node: { kind: "contractor" as const, region, project, contractor },
              title: contractor.companyName,
              lines: [contractor.specialty || "ללא התמחות", contractor.description],
              status: contractor.workStatusLabel,
              expanded: false,
              hasChildren: false,
              children: [],
            })),
          ];
          return projectNode;
        });
        return regionNode;
      });
    }

    const laid: LaidNode[] = [];
    const nextEdges: LaidEdge[] = [];
    layoutTree(root, PAD, PAD, laid, nextEdges);
    const rawW = Math.max(...laid.map((n) => n.x + n.w), subtreeWidth(root)) + PAD;
    const flipped = laid.map((n) => ({ ...n, x: rawW - n.x - n.w }));
    const flippedEdges = nextEdges.map((e) => ({
      ...e,
      x1: rawW - e.x1,
      x2: rawW - e.x2,
    }));
    return {
      nodes: flipped,
      edges: flippedEdges,
      width: rawW,
      height: Math.max(...flipped.map((n) => n.y + n.h), SIZE.company.h) + PAD,
    };
  }, [company, expanded, regions, totals]);

  return (
    <div className="w-full overflow-x-auto" dir="ltr">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
        >
          {edges.map((edge) => (
            <path
              key={edge.id}
              d={elbow(edge)}
              fill="none"
              stroke="#C8102E"
              strokeWidth="1.5"
              strokeOpacity="0.55"
            />
          ))}
        </svg>
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
          >
            <HubEntityCard
              kind={node.kind}
              title={node.title}
              lines={node.lines}
              status={node.status}
              selected={selectedId === node.id}
              expanded={node.expanded}
              hasChildren={node.hasChildren}
              onOpen={() => {
                if (node.kind !== "contractor") onToggle(node.node);
              }}
              onDetails={() => onDetails(node.node)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HubTreeMobile({
  company,
  regions,
  expanded,
  selectedId,
  onToggle,
  onDetails,
  totals,
}: {
  company: HubCompany;
  regions: HubRegion[];
  expanded: Record<string, boolean>;
  selectedId: string | null;
  onToggle: (node: SelectedHubNode) => void;
  onDetails: (node: SelectedHubNode) => void;
  totals?: { regions: number; projects: number };
  stack?: SelectedHubNode[];
  onOpenRegion?: (region: HubRegion) => void;
  onOpenProject?: (region: HubRegion, project: HubProject) => void;
  onOpenSite?: (region: HubRegion, project: HubProject, site: HubSite) => void;
  onOpenContractor?: (
    region: HubRegion,
    project: HubProject,
    contractor: HubContractor,
    site?: HubSite
  ) => void;
  onBack?: () => void;
}) {
  return (
    <HubOrgTree
      company={company}
      regions={regions}
      expanded={expanded}
      selectedId={selectedId}
      onToggle={onToggle}
      onDetails={onDetails}
      totals={totals}
    />
  );
}

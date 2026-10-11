export type HubContractor = {
  id: string;
  subcontractorId: string;
  companyName: string;
  specialty: string | null;
  description: string;
  workStatus: string;
  workStatusLabel: string;
  status: string;
  workSiteId: string | null;
};

export type HubSite = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  status: string;
  workRegionId?: string | null;
  diaryCount: number;
  deliveryNoteCount: number;
  activeWorks: number;
  contractorCount: number;
  contractors: HubContractor[];
};

export type HubProject = {
  id: string;
  name: string;
  contractNumber: string;
  contractor: string;
  location: string;
  status: string;
  statusLabel: string;
  ownerName: string | null;
  ownerId?: string | null;
  workRegionId: string | null;
  siteCount: number;
  diaryCount: number;
  deliveryNoteCount: number;
  contractorCount: number;
  sites: HubSite[];
  contractors: HubContractor[];
};

export type HubRegion = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  unassigned: boolean;
  projectCount: number;
  siteCount: number;
  activeWorks: number;
  projects: HubProject[];
};

export type HubCompany = {
  name: string;
  tagline: string;
  logoUrl: string;
};

export type HubFilterOptions = {
  regions: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
};

export type HubTreePayload = {
  company: HubCompany;
  regions: HubRegion[];
  clients: Array<{ id: string; name: string }>;
  filterOptions?: HubFilterOptions;
  canManageRegions: boolean;
  canAssignManager: boolean;
  emptyReason: "none" | "filtered" | "unauthorized" | null;
  totals: {
    regions: number;
    projects: number;
    sites: number;
    contractors: number;
  };
};

export type HubNodeKind = "company" | "region" | "project" | "site" | "contractor";

export type SelectedHubNode =
  | { kind: "company"; company: HubCompany }
  | { kind: "region"; region: HubRegion }
  | { kind: "project"; region: HubRegion; project: HubProject }
  | { kind: "site"; region: HubRegion; project: HubProject; site: HubSite }
  | {
      kind: "contractor";
      region: HubRegion;
      project: HubProject;
      site?: HubSite;
      contractor: HubContractor;
    };

import { prisma } from "@/lib/prisma";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { canAssignProjectManager } from "@/lib/auth/project-access";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";
import { ClientsRepository } from "@/repositories/clients.repository";
import {
  UNASSIGNED_REGION_ID,
  UNASSIGNED_REGION_NAME,
  WorkRegionsRepository,
} from "@/repositories/work-regions.repository";
import { PROJECT_STATUS_LABELS } from "@/constants";
import { WORK_STATUS_LABELS } from "@/lib/subcontractors/constants";
import { COMPANY_PROFILE } from "@/config/company";

export type HubTreeFilters = {
  q?: string;
  clientId?: string;
  projectId?: string;
  siteId?: string;
  status?: string;
  regionId?: string;
};

export const ProjectControlHubRepository = {
  async tree(opts: {
    userId: string;
    role: string;
    filters?: HubTreeFilters;
  }) {
    await ClientsRepository.syncFromExistingData(opts.userId);

    const projects = await listProjectsForRole({
      userId: opts.userId,
      role: opts.role,
    });
    const projectIds = projects.map((p) => p.id);
    const filters = opts.filters ?? {};

    const [regions, regionMap, sites, diaryCounts, dnCounts, assignments] = await Promise.all([
      WorkRegionsRepository.list(false),
      WorkRegionsRepository.projectRegionMap(projectIds),
      projectIds.length
        ? prisma.projectWorkSite.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: "asc" },
            include: {
              _count: {
                select: {
                  workDiaries: { where: { deletedAt: null } },
                  opsDeliveryNotes: { where: { deletedAt: null } },
                },
              },
            },
          })
        : [],
      projectIds.length
        ? prisma.workDiary.groupBy({
            by: ["projectId"],
            where: { projectId: { in: projectIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [],
      projectIds.length
        ? prisma.opsDeliveryNote.groupBy({
            by: ["projectId"],
            where: { projectId: { in: projectIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [],
      projectIds.length
        ? prisma.subcontractorAssignment.findMany({
            where: {
              projectId: { in: projectIds },
              status: { not: "cancelled" },
            },
            select: {
              id: true,
              projectId: true,
              workSiteId: true,
              description: true,
              workStatus: true,
              status: true,
              subcontractor: {
                select: {
                  id: true,
                  companyName: true,
                  specialty: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          })
        : [],
    ]);
    const siteRegionMap = await WorkRegionsRepository.siteRegionMap(sites.map((s) => s.id));

    const sitesByProject = new Map<string, typeof sites>();
    for (const site of sites) {
      const list = sitesByProject.get(site.projectId) ?? [];
      list.push(site);
      sitesByProject.set(site.projectId, list);
    }
    const diariesByProject = new Map(
      diaryCounts.map((row) => [row.projectId, row._count._all])
    );
    const dnsByProject = new Map(
      dnCounts.map((row) => [row.projectId, row._count._all])
    );
    const assignmentsByProject = new Map<string, typeof assignments>();
    const assignmentsBySite = new Map<string, typeof assignments>();
    for (const row of assignments) {
      const projectList = assignmentsByProject.get(row.projectId) ?? [];
      projectList.push(row);
      assignmentsByProject.set(row.projectId, projectList);
      if (row.workSiteId) {
        const siteList = assignmentsBySite.get(row.workSiteId) ?? [];
        siteList.push(row);
        assignmentsBySite.set(row.workSiteId, siteList);
      }
    }

    function mapAssignment(row: (typeof assignments)[number]) {
      return {
        id: row.id,
        subcontractorId: row.subcontractor.id,
        companyName: row.subcontractor.companyName,
        specialty: row.subcontractor.specialty,
        description: row.description,
        workStatus: row.workStatus,
        workStatusLabel: WORK_STATUS_LABELS[row.workStatus] ?? row.workStatus,
        status: row.status,
        workSiteId: row.workSiteId,
      };
    }

    function mapProject(project: (typeof projects)[number]) {
      const projectAssignments = (assignmentsByProject.get(project.id) ?? []).map(
        mapAssignment
      );
      const projectSites = (sitesByProject.get(project.id) ?? []).map((site) => {
        const siteAssignments = (assignmentsBySite.get(site.id) ?? []).map(
          mapAssignment
        );
        return {
          id: site.id,
          name: site.name,
          address: site.address,
          contactName: site.contactName,
          status: site.status,
          workRegionId: siteRegionMap.get(site.id) ?? null,
          diaryCount: site._count.workDiaries,
          deliveryNoteCount: site._count.opsDeliveryNotes,
          activeWorks: siteAssignments.filter((a) =>
            ["assigned", "in_progress", "submitted", "returned", "partial"].includes(
              a.workStatus
            )
          ).length,
          contractorCount: siteAssignments.length,
          contractors: siteAssignments,
        };
      });
      return {
        id: project.id,
        name: project.name,
        contractNumber: project.contractNumber,
        contractor: project.contractor,
        location: project.location,
        status: project.status,
        statusLabel:
          PROJECT_STATUS_LABELS[
            project.status as keyof typeof PROJECT_STATUS_LABELS
          ] ?? project.status,
        ownerName: project.owner?.name ?? null,
        ownerId: project.ownerId,
        workRegionId: regionMap.get(project.id) ?? null,
        siteCount: projectSites.length,
        diaryCount: diariesByProject.get(project.id) ?? 0,
        deliveryNoteCount: dnsByProject.get(project.id) ?? 0,
        contractorCount: projectAssignments.length,
        sites: projectSites,
        contractors: projectAssignments,
      };
    }

    const q = filters.q?.trim().toLowerCase() ?? "";
    const mappedProjects = [];
    const clients = new Map<string, { id: string; name: string }>();
    const catalogClients = new Map<string, { id: string; name: string }>();
    const catalogProjects: Array<{ id: string; name: string }> = [];

    for (const project of projects) {
      const mapped = mapProject(project);
      const clientName = project.contractor.trim() || "ללא לקוח";
      catalogClients.set(clientName.toLowerCase(), { id: clientName, name: clientName });
      catalogProjects.push({ id: project.id, name: project.name });
      if (filters.projectId && project.id !== filters.projectId) continue;
      if (filters.status && project.status !== filters.status) continue;
      if (filters.siteId && !mapped.sites.some((s) => s.id === filters.siteId)) {
        continue;
      }
      const regionId = regionMap.get(project.id) || UNASSIGNED_REGION_ID;
      const siteInRegion = mapped.sites.some(
        (s) => (s.workRegionId || UNASSIGNED_REGION_ID) === filters.regionId
      );
      if (filters.regionId && regionId !== filters.regionId && !siteInRegion) continue;
      if (filters.clientId) {
        const wanted = filters.clientId.trim().toLowerCase();
        if (clientName.toLowerCase() !== wanted) continue;
      }
      if (
        q &&
        ![
          project.name,
          project.contractNumber,
          project.contractor,
          project.location,
          ...mapped.sites.map((s) => s.name),
          ...mapped.contractors.map((c) => `${c.companyName} ${c.specialty ?? ""} ${c.description}`),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      mappedProjects.push(mapped);
      clients.set(clientName.toLowerCase(), { id: clientName, name: clientName });
    }

    const byRegion = new Map<string, typeof mappedProjects>();
    for (const project of mappedProjects) {
      const key = filters.regionId
        ? filters.regionId
        : project.workRegionId || UNASSIGNED_REGION_ID;
      const list = byRegion.get(key) ?? [];
      list.push(project);
      byRegion.set(key, list);
    }

    const regionRows = regions.map((region) => {
      const list = byRegion.get(region.id) ?? [];
      return {
        id: region.id,
        name: region.name,
        sortOrder: region.sortOrder,
        active: region.active,
        unassigned: false,
        projectCount: list.length,
        siteCount: list.reduce((n, p) => n + p.siteCount, 0),
        activeWorks: list.reduce(
          (n, p) => n + p.sites.reduce((s, site) => s + site.activeWorks, 0),
          0
        ),
        projects: list,
      };
    });

    const unassigned = byRegion.get(UNASSIGNED_REGION_ID) ?? [];
    if (unassigned.length > 0 || !filters.regionId || filters.regionId === UNASSIGNED_REGION_ID) {
      if (unassigned.length > 0 || !mappedProjects.length) {
        regionRows.push({
          id: UNASSIGNED_REGION_ID,
          name: UNASSIGNED_REGION_NAME,
          sortOrder: 999,
          active: true,
          unassigned: true,
          projectCount: unassigned.length,
          siteCount: unassigned.reduce((n, p) => n + p.siteCount, 0),
          activeWorks: unassigned.reduce(
            (n, p) => n + p.sites.reduce((s, site) => s + site.activeWorks, 0),
            0
          ),
          projects: unassigned,
        });
      }
    }

    const visibleRegions = filters.regionId
      ? regionRows.filter((r) => r.id === filters.regionId)
      : regionRows.filter((r) => r.projectCount > 0 || !r.unassigned);

    const hasFilters = Boolean(
      q ||
        filters.clientId ||
        filters.projectId ||
        filters.siteId ||
        filters.status ||
        filters.regionId
    );
    const emptyReason =
      projects.length === 0
        ? opts.role === PROJECT_MANAGER_ROLE
          ? "unauthorized"
          : "none"
        : mappedProjects.length === 0
          ? hasFilters
            ? "filtered"
            : "none"
          : null;

    return {
      company: {
        name: COMPANY_PROFILE.name,
        tagline: COMPANY_PROFILE.tagline,
        logoUrl: COMPANY_PROFILE.logoUrl,
      },
      regions: visibleRegions,
      clients: [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, "he")),
      filterOptions: {
        regions: [
          ...regions.map((r) => ({ id: r.id, name: r.name })),
          { id: UNASSIGNED_REGION_ID, name: UNASSIGNED_REGION_NAME },
        ],
        clients: [...catalogClients.values()].sort((a, b) => a.name.localeCompare(b.name, "he")),
        projects: catalogProjects,
      },
      canManageRegions: isSystemAdminRole(opts.role),
      canAssignManager: canAssignProjectManager(opts.role),
      emptyReason,
      totals: {
        regions: visibleRegions.filter((r) => !r.unassigned).length,
        projects: mappedProjects.length,
        sites: mappedProjects.reduce((n, p) => n + p.siteCount, 0),
        contractors: mappedProjects.reduce((n, p) => n + p.contractorCount, 0),
      },
    };
  },
};

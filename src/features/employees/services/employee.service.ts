import type { Employee } from "@/types";
import { apiClient } from "@/lib/api/client";

export const employeeService = {
  async getAll(): Promise<Employee[]> {
    return apiClient.get<Employee[]>("/api/employees");
  },

  async getById(id: string): Promise<Employee | undefined> {
    const employees = await this.getAll();
    return employees.find((e) => e.id === id);
  },

  async getByProject(projectId: string): Promise<Employee[]> {
    return apiClient.get<Employee[]>(`/api/employees?projectId=${projectId}`);
  },

  async getActive(): Promise<Employee[]> {
    return apiClient.get<Employee[]>("/api/employees?active=true");
  },

  /** Provision FIELD_MANAGER login for a foreman (not for workers). */
  async provisionFieldLogin(
    id: string,
    username: string,
    password: string
  ): Promise<{ employee: Employee; login?: { username: string } }> {
    return apiClient.post(`/api/employees/${id}/system-user`, {
      username,
      password,
    });
  },
};

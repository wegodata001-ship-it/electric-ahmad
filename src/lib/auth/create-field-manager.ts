import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { FIELD_MANAGER_ROLE } from "@/lib/auth/roles";
import { AuditRepository } from "@/repositories/audit.repository";

export type CreateFieldManagerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  username: string;
  password: string;
  projectIds?: string[];
  notes?: string;
};

export async function createFieldManagerAccount(
  input: CreateFieldManagerInput,
  actorUserId: string
) {
  const username = input.username.trim().toLowerCase();
  const password = input.password;
  if (username.length < 3) throw new Error("שם משתמש קצר מדי");
  if (password.length < 6) throw new Error("סיסמה חייבת לפחות 6 תווים");

  const email =
    input.email?.trim().toLowerCase() ||
    `${username}@field.wego-electric.local`;

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existingUser) throw new Error("שם משתמש או אימייל כבר קיימים");

  const existingEmpPhone = await prisma.employee.findFirst({
    where: { phone: input.phone.trim() },
  });
  if (existingEmpPhone) throw new Error("מספר טלפון כבר קיים במערכת");

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        username,
        passwordHash,
        name: `${input.firstName.trim()} ${input.lastName.trim()}`,
        role: FIELD_MANAGER_ROLE,
      },
    });

    const employee = await tx.employee.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        email,
        role: "foreman",
        status: "active",
        joinedAt: new Date(),
        userId: user.id,
        wantsSystemUser: false,
      },
    });

    if (input.projectIds?.length) {
      for (const projectId of input.projectIds) {
        await tx.project.update({
          where: { id: projectId },
          data: { foremanId: employee.id },
        });
        await tx.projectEmployee.upsert({
          where: {
            projectId_employeeId: { projectId, employeeId: employee.id },
          },
          create: { projectId, employeeId: employee.id },
          update: {},
        });
      }
    }

    return { user, employee };
  });

  await AuditRepository.log({
    action: "CREATE",
    entityType: "FieldManager",
    entityId: result.employee.id,
    userId: actorUserId,
    metadata: {
      managerId: result.employee.id,
      userId: result.user.id,
      username,
    },
  });

  return {
    employeeId: result.employee.id,
    userId: result.user.id,
    username,
    fullName: result.user.name,
    phone: result.employee.phone,
    role: FIELD_MANAGER_ROLE,
  };
}

/** Link existing foreman employee to a new FIELD_MANAGER login. */
export async function provisionFieldLoginForEmployee(
  employeeId: string,
  username: string,
  password: string,
  actorUserId: string
) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new Error("עובד לא נמצא");
  if (emp.userId) throw new Error("כבר קיים משתמש מערכת לעובד זה");
  if (emp.role !== "foreman" && emp.role !== "manager") {
    throw new Error("ניתן ליצור התחברות רק למנהל עבודה");
  }

  const uname = username.trim().toLowerCase();
  if (uname.length < 3) throw new Error("שם משתמש קצר מדי");
  if (password.length < 6) throw new Error("סיסמה חייבת לפחות 6 תווים");

  const taken = await prisma.user.findUnique({ where: { username: uname } });
  if (taken) throw new Error("שם משתמש תפוס");

  const passwordHash = await hashPassword(password);
  const email =
    emp.email || `${uname}@field.wego-electric.local`;

  const user = await prisma.user.create({
    data: {
      email,
      username: uname,
      passwordHash,
      name: `${emp.firstName} ${emp.lastName}`,
      role: FIELD_MANAGER_ROLE,
      employee: { connect: { id: emp.id } },
    },
  });

  await prisma.employee.update({
    where: { id: emp.id },
    data: { wantsSystemUser: false },
  });

  await AuditRepository.log({
    action: "UPDATE",
    entityType: "FieldManager",
    entityId: emp.id,
    userId: actorUserId,
    metadata: {
      action: "provision_login",
      managerId: emp.id,
      userId: user.id,
      username: uname,
    },
  });

  return {
    employeeId: emp.id,
    userId: user.id,
    username: uname,
    fullName: user.name,
    role: FIELD_MANAGER_ROLE,
  };
}

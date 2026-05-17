import { PermissionLevel, StaffRole } from "@/generated/prisma/enums.js";
import type { PermissionDomain, Permissions } from "@/shared/types/staff.js";

const hierarchy: Record<PermissionLevel, number> = {
    [PermissionLevel.NONE]: 0,
    [PermissionLevel.READ]: 1,
    [PermissionLevel.WRITE]: 2
};

export default function hasPermissions(permissions: Permissions, role: StaffRole, domain: PermissionDomain, level: PermissionLevel) {
    if (role === StaffRole.OWNER) return true;
    return hierarchy[permissions[domain]] >= hierarchy[level];
};

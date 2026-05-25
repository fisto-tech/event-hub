/** Roles that see all customers and master data */
export const PRIVILEGED_ROLES = ['admin', 'super_admin'];

export const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(role || '');

export const formatRoleLabel = (role) => {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'Employee';
};

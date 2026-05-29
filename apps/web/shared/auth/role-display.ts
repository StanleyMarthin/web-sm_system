export function getRoleDisplayName(roleName: string): string {
  if (roleName.trim().toLowerCase() === "mis") {
    return "Super Admin";
  }

  return roleName;
}

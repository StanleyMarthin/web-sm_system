import type { SpfRole } from "@/shared/auth/admin-session";
import type { NavigationItem } from "@/shared/navigation/modules";

export function buildSpfNavigation(role: SpfRole): NavigationItem {
  const subItems = [
    {
      id: "spf-periods",
      label: "Periode SPF",
      href: "/spf/periods",
    },
    {
      id: "spf-clients",
      label: "Client / Customer",
      href: "/spf/clients",
    },
    {
      id: "spf-items",
      label: "Item Restorasi",
      href: "/spf/items",
    },
  ];

  if (role === "ADMIN") {
    subItems.push({
      id: "spf-sources",
      label: "Source SMS DB",
      href: "/spf/sources",
    });
  }

  return {
    id: "spf",
    label: "SPF Client Portal",
    icon: "grid",
    group: "Operations",
    subItems,
  };
}

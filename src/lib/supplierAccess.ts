// Who may rate / block suppliers. Super Administrador and Administrador de
// cliente can always; everyone else needs the per-user permission.
type SupplierPermUser = {
  role: string;
  canRateSuppliers: boolean;
  canBlockSuppliers: boolean;
  canManageSupplierDocs?: boolean;
  canCreateSuppliers?: boolean;
  canEditSuppliers?: boolean;
  canAddSupplierContacts?: boolean;
};

export function canRateSuppliers(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || user.canRateSuppliers;
}

export function canBlockSuppliers(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || user.canBlockSuppliers;
}

export function canManageSupplierDocs(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || Boolean(user.canManageSupplierDocs);
}

export function canCreateSuppliers(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || Boolean(user.canCreateSuppliers);
}

export function canEditSuppliers(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || Boolean(user.canEditSuppliers);
}

export function canAddSupplierContacts(user: SupplierPermUser): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || Boolean(user.canAddSupplierContacts);
}

// Administrators review every buyer's comment; others only see their own.
export function canReviewRatings(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN";
}

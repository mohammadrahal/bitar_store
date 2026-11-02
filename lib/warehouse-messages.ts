/** Shown when the app cannot resolve the main warehouse branch id for transfers or opening stock. */
export const WAREHOUSE_NOT_LINKED_MESSAGE =
  'The main warehouse is not linked yet. Ask an admin to grant you access to the warehouse branch (Employees → branch access), or set NEXT_PUBLIC_WAREHOUSE_BRANCH_ID in .env with the warehouse id.'

export const WAREHOUSE_NOT_LINKED_HINT =
  'Assign the warehouse branch under Employees → branch access, or add NEXT_PUBLIC_WAREHOUSE_BRANCH_ID to .env with that branch’s id.'

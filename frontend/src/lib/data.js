import { createContext, useContext } from "react";

// App-wide data helpers: `version` bumps after any mutation so every page refetches,
// plus the shared projects list and the global task drawer / new-task modal.
export const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

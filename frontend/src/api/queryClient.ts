import { QueryClient } from '@tanstack/react-query';

// The app's one server-state cache. authStore clears it whenever the signed-in
// account changes, so nothing cached for one account is shown to the next.
export const queryClient = new QueryClient();

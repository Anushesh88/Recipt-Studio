import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

// Which sign-in options the login page offers (GET /auth/providers): the
// Google client ID, or null when Sign in with Google isn't set up
export const useAuthProviders = () =>
  useQuery({
    queryKey: ["auth", "providers"],
    queryFn: async () => (await apiClient.get<{ google_client_id: string | null }>("/auth/providers")).data,
    staleTime: Infinity,
    retry: false,
  });

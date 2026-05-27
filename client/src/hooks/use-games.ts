import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type {
  Game,
  CreateGameRequest,
  UpdateGameRequest,
  ReviewGameRequest,
} from "@shared/schema";
import { getOrCreateDeviceId } from "@/lib/device-id";

export function useGames() {
  return useQuery({
    queryKey: [api.games.list.path],
    queryFn: async () => {
      const res = await fetch(api.games.list.path);
      if (!res.ok) throw new Error("Failed to fetch games");
      return api.games.list.responses[200].parse(await res.json());
    },
  });
}

export function useGame(id: number) {
  return useQuery({
    queryKey: [api.games.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.games.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch game");
      return api.games.get.responses[200].parse(await res.json());
    },
    refetchInterval: (query) => {
      const game = query.state.data as Game | null | undefined;
      return game?.status === "processing" ? 2000 : false;
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGameRequest) => {
      const withIdentity: CreateGameRequest =
        data.deviceId && data.deviceId.length > 0
          ? data
          : { ...data, deviceId: getOrCreateDeviceId() };

      const validated = api.games.create.input.parse(withIdentity);

      const res = await fetch(api.games.create.path, {
        method: api.games.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.games.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create game");
      }

      return api.games.create.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
      queryClient.invalidateQueries({ queryKey: [api.games.list.path] });
    },
  });
}

export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: number } & UpdateGameRequest) => {
      const validated = api.games.update.input.parse(updates);
      const url = buildUrl(api.games.update.path, { id });

      const res = await fetch(url, {
        method: api.games.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Game not found");
        throw new Error("Failed to update game");
      }

      return api.games.update.responses[200].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData([api.games.get.path, variables.id], data);
      queryClient.invalidateQueries({ queryKey: [api.games.list.path] });
      queryClient.invalidateQueries({
        queryKey: [api.games.get.path, variables.id],
      });
    },
  });
}

export function useReviewGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: number } & ReviewGameRequest) => {
      const validated = api.games.review.input.parse(payload);
      const url = buildUrl(api.games.review.path, { id });

      const res = await fetch(url, {
        method: api.games.review.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.games.review.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 404) {
          throw new Error("Game not found");
        }
        throw new Error("Failed to review game");
      }

      return api.games.review.responses[200].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData([api.games.get.path, variables.id], data);
      queryClient.invalidateQueries({ queryKey: [api.games.list.path] });
    },
  });
}

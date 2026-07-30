import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  LogTouchpointRequest,
  SubmitCheckInRequest,
  UpdateProfileRequest,
} from '@sper/shared-types';

export const keys = {
  sper: (circleId: string) => ['sper', circleId] as const,
  careCards: (circleId: string) => ['careCards', circleId] as const,
  members: (circleId: string) => ['members', circleId] as const,
  touchpoints: (checkinId: string) => ['touchpoints', checkinId] as const,
  me: ['me'] as const,
};

export function useSper(circleId: string) {
  return useQuery({
    queryKey: keys.sper(circleId),
    queryFn: () => api.sper(circleId),
    enabled: !!circleId,
    staleTime: 30_000,
  });
}

export function useCareCards(circleId: string) {
  return useQuery({
    queryKey: keys.careCards(circleId),
    queryFn: () => api.careCards(circleId),
    enabled: !!circleId,
    staleTime: 30_000,
  });
}

export function useMembers(circleId: string) {
  return useQuery({
    queryKey: keys.members(circleId),
    queryFn: () => api.members(circleId),
    enabled: !!circleId,
  });
}

export function useTouchpoints(checkinId: string) {
  return useQuery({
    queryKey: keys.touchpoints(checkinId),
    queryFn: () => api.touchpoints(checkinId),
    enabled: !!checkinId,
    // Polled while visible so a prayer from someone else's device shows up
    // (and the tree updates) without the viewer having to do anything.
    refetchInterval: 15_000,
  });
}

export function useSubmitCheckIn(circleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCheckInRequest) => api.submitCheckIn(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sper(circleId) });
      qc.invalidateQueries({ queryKey: keys.careCards(circleId) });
    },
  });
}

export function useLogTouchpoint(circleId: string, checkinId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LogTouchpointRequest) => api.logTouchpoint(checkinId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.touchpoints(checkinId) });
      qc.invalidateQueries({ queryKey: keys.careCards(circleId) });
    },
  });
}

export function useSendGratitude(circleId: string, checkinId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.sendGratitude(checkinId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.careCards(circleId) });
    },
  });
}

export function useCreateInvite(circleId: string) {
  return useMutation({
    mutationFn: (email?: string) => api.createInvite(circleId, email),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => api.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

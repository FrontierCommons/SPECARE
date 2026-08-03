import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  LogTouchpointRequest,
  SubmitCheckInRequest,
  UpdateProfileRequest,
  SendVoiceNoteRequest,
} from '@sper/shared-types';

export const keys = {
  sper: (circleId: string) => ['sper', circleId] as const,
  careCards: (circleId: string) => ['careCards', circleId] as const,
  members: (circleId: string) => ['members', circleId] as const,
  touchpoints: (checkinId: string) => ['touchpoints', checkinId] as const,
  voiceNotes: (checkinId: string) => ['voiceNotes', checkinId] as const,
  me: ['me'] as const,
};

export function useSper(circleId: string) {
  return useQuery({
    queryKey: keys.sper(circleId),
    queryFn: () => api.sper(circleId),
    enabled: !!circleId,
    staleTime: 30_000,
    // Polled while visible so another member's check-in shows up on this
    // viewer's dashboard without them having to do anything. Also refetch on
    // window focus (overriding the app-wide default) so tabbing back in
    // shows fresh state immediately instead of waiting out the interval.
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

export function useCareCards(circleId: string) {
  return useQuery({
    queryKey: keys.careCards(circleId),
    queryFn: () => api.careCards(circleId),
    enabled: !!circleId,
    staleTime: 30_000,
    // Polled while visible so someone else's touchpoint ("I prayed for you")
    // or a "thank you" lands on this viewer's care cards without a manual
    // refresh — mirrors useTouchpoints below. Also refetch on window focus.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
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

/** Pending (not yet acknowledged) voice notes waiting on this check-in's
 * author. Only ever returns data for the caller's own check-in — polled like
 * touchpoints so a new recording shows up without the viewer doing anything. */
export function useVoiceNotes(checkinId: string) {
  return useQuery({
    queryKey: keys.voiceNotes(checkinId),
    queryFn: () => api.voiceNotes(checkinId),
    enabled: !!checkinId,
    refetchInterval: 15_000,
  });
}

export function useSendVoiceNote(circleId: string, checkinId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendVoiceNoteRequest) => api.sendVoiceNote(checkinId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.touchpoints(checkinId) });
      qc.invalidateQueries({ queryKey: keys.careCards(circleId) });
    },
  });
}

export function useMarkVoiceNoteReceived(checkinId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.markVoiceNoteReceived(checkinId, noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.voiceNotes(checkinId) });
    },
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
